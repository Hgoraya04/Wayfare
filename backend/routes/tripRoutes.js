import express from 'express';
import { query, withTransaction } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { getDestination, assessFeasibility, validatePreferences } from '../services/budgetService.js';
import { generateItinerary } from '../services/claudeService.js';

const router = express.Router();

router.use(authenticate);

function toTrip(row) {
  return {
    id: row.id,
    title: row.title,
    destination: {
      id: row.destinationid,
      city: row.destinationcity,
      country: row.destinationcountry,
    },
    startDate: row.startdate,
    endDate: row.enddate,
    flexibleMonth: row.flexiblemonth,
    durationDays: row.durationdays,
    travelers: row.travelers,
    budget: { amount: Number(row.budgetamount), currency: row.budgetcurrency },
    estimatedCost: row.estimatedcost == null ? null : Number(row.estimatedcost),
    tripStyles: row.tripstyles ?? [],
    cuisines: row.cuisines ?? [],
    baggage: row.baggage,
    preferences: row.preferences ?? {},
    createdAt: row.createdat,
    updatedAt: row.updatedat,
  };
}

function toStop(row) {
  return {
    id: row.id,
    sortOrder: row.sortorder,
    name: row.name,
    kind: row.kind,
    suggestedTime: row.suggestedtime,
    durationMinutes: row.durationminutes,
    notes: row.notes,
    address: row.address,
    lat: row.lat == null ? null : Number(row.lat),
    lon: row.lon == null ? null : Number(row.lon),
    priceLevel: row.pricelevel,
    rating: row.rating == null ? null : Number(row.rating),
    googlePlaceId: row.googleplaceid,
  };
}

/** Loads a trip plus its nested days and stops, scoped to the owner. */
async function loadFullTrip(tripId, userId) {
  const tripResult = await query('SELECT * FROM trip WHERE id = $1 AND userId = $2', [
    tripId,
    userId,
  ]);
  if (tripResult.rows.length === 0) return null;

  const days = await query(
    'SELECT * FROM itinerary_day WHERE tripId = $1 ORDER BY dayNumber',
    [tripId],
  );
  const stops = await query(
    `SELECT s.* FROM itinerary_stop s
     JOIN itinerary_day d ON d.id = s.dayId
     WHERE d.tripId = $1
     ORDER BY d.dayNumber, s.sortOrder`,
    [tripId],
  );

  const stopsByDay = new Map();
  for (const row of stops.rows) {
    if (!stopsByDay.has(row.dayid)) stopsByDay.set(row.dayid, []);
    stopsByDay.get(row.dayid).push(toStop(row));
  }

  return {
    ...toTrip(tripResult.rows[0]),
    hasItinerary: days.rows.length > 0,
    days: days.rows.map((d) => ({
      id: d.id,
      dayNumber: d.daynumber,
      areaName: d.areaname,
      summary: d.summary,
      stops: stopsByDay.get(d.id) ?? [],
    })),
  };
}

router.get('/', async (req, res) => {
  try {
    // The day count rides along so the list can show which trips are planned
    // without loading every stop for every trip.
    const result = await query(
      `SELECT t.*, COUNT(d.id)::int AS daycount
       FROM trip t
       LEFT JOIN itinerary_day d ON d.tripId = t.id
       WHERE t.userId = $1
       GROUP BY t.id
       ORDER BY t.createdAt DESC`,
      [req.user.id],
    );
    res.json(result.rows.map((row) => ({ ...toTrip(row), hasItinerary: row.daycount > 0 })));
  } catch (err) {
    console.error('list trips failed:', err.message);
    res.status(500).json({ error: 'Could not load your trips.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const trip = await loadFullTrip(Number(req.params.id), req.user.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    res.json(trip);
  } catch (err) {
    console.error('get trip failed:', err.message);
    res.status(500).json({ error: 'Could not load the trip.' });
  }
});

/**
 * Saves a trip plan. Deliberately does NOT call Claude — saving is free and
 * instant, generation costs money and can fail, so they are separate steps.
 * Generate afterwards with POST /api/trips/:id/itinerary.
 */
router.post('/', async (req, res) => {
  const error = validatePreferences(req.body);
  if (error) return res.status(400).json({ error });

  const destination = getDestination(req.body.destinationId);
  if (!destination) return res.status(400).json({ error: 'Unknown destinationId.' });

  const durationDays = Number(req.body.durationDays);
  const travelers = Number(req.body.travelers ?? 1);
  const budget = Number(req.body.budget);

  const feasibility = assessFeasibility({
    destination,
    budget,
    durationDays,
    travelers,
    flightCostPerPerson: Number(req.body.flightCostPerPerson ?? 0),
  });

  if (!feasibility.feasible) {
    return res.status(422).json({
      error: 'This trip is not possible within that budget.',
      feasibility,
      lowestRealisticBudget: feasibility.floor.total,
    });
  }

  const title =
    String(req.body.title ?? '').trim() ||
    `${durationDays} days in ${destination.city}`;

  try {
    const result = await query(
      `INSERT INTO trip (
         userId, title, destinationId, destinationCity, destinationCountry,
         startDate, endDate, flexibleMonth, durationDays, travelers,
         budgetAmount, budgetCurrency, estimatedCost, tripStyles, cuisines,
         baggage, preferences
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id`,
      [
        req.user.id,
        title,
        destination.id,
        destination.city,
        destination.country,
        req.body.startDate || null,
        req.body.endDate || null,
        req.body.flexibleMonth || null,
        durationDays,
        travelers,
        budget,
        req.body.budgetCurrency ?? 'USD',
        feasibility.estimate.total,
        req.body.tripStyles ?? [],
        req.body.cuisines ?? [],
        req.body.baggage ?? 'carry_on',
        JSON.stringify({ tier: feasibility.tier, breakdown: feasibility.estimate.breakdown }),
      ],
    );

    res.status(201).json(await loadFullTrip(result.rows[0].id, req.user.id));
  } catch (err) {
    console.error('save trip failed:', err.message);
    res.status(500).json({ error: 'Could not save the trip.' });
  }
});

/**
 * Generates the day-by-day itinerary for an already-saved trip. Replaces any
 * existing itinerary, so this doubles as "regenerate".
 */
router.post('/:id/itinerary', async (req, res) => {
  const tripId = Number(req.params.id);

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: 'Itinerary generation is not configured yet. Add ANTHROPIC_API_KEY to backend/.env.',
    });
  }

  let trip;
  try {
    trip = await loadFullTrip(tripId, req.user.id);
  } catch (err) {
    console.error('load for generation failed:', err.message);
    return res.status(500).json({ error: 'Could not load the trip.' });
  }
  if (!trip) return res.status(404).json({ error: 'Trip not found.' });

  const destination = getDestination(trip.destination.id);
  if (!destination) return res.status(400).json({ error: 'Trip references an unknown destination.' });

  let generated;
  try {
    generated = await generateItinerary({
      trip: {
        destination,
        tier: trip.preferences?.tier ?? 'midRange',
        durationDays: trip.durationDays,
        travelers: trip.travelers,
        tripStyles: trip.tripStyles,
        cuisines: trip.cuisines,
      },
      // TODO: real Google Places results once that integration lands.
      places: req.body?.places ?? { attractions: [], restaurants: [] },
    });
  } catch (err) {
    console.error('generation failed:', err.message);
    return res.status(err.status ?? 502).json({ error: err.message });
  }

  try {
    await withTransaction(async (client) => {
      // Regenerating replaces the previous plan; stops cascade from days.
      await client.query('DELETE FROM itinerary_day WHERE tripId = $1', [tripId]);

      for (const day of generated.itinerary.days) {
        const dayResult = await client.query(
          `INSERT INTO itinerary_day (tripId, dayNumber, areaName, summary)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [tripId, day.dayNumber, day.areaName, day.summary],
        );
        const dayId = dayResult.rows[0].id;

        for (const [index, stop] of day.stops.entries()) {
          await client.query(
            `INSERT INTO itinerary_stop
               (dayId, sortOrder, name, kind, suggestedTime, durationMinutes, notes, googlePlaceId)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              dayId,
              index,
              stop.name,
              stop.kind,
              stop.suggestedTime,
              stop.durationMinutes,
              stop.notes,
              stop.googlePlaceId || null,
            ],
          );
        }
      }

      await client.query(
        `UPDATE trip SET title = $1, preferences = preferences || $2::jsonb, updatedAt = NOW()
         WHERE id = $3`,
        [
          generated.itinerary.tripTitle,
          JSON.stringify({ overview: generated.itinerary.overview }),
          tripId,
        ],
      );
    });

    res.json(await loadFullTrip(tripId, req.user.id));
  } catch (err) {
    console.error('save itinerary failed:', err.message);
    res.status(500).json({ error: 'The itinerary was generated but could not be saved.' });
  }
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const fields = [];
  const values = [];

  for (const [key, column] of Object.entries({
    title: 'title',
    startDate: 'startDate',
    endDate: 'endDate',
  })) {
    if (req.body[key] !== undefined) {
      values.push(req.body[key] || null);
      fields.push(`${column} = $${values.length}`);
    }
  }

  if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

  values.push(id, req.user.id);
  try {
    const result = await query(
      `UPDATE trip SET ${fields.join(', ')}, updatedAt = NOW()
       WHERE id = $${values.length - 1} AND userId = $${values.length}
       RETURNING id`,
      values,
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found.' });
    res.json(await loadFullTrip(id, req.user.id));
  } catch (err) {
    console.error('update trip failed:', err.message);
    res.status(500).json({ error: 'Could not update the trip.' });
  }
});

/** Edit one stop — the "tweak later" path from the brief. */
router.patch('/:tripId/stops/:stopId', async (req, res) => {
  const tripId = Number(req.params.tripId);
  const stopId = Number(req.params.stopId);

  const columns = {
    name: 'name',
    kind: 'kind',
    suggestedTime: 'suggestedTime',
    durationMinutes: 'durationMinutes',
    notes: 'notes',
    sortOrder: 'sortOrder',
  };

  const fields = [];
  const values = [];
  for (const [key, column] of Object.entries(columns)) {
    if (req.body[key] !== undefined) {
      values.push(req.body[key]);
      fields.push(`${column} = $${values.length}`);
    }
  }
  if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

  values.push(stopId, tripId, req.user.id);
  try {
    // The join back to trip is what enforces ownership — without it any signed-in
    // user could edit a stop belonging to someone else's trip by guessing its id.
    const result = await query(
      `UPDATE itinerary_stop SET ${fields.join(', ')}
       WHERE id = $${values.length - 2}
         AND dayId IN (
           SELECT d.id FROM itinerary_day d
           JOIN trip t ON t.id = d.tripId
           WHERE d.tripId = $${values.length - 1} AND t.userId = $${values.length}
         )
       RETURNING id`,
      values,
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Stop not found.' });
    res.json(await loadFullTrip(tripId, req.user.id));
  } catch (err) {
    console.error('update stop failed:', err.message);
    res.status(500).json({ error: 'Could not update the stop.' });
  }
});

router.delete('/:tripId/stops/:stopId', async (req, res) => {
  const tripId = Number(req.params.tripId);
  try {
    const result = await query(
      `DELETE FROM itinerary_stop
       WHERE id = $1
         AND dayId IN (
           SELECT d.id FROM itinerary_day d
           JOIN trip t ON t.id = d.tripId
           WHERE d.tripId = $2 AND t.userId = $3
         )
       RETURNING id`,
      [Number(req.params.stopId), tripId, req.user.id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Stop not found.' });
    res.json(await loadFullTrip(tripId, req.user.id));
  } catch (err) {
    console.error('delete stop failed:', err.message);
    res.status(500).json({ error: 'Could not delete the stop.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM trip WHERE id = $1 AND userId = $2 RETURNING id', [
      Number(req.params.id),
      req.user.id,
    ]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found.' });
    res.json({ message: 'Trip deleted.' });
  } catch (err) {
    console.error('delete trip failed:', err.message);
    res.status(500).json({ error: 'Could not delete the trip.' });
  }
});

export default router;
