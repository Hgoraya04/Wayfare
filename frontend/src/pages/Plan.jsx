import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import Layout from '../components/Layout.jsx';
import { Button, Alert, Spinner, NumberField, Chip, Select } from '../components/ui.jsx';

const TRIP_STYLES = ['sightseeing', 'food', 'adventure'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const TIER_LABELS = { budget: 'Budget', midRange: 'Mid-range', luxury: 'Luxury' };

// Number inputs hand back strings, so coerce before formatting — otherwise a
// typed budget renders as a bare "300" instead of "$300".
const money = (n) => {
  const value = Number(n);
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
};

function MatchCard({ match }) {
  const { estimate } = match;
  const parts = [
    ['Lodging', estimate.breakdown.lodging],
    ['Food', estimate.breakdown.food],
    ['Getting around', estimate.breakdown.localTransport],
    ['Activities', estimate.breakdown.activities],
  ];

  return (
    <article className="rounded-2xl border border-sand bg-white/60 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl text-ink">{match.city}</h3>
          <p className="text-sm text-ink-soft">{match.country}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl text-ink">{money(estimate.total)}</p>
          <p className="text-xs text-ink-soft">
            total · {money(estimate.perPerson)} each
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-cream-deep px-2.5 py-1 text-xs text-ink-soft">
          {TIER_LABELS[estimate.tier]} comfort
        </span>
        {match.inSeason && (
          <span className="rounded-full bg-moss/10 px-2.5 py-1 text-xs text-moss">
            Good time to go
          </span>
        )}
        <span className="text-xs text-ink-soft">
          {money(match.headroom)} left over
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-sand pt-4 text-sm">
        {parts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="text-ink">{money(value)}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function NotEnough({ result, onUseSuggested }) {
  const cheapest = result.cheapestOption;
  return (
    <div className="rounded-2xl border border-terracotta/30 bg-terracotta/5 p-8">
      <h3 className="font-display text-2xl text-ink">Not quite enough — yet</h3>
      <p className="mt-3 max-w-xl text-ink-soft">{cheapest?.message}</p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-soft">
            Lowest budget that works
          </p>
          <p className="font-display text-3xl text-terracotta">
            {money(result.lowestRealisticBudget)}
          </p>
        </div>
        <Button onClick={() => onUseSuggested(result.lowestRealisticBudget)}>
          Try this budget
        </Button>
      </div>

      <p className="mt-5 text-sm text-ink-soft">
        That's {cheapest?.city} at the most economical level. Fewer days or fewer
        travellers would also bring it down.
      </p>
    </div>
  );
}

export default function Plan() {
  const [budget, setBudget] = useState(2000);
  const [durationDays, setDurationDays] = useState(7);
  const [travelers, setTravelers] = useState(2);
  const [month, setMonth] = useState('');
  const [styles, setStyles] = useState([]);
  const [scope, setScope] = useState('anywhere');
  const [countries, setCountries] = useState([]);

  const [allCountries, setAllCountries] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/destinations')
      .then((list) => setAllCountries([...new Set(list.map((d) => d.country))].sort()))
      .catch(() => setAllCountries([]));
  }, []);

  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const summary = useMemo(
    () =>
      `${money(budget)} · ${durationDays} ${durationDays === 1 ? 'day' : 'days'} · ` +
      `${travelers} ${travelers === 1 ? 'traveller' : 'travellers'}`,
    [budget, durationDays, travelers],
  );

  async function search(overrideBudget) {
    const useBudget = overrideBudget ?? budget;
    if (overrideBudget) setBudget(overrideBudget);

    setBusy(true);
    setError('');
    try {
      const data = await api('/destinations/match', {
        method: 'POST',
        body: {
          budget: Number(useBudget),
          durationDays: Number(durationDays),
          travelers: Number(travelers),
          tripStyles: styles,
          month: month ? Number(month) : null,
          includeCountries: scope === 'only' ? countries : [],
          excludeCountries: scope === 'except' ? countries : [],
        },
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 max-w-2xl">
          <h1 className="font-display text-4xl leading-tight text-ink">
            What can your budget actually buy?
          </h1>
          <p className="mt-3 text-ink-soft">
            Tell us the shape of the trip. We'll show what's genuinely affordable —
            and if nothing is, the budget that would work.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          className="space-y-8 rounded-2xl border border-sand bg-white/60 p-8"
        >
          <div className="grid gap-5 sm:grid-cols-3">
            <NumberField
              label="Total budget" id="budget" prefix="$" min={1} required
              value={budget} onChange={(e) => setBudget(e.target.value)}
              hint="For everyone, whole trip"
            />
            <NumberField
              label="Trip length" id="days" suffix="days" min={1} max={60} required
              value={durationDays} onChange={(e) => setDurationDays(e.target.value)}
            />
            <NumberField
              label="Travellers" id="travelers" min={1} max={12} required
              value={travelers} onChange={(e) => setTravelers(e.target.value)}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Select label="When" id="month" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">I'm flexible</option>
              {MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </Select>

            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-ink">Trip style</span>
              <div className="flex flex-wrap gap-2 pt-1.5">
                {TRIP_STYLES.map((style) => (
                  <Chip
                    key={style}
                    active={styles.includes(style)}
                    className="capitalize"
                    onClick={() => toggle(styles, setStyles, style)}
                  >
                    {style}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-ink">Where</legend>
            <div className="flex flex-wrap gap-2">
              {[
                ['anywhere', 'Anywhere in the world'],
                ['only', 'Only these countries'],
                ['except', 'Everywhere except'],
              ].map(([value, label]) => (
                <Chip key={value} active={scope === value} onClick={() => setScope(value)}>
                  {label}
                </Chip>
              ))}
            </div>

            {scope !== 'anywhere' && (
              <div className="flex flex-wrap gap-2 rounded-xl bg-cream-deep/50 p-4">
                {allCountries.map((country) => (
                  <Chip
                    key={country}
                    active={countries.includes(country)}
                    onClick={() => toggle(countries, setCountries, country)}
                  >
                    {country}
                  </Chip>
                ))}
              </div>
            )}
          </fieldset>

          <div className="flex flex-wrap items-center gap-4 border-t border-sand pt-6">
            <Button type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Show me what fits'}
            </Button>
            <span className="text-sm text-ink-soft">{summary}</span>
          </div>
        </form>

        <div className="mt-10 space-y-6">
          <Alert>{error}</Alert>
          {busy && <Spinner label="Pricing your trip" />}

          {!busy && result?.feasible === false && (
            <NotEnough result={result} onUseSuggested={(b) => search(b)} />
          )}

          {!busy && result?.feasible && (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl text-ink">
                  {result.matches.length} {result.matches.length === 1 ? 'place' : 'places'} fit
                </h2>
                <p className="text-sm text-ink-soft">
                  out of {result.consideredCount} considered
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {result.matches.map((match) => (
                  <MatchCard key={match.destinationId} match={match} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </Layout>
  );
}
