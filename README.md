# Wayfare — AI Travel Planner

Plan a trip by describing what you want, not by searching for it. Wayfare checks
whether your budget is realistic, and if it is, builds a day-by-day itinerary
that groups nearby stops together so you aren't crossing the city twice a day.

If your budget *isn't* realistic, it says so — and tells you the lowest budget
that would actually work for those preferences, instead of returning nothing.

> **Live demo:** _coming soon_
> **Status:** backend working · frontend started

<!-- TODO: demo GIF here. Recruiters watch this before they read anything else. -->

---

## What it does

- **Multi-step preferences form** — dates or a flexible month, trip length,
  budget, countries to include or exclude (or "anywhere"), baggage, trip style,
  and favourite cuisines.
- **Budget reality check** — before generating anything, Wayfare prices the trip
  across three tiers (budget / mid-range / luxury) and picks the best one your
  money covers. Too low, and it returns the exact shortfall.
- **Geographic day grouping** — each day is built around one area, with a
  suggested visit time and realistic duration per stop.
- **Restaurant matching** — filtered by price level, rating, and your cuisines.
- **Saved trips** — every itinerary is stored per user and stays editable. You
  can rename it, retime a stop, or delete one entirely.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + React Router 7 (Vite) |
| Backend | Node.js + Express 5 (ESM) |
| Database | PostgreSQL (raw SQL via `pg`, no ORM) |
| Auth | JWT + bcrypt |
| AI | Claude API (`claude-opus-5`) with structured outputs |
| Places | Google Places API (New) |
| Flights | Duffel API (test mode) |
| Tests | Jest + Supertest |

### Why structured outputs

Itinerary generation uses Claude's `output_config.format` with a JSON schema, so
the model is *constrained* to return the exact shape the database expects. There
is no "parse JSON out of a paragraph" step and no retry-on-malformed-JSON loop —
the response either matches the schema or the request fails loudly.

## Architecture

```
React (Vite)
     │
     ▼
Express API ──┬── Claude API         → day-by-day plan over the structured data
              ├── Google Places API  → restaurants + attractions, price/rating filtered
              └── Duffel API         → flight price estimates (test mode)
     │
     ▼
PostgreSQL ── users · trips · itinerary_day · itinerary_stop
```

The budget engine (`backend/services/budgetService.js`) is deliberately
dependency-free — it takes a destination, a duration, and a party size, and
returns costs. That's why it's fully unit-tested without a database, a network,
or an API key.

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL database ([Neon](https://neon.tech)'s free tier works and doesn't
  expire)

### Setup

```bash
git clone https://github.com/<your-username>/wayfare.git
cd wayfare/backend
npm install
cp .env.example .env
```

Fill in `.env` — see the table below — then create the schema:

```bash
npm run db:setup
npm run db:seed     # optional: adds a demo user
npm run dev
```

The API comes up on `http://localhost:4000`.

Then, in a second terminal, start the web app:

```bash
cd wayfare/frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to the backend, so nothing is
hardcoded and there's no CORS setup in dev.

If you ran `npm run db:seed`, sign in with **demo@wayfare.app** / **demo1234**.

### Environment variables

| Variable | Required | Where to get it |
|---|---|---|
| `DATABASE_URL` | yes | Neon dashboard (keep the `?sslmode=require` suffix) |
| `JWT_SECRET` | yes | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ANTHROPIC_API_KEY` | for generation | [console.anthropic.com](https://console.anthropic.com) |
| `GOOGLE_PLACES_API_KEY` | for places | Google Cloud → Places API (New). Billing must be on even for the free tier. |
| `DUFFEL_API_TOKEN` | for flights | app.duffel.com → Developers. Use the **test** token. |
| `PORT` | no | Defaults to `4000` |

`.env` is gitignored. Don't commit it.

## API

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | — | Liveness check |
| `POST` | `/api/auth/register` | — | Create an account |
| `POST` | `/api/auth/login` | — | Sign in, returns a JWT |
| `GET` | `/api/auth/me` | ✓ | Current user |
| `GET` | `/api/destinations` | — | All curated destinations |
| `GET` | `/api/destinations/:id` | — | One destination with full cost table |
| `POST` | `/api/destinations/match` | — | "Anywhere in the world" matching |
| `POST` | `/api/destinations/:id/feasibility` | — | Budget check for one destination |
| `GET` | `/api/trips` | ✓ | Your saved trips |
| `GET` | `/api/trips/:id` | ✓ | One trip with days and stops |
| `POST` | `/api/trips` | ✓ | Generate and save an itinerary |
| `PATCH` | `/api/trips/:id` | ✓ | Rename / change dates |
| `PATCH` | `/api/trips/:tripId/stops/:stopId` | ✓ | Edit a stop |
| `DELETE` | `/api/trips/:tripId/stops/:stopId` | ✓ | Remove a stop |
| `DELETE` | `/api/trips/:id` | ✓ | Delete a trip |

### Example: budget too low

```bash
curl -X POST localhost:4000/api/destinations/match \
  -H 'Content-Type: application/json' \
  -d '{"budget":300,"durationDays":10,"travelers":4}'
```

```json
{
  "feasible": false,
  "matches": [],
  "lowestRealisticBudget": 1192,
  "cheapestOption": {
    "city": "Hanoi",
    "message": "A 10-day trip to Hanoi for 4 travelers needs about $1192 at the most economical level — $892 more than your budget."
  }
}
```

## How the budget math works

Costs come from a hand-curated dataset of 22 destinations
(`backend/data/destinations.json`), each with per-person-per-day figures for
lodging, food, local transport, and activities at three tiers.

There's no good free API for "what does travel cost in country X" at useful
granularity, so this is curated on purpose and versioned with the code.

Two details that matter:

- **Lodging is billed per night, not per day.** A 5-day trip is 4 nights.
  Charging 5 overstates the floor by a full night and wrongly rejects budgets
  that would actually work.
- **The floor is the budget tier, not an average.** "Lowest realistic budget"
  means the cheapest way to genuinely do the trip.

## Tests

```bash
npm test
```

29 tests covering the cost model, tier selection, the shortfall path, country
and style filtering, seasonal ranking, and input validation.

## Roadmap

- [x] Budget engine + curated destination dataset
- [x] Auth, trips, and itinerary persistence
- [x] Claude itinerary generation with structured outputs
- [ ] Google Places integration (restaurants + attractions)
- [ ] Duffel flight pricing (test mode)
- [x] React frontend — Tailwind theme, login, destination browser
- [x] Budget planner screen with the shortfall fallback
- [ ] Itinerary view + map
- [ ] Deploy (Vercel + Neon) and record the demo GIF
- [ ] Response caching and rate-limit guardrails

## Licence

MIT
