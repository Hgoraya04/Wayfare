import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(readFileSync(join(here, '..', 'data', 'destinations.json'), 'utf8'));

export const DESTINATIONS = dataset.destinations;
export const TIERS = ['budget', 'midRange', 'luxury'];

const byId = new Map(DESTINATIONS.map((d) => [d.id, d]));

export function getDestination(id) {
  return byId.get(id) ?? null;
}

/**
 * A trip of N days has N-1 nights of lodging — you arrive on day 1 and leave on
 * day N. Charging N nights overstates the floor by a full night's lodging, which
 * on an expensive destination is enough to wrongly reject a workable budget.
 */
export function nightsFor(durationDays) {
  return Math.max(0, durationDays - 1);
}

/** Per-person cost of one day at a tier, split so the UI can show the breakdown. */
export function dailyBreakdown(destination, tier) {
  const costs = destination.dailyCost[tier];
  if (!costs) throw new Error(`Unknown tier "${tier}" for ${destination.id}`);
  return { ...costs };
}

/**
 * Total estimated trip cost for a whole party, in USD.
 * `flightCostPerPerson` comes from Duffel at runtime; tests inject it directly.
 */
export function estimateTripCost({
  destination,
  tier,
  durationDays,
  travelers = 1,
  flightCostPerPerson = 0,
}) {
  const c = dailyBreakdown(destination, tier);
  const nights = nightsFor(durationDays);

  const lodging = c.lodging * nights;
  const food = c.food * durationDays;
  const localTransport = c.localTransport * durationDays;
  const activities = c.activities * durationDays;

  const perPerson = lodging + food + localTransport + activities + flightCostPerPerson;

  return {
    tier,
    nights,
    durationDays,
    travelers,
    perPerson: round2(perPerson),
    total: round2(perPerson * travelers),
    breakdown: {
      flights: round2(flightCostPerPerson * travelers),
      lodging: round2(lodging * travelers),
      food: round2(food * travelers),
      localTransport: round2(localTransport * travelers),
      activities: round2(activities * travelers),
    },
  };
}

/** The cheapest this trip can realistically be done for — the budget-tier total. */
export function budgetFloor(opts) {
  return estimateTripCost({ ...opts, tier: 'budget' });
}

/**
 * Can this party do this trip on this budget? Returns the best tier that fits,
 * or — when nothing fits — the floor and the exact shortfall, which is what the
 * brief requires us to show instead of a bare "no".
 */
export function assessFeasibility({
  destination,
  budget,
  durationDays,
  travelers = 1,
  flightCostPerPerson = 0,
}) {
  const base = { destination, durationDays, travelers, flightCostPerPerson };
  const estimates = TIERS.map((tier) => estimateTripCost({ ...base, tier }));
  const affordable = estimates.filter((e) => e.total <= budget);
  const floor = estimates[0];

  if (affordable.length === 0) {
    return {
      feasible: false,
      destinationId: destination.id,
      budget,
      floor,
      shortfall: round2(floor.total - budget),
      message:
        `A ${durationDays}-day trip to ${destination.city} for ${travelers} ` +
        `${travelers === 1 ? 'traveler' : 'travelers'} needs about $${floor.total} ` +
        `at the most economical level — $${round2(floor.total - budget)} more than your budget.`,
    };
  }

  // Best experience that still fits.
  const best = affordable[affordable.length - 1];
  return {
    feasible: true,
    destinationId: destination.id,
    budget,
    tier: best.tier,
    estimate: best,
    headroom: round2(budget - best.total),
    floor,
  };
}

/**
 * Powers "anywhere in the world": score every curated destination against the
 * user's constraints and return the affordable ones, best experience first.
 *
 * `flightCostFor(destination)` is injected so this stays testable and so the
 * Duffel lookup can be swapped for a cache without touching this logic.
 */
export function rankDestinations({
  budget,
  durationDays,
  travelers = 1,
  includeCountries = [],
  excludeCountries = [],
  tripStyles = [],
  month = null,
  flightCostFor = () => 0,
}) {
  const include = includeCountries.map(normalize);
  const exclude = excludeCountries.map(normalize);
  const styles = tripStyles.map(normalize);

  const candidates = DESTINATIONS.filter((d) => {
    const country = normalize(d.country);
    const code = normalize(d.countryCode);
    if (exclude.includes(country) || exclude.includes(code)) return false;
    if (include.length > 0 && !include.includes(country) && !include.includes(code)) return false;
    if (styles.length > 0 && !styles.some((s) => d.tripStyles.includes(s))) return false;
    return true;
  });

  const assessed = candidates.map((destination) => {
    const result = assessFeasibility({
      destination,
      budget,
      durationDays,
      travelers,
      flightCostPerPerson: flightCostFor(destination),
    });
    return {
      ...result,
      city: destination.city,
      country: destination.country,
      region: destination.region,
      inSeason: month == null ? null : destination.bestMonths.includes(Number(month)),
    };
  });

  const feasible = assessed.filter((a) => a.feasible);
  // In-season first, then the richest tier the budget supports, then cheapest.
  feasible.sort((a, b) => {
    if (a.inSeason !== b.inSeason) return a.inSeason ? -1 : 1;
    const tierDelta = TIERS.indexOf(b.tier) - TIERS.indexOf(a.tier);
    if (tierDelta !== 0) return tierDelta;
    return a.estimate.total - b.estimate.total;
  });

  if (feasible.length > 0) {
    return { feasible: true, matches: feasible, consideredCount: assessed.length };
  }

  // Nothing fits — surface the single cheapest option so the UI can name a
  // concrete target rather than telling the user to "try a bigger budget".
  const cheapest = assessed.reduce(
    (min, a) => (min == null || a.floor.total < min.floor.total ? a : min),
    null,
  );
  return {
    feasible: false,
    matches: [],
    consideredCount: assessed.length,
    cheapestOption: cheapest,
    lowestRealisticBudget: cheapest ? cheapest.floor.total : null,
  };
}

/** Returns an error string, or null when the payload is usable. */
export function validatePreferences(body) {
  const { budget, durationDays, travelers } = body ?? {};

  if (budget == null || Number.isNaN(Number(budget)) || Number(budget) <= 0) {
    return 'budget must be a positive number.';
  }
  if (!Number.isInteger(Number(durationDays)) || Number(durationDays) < 1 || Number(durationDays) > 60) {
    return 'durationDays must be a whole number between 1 and 60.';
  }
  if (travelers != null && (!Number.isInteger(Number(travelers)) || Number(travelers) < 1 || Number(travelers) > 12)) {
    return 'travelers must be a whole number between 1 and 12.';
  }
  if (body.tripStyles != null && !Array.isArray(body.tripStyles)) {
    return 'tripStyles must be an array.';
  }
  if (body.cuisines != null && !Array.isArray(body.cuisines)) {
    return 'cuisines must be an array.';
  }
  if (body.month != null) {
    const m = Number(body.month);
    if (!Number.isInteger(m) || m < 1 || m > 12) return 'month must be between 1 and 12.';
  }
  return null;
}

function normalize(value) {
  return String(value).trim().toLowerCase();
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
