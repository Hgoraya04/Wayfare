import {
  DESTINATIONS,
  getDestination,
  nightsFor,
  estimateTripCost,
  budgetFloor,
  assessFeasibility,
  rankDestinations,
  validatePreferences,
} from '../services/budgetService.js';

const bangkok = getDestination('bangkok-th');
const newYork = getDestination('new-york-us');

describe('dataset', () => {
  it('every destination has all three tiers with all four cost components', () => {
    for (const d of DESTINATIONS) {
      for (const tier of ['budget', 'midRange', 'luxury']) {
        expect(d.dailyCost[tier]).toBeDefined();
        for (const part of ['lodging', 'food', 'localTransport', 'activities']) {
          expect(typeof d.dailyCost[tier][part]).toBe('number');
        }
      }
    }
  });

  it('tiers are strictly ordered cheapest to priciest', () => {
    for (const d of DESTINATIONS) {
      const total = (t) =>
        Object.values(d.dailyCost[t]).reduce((sum, n) => sum + n, 0);
      expect(total('budget')).toBeLessThan(total('midRange'));
      expect(total('midRange')).toBeLessThan(total('luxury'));
    }
  });

  it('ids are unique', () => {
    const ids = DESTINATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('nightsFor', () => {
  it('charges one fewer night than days', () => {
    expect(nightsFor(5)).toBe(4);
    expect(nightsFor(1)).toBe(0);
  });

  it('never goes negative', () => {
    expect(nightsFor(0)).toBe(0);
  });
});

describe('estimateTripCost', () => {
  it('bills lodging per night and everything else per day', () => {
    const est = estimateTripCost({
      destination: bangkok,
      tier: 'budget',
      durationDays: 5,
      travelers: 1,
    });
    const c = bangkok.dailyCost.budget;

    expect(est.breakdown.lodging).toBe(c.lodging * 4);
    expect(est.breakdown.food).toBe(c.food * 5);
    expect(est.breakdown.localTransport).toBe(c.localTransport * 5);
    expect(est.breakdown.activities).toBe(c.activities * 5);
  });

  it('scales the total with traveler count', () => {
    const base = { destination: bangkok, tier: 'budget', durationDays: 5 };
    const solo = estimateTripCost({ ...base, travelers: 1 });
    const trio = estimateTripCost({ ...base, travelers: 3 });
    expect(trio.total).toBeCloseTo(solo.total * 3, 2);
  });

  it('includes flights per person', () => {
    const base = { destination: bangkok, tier: 'budget', durationDays: 5, travelers: 2 };
    const without = estimateTripCost(base);
    const with900 = estimateTripCost({ ...base, flightCostPerPerson: 900 });
    expect(with900.total - without.total).toBeCloseTo(1800, 2);
    expect(with900.breakdown.flights).toBeCloseTo(1800, 2);
  });
});

describe('assessFeasibility', () => {
  it('picks the richest tier the budget covers', () => {
    const luxuryTotal = estimateTripCost({
      destination: bangkok,
      tier: 'luxury',
      durationDays: 4,
      travelers: 1,
    }).total;

    const result = assessFeasibility({
      destination: bangkok,
      budget: luxuryTotal + 50,
      durationDays: 4,
      travelers: 1,
    });

    expect(result.feasible).toBe(true);
    expect(result.tier).toBe('luxury');
    expect(result.headroom).toBeCloseTo(50, 2);
  });

  it('falls back to a cheaper tier when luxury is out of reach', () => {
    const budgetTotal = budgetFloor({
      destination: newYork,
      durationDays: 4,
      travelers: 1,
    }).total;

    const result = assessFeasibility({
      destination: newYork,
      budget: budgetTotal + 10,
      durationDays: 4,
      travelers: 1,
    });

    expect(result.feasible).toBe(true);
    expect(result.tier).toBe('budget');
  });

  it('reports the floor and exact shortfall when nothing fits', () => {
    const result = assessFeasibility({
      destination: newYork,
      budget: 50,
      durationDays: 7,
      travelers: 2,
    });

    expect(result.feasible).toBe(false);
    expect(result.floor.total).toBeGreaterThan(50);
    expect(result.shortfall).toBeCloseTo(result.floor.total - 50, 2);
    expect(result.message).toContain('New York');
  });

  it('treats a budget exactly equal to the floor as feasible', () => {
    const floor = budgetFloor({ destination: bangkok, durationDays: 3, travelers: 1 });
    const result = assessFeasibility({
      destination: bangkok,
      budget: floor.total,
      durationDays: 3,
      travelers: 1,
    });
    expect(result.feasible).toBe(true);
  });
});

describe('rankDestinations', () => {
  it('excludes countries the traveler ruled out', () => {
    const result = rankDestinations({
      budget: 100000,
      durationDays: 5,
      excludeCountries: ['Thailand'],
    });
    expect(result.matches.some((m) => m.country === 'Thailand')).toBe(false);
  });

  it('restricts to an include list when one is given', () => {
    const result = rankDestinations({
      budget: 100000,
      durationDays: 5,
      includeCountries: ['Japan', 'Portugal'],
    });
    const countries = new Set(result.matches.map((m) => m.country));
    expect(countries).toEqual(new Set(['Japan', 'Portugal']));
  });

  it('accepts ISO country codes as well as names', () => {
    const result = rankDestinations({
      budget: 100000,
      durationDays: 5,
      includeCountries: ['JP'],
    });
    expect(result.matches.every((m) => m.country === 'Japan')).toBe(true);
  });

  it('filters by trip style', () => {
    const result = rankDestinations({
      budget: 100000,
      durationDays: 5,
      tripStyles: ['adventure'],
    });
    expect(result.matches.length).toBeGreaterThan(0);
    for (const m of result.matches) {
      expect(getDestination(m.destinationId).tripStyles).toContain('adventure');
    }
  });

  it('ranks in-season destinations ahead of off-season ones', () => {
    const result = rankDestinations({
      budget: 100000,
      durationDays: 5,
      month: 1,
    });
    const seasonFlags = result.matches.map((m) => m.inSeason);
    const firstOffSeason = seasonFlags.indexOf(false);
    if (firstOffSeason !== -1) {
      expect(seasonFlags.slice(firstOffSeason)).not.toContain(true);
    }
  });

  it('returns the lowest realistic budget when nothing is affordable', () => {
    const result = rankDestinations({
      budget: 5,
      durationDays: 10,
      travelers: 4,
    });

    expect(result.feasible).toBe(false);
    expect(result.matches).toHaveLength(0);
    expect(result.lowestRealisticBudget).toBeGreaterThan(5);
    expect(result.cheapestOption).not.toBeNull();
  });
});

describe('validatePreferences', () => {
  const valid = { budget: 2000, durationDays: 7, travelers: 2 };

  it('accepts a well-formed payload', () => {
    expect(validatePreferences(valid)).toBeNull();
  });

  it.each([
    [{ ...valid, budget: 0 }, 'budget'],
    [{ ...valid, budget: -5 }, 'budget'],
    [{ ...valid, budget: 'lots' }, 'budget'],
    [{ ...valid, durationDays: 0 }, 'durationDays'],
    [{ ...valid, durationDays: 2.5 }, 'durationDays'],
    [{ ...valid, durationDays: 90 }, 'durationDays'],
    [{ ...valid, travelers: 0 }, 'travelers'],
    [{ ...valid, month: 13 }, 'month'],
    [{ ...valid, tripStyles: 'food' }, 'tripStyles'],
  ])('rejects %o', (payload, field) => {
    expect(validatePreferences(payload)).toContain(field);
  });

  it('rejects a missing body', () => {
    expect(validatePreferences(undefined)).toContain('budget');
  });
});
