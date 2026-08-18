import express from 'express';
import {
  DESTINATIONS,
  getDestination,
  assessFeasibility,
  rankDestinations,
  validatePreferences,
} from '../services/budgetService.js';

const router = express.Router();

/** Trimmed shape for the picker UI — the full cost table is a detail view. */
function toSummary(d) {
  return {
    id: d.id,
    city: d.city,
    country: d.country,
    countryCode: d.countryCode,
    region: d.region,
    lat: d.lat,
    lon: d.lon,
    tripStyles: d.tripStyles,
    bestMonths: d.bestMonths,
    fromPerDay: d.dailyCost.budget.lodging + d.dailyCost.budget.food
      + d.dailyCost.budget.localTransport + d.dailyCost.budget.activities,
  };
}

router.get('/', (req, res) => {
  res.json(DESTINATIONS.map(toSummary));
});

router.get('/:id', (req, res) => {
  const destination = getDestination(req.params.id);
  if (!destination) return res.status(404).json({ error: 'Destination not found.' });
  res.json(destination);
});

/**
 * "Anywhere in the world" matching. Returns affordable destinations, or — when
 * nothing fits — the lowest budget that would work.
 */
router.post('/match', (req, res) => {
  const error = validatePreferences(req.body);
  if (error) return res.status(400).json({ error });

  const {
    budget,
    durationDays,
    travelers = 1,
    includeCountries = [],
    excludeCountries = [],
    tripStyles = [],
    month = null,
  } = req.body;

  try {
    const result = rankDestinations({
      budget: Number(budget),
      durationDays: Number(durationDays),
      travelers: Number(travelers),
      includeCountries,
      excludeCountries,
      tripStyles,
      month,
      // TODO: swap for the Duffel lookup once flight search lands. Until then
      // every destination is priced without airfare, so totals read low.
      flightCostFor: () => 0,
    });
    res.json(result);
  } catch (err) {
    console.error('match failed:', err.message);
    res.status(500).json({ error: 'Could not match destinations.' });
  }
});

/** Budget check for one specific destination. */
router.post('/:id/feasibility', (req, res) => {
  const destination = getDestination(req.params.id);
  if (!destination) return res.status(404).json({ error: 'Destination not found.' });

  const error = validatePreferences(req.body);
  if (error) return res.status(400).json({ error });

  try {
    res.json(
      assessFeasibility({
        destination,
        budget: Number(req.body.budget),
        durationDays: Number(req.body.durationDays),
        travelers: Number(req.body.travelers ?? 1),
        flightCostPerPerson: Number(req.body.flightCostPerPerson ?? 0),
      }),
    );
  } catch (err) {
    console.error('feasibility failed:', err.message);
    res.status(500).json({ error: 'Could not assess this trip.' });
  }
});

export default router;
