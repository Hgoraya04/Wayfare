import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5';

let client;

function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set. Add it to backend/.env');
    }
    client = new Anthropic();
  }
  return client;
}

/**
 * Structured-output schema. Claude is constrained to return exactly this shape,
 * so we never parse JSON out of prose and never need a retry-on-bad-JSON loop.
 *
 * Schema limits worth knowing: every object needs `additionalProperties: false`
 * and a `required` listing all its properties. Numeric/length constraints
 * (minimum, maxLength, ...) are not supported — validate those ourselves.
 */
const ITINERARY_SCHEMA = {
  type: 'object',
  properties: {
    tripTitle: { type: 'string' },
    overview: { type: 'string' },
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dayNumber: { type: 'integer' },
          areaName: { type: 'string' },
          summary: { type: 'string' },
          stops: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                kind: {
                  type: 'string',
                  enum: ['attraction', 'restaurant', 'activity', 'transit'],
                },
                suggestedTime: { type: 'string' },
                durationMinutes: { type: 'integer' },
                notes: { type: 'string' },
                googlePlaceId: { type: 'string' },
              },
              required: [
                'name',
                'kind',
                'suggestedTime',
                'durationMinutes',
                'notes',
                'googlePlaceId',
              ],
              additionalProperties: false,
            },
          },
        },
        required: ['dayNumber', 'areaName', 'summary', 'stops'],
        additionalProperties: false,
      },
    },
  },
  required: ['tripTitle', 'overview', 'days'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You plan day-by-day travel itineraries from structured data.

You are given a destination, a trip length, a traveler count, a budget tier, and
lists of real places (attractions and restaurants) already filtered by price and
rating. Build an itinerary that uses those places.

Rules:
- Group each day around ONE geographic area. Never send travelers back and forth
  across a city on the same day; walking distance between consecutive stops is
  the thing to optimize.
- Use only places from the supplied lists. Do not invent venues. Copy each
  place's googlePlaceId exactly as given; use an empty string for a stop that is
  not from the lists (a walk, a transit leg, free time).
- Give every stop a suggestedTime as 24-hour "HH:MM", in ascending order within
  a day, and a realistic durationMinutes.
- Work meals into the day at sensible hours, drawn from the restaurant list and
  matching the traveler's stated cuisines where possible.
- Respect the budget tier: at the budget tier prefer free and low-cost stops.
- Keep each day to a realistic pace — roughly 3 to 6 stops, fewer for long ones.`;

/**
 * Generates an itinerary. `places` is the Google Places output; `trip` carries
 * the resolved destination, tier, and preferences.
 *
 * Throws on API failure so the route can map it to a 502 — callers should not
 * receive a half-built itinerary.
 */
export async function generateItinerary({ trip, places }) {
  const userPrompt = buildPrompt({ trip, places });

  let response;
  try {
    response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      // Adaptive thinking is the default on Opus 5; stated explicitly so the
      // intent survives a future model swap. `effort` is the cost/latency lever —
      // medium is a good balance here; raise to "high" if plans feel shallow.
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: ITINERARY_SCHEMA },
      },
      messages: [{ role: 'user', content: userPrompt }],
    });
  } catch (err) {
    throw mapAnthropicError(err);
  }

  // Check stop_reason before touching content — on a refusal the content array
  // is empty, and on max_tokens the JSON is truncated and will not parse.
  if (response.stop_reason === 'refusal') {
    throw Object.assign(new Error('The itinerary request was declined.'), { status: 502 });
  }
  if (response.stop_reason === 'max_tokens') {
    throw Object.assign(
      new Error('The itinerary was too long to finish. Try a shorter trip.'),
      { status: 502 },
    );
  }

  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) {
    throw Object.assign(new Error('Claude returned no itinerary content.'), { status: 502 });
  }

  const itinerary = JSON.parse(text);
  return { itinerary, usage: response.usage };
}

function buildPrompt({ trip, places }) {
  const { destination, tier, durationDays, travelers, tripStyles = [], cuisines = [] } = trip;

  return [
    `Destination: ${destination.city}, ${destination.country}`,
    `Trip length: ${durationDays} days`,
    `Travelers: ${travelers}`,
    `Budget tier: ${tier}`,
    tripStyles.length ? `Trip style: ${tripStyles.join(', ')}` : null,
    cuisines.length ? `Preferred cuisines: ${cuisines.join(', ')}` : null,
    '',
    'Attractions available:',
    JSON.stringify(places.attractions ?? [], null, 2),
    '',
    'Restaurants available:',
    JSON.stringify(places.restaurants ?? [], null, 2),
    '',
    `Build a ${durationDays}-day itinerary grouped by area.`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Turns SDK error classes into something the route layer can return honestly. */
function mapAnthropicError(err) {
  if (err instanceof Anthropic.RateLimitError) {
    return Object.assign(new Error('Itinerary service is rate limited. Try again shortly.'), {
      status: 429,
    });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return Object.assign(new Error('Itinerary service is misconfigured.'), { status: 500 });
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return Object.assign(new Error('Could not reach the itinerary service.'), { status: 502 });
  }
  if (err instanceof Anthropic.APIError) {
    return Object.assign(new Error(`Itinerary service error: ${err.message}`), { status: 502 });
  }
  return err;
}

export const __testables = { ITINERARY_SCHEMA, buildPrompt, SYSTEM_PROMPT };
