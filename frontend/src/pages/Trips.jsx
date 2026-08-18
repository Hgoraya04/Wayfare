import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Layout from '../components/Layout.jsx';
import { Button, Alert, Spinner } from '../components/ui.jsx';

const TIER_LABELS = { budget: 'Budget', midRange: 'Mid-range', luxury: 'Luxury' };

const money = (n) => {
  const value = Number(n);
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
};

function TripCard({ trip, onDelete, onGenerate, busyId }) {
  const busy = busyId === trip.id;
  const [confirming, setConfirming] = useState(false);

  return (
    <article className="rounded-2xl border border-sand bg-white/60 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-xl text-ink">{trip.title}</h3>
          <p className="text-sm text-ink-soft">
            {trip.destination.city}, {trip.destination.country} ·{' '}
            {trip.travelers} {trip.travelers === 1 ? 'traveller' : 'travellers'}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl text-ink">{money(trip.estimatedCost)}</p>
          <p className="text-xs text-ink-soft">of {money(trip.budget.amount)} budget</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {trip.preferences?.tier && (
          <span className="rounded-full bg-cream-deep px-2.5 py-1 text-xs text-ink-soft">
            {TIER_LABELS[trip.preferences.tier]} comfort
          </span>
        )}
        {trip.tripStyles.map((style) => (
          <span
            key={style}
            className="rounded-full bg-cream-deep px-2.5 py-1 text-xs capitalize text-ink-soft"
          >
            {style}
          </span>
        ))}
        <span
          className={`rounded-full px-2.5 py-1 text-xs ${
            trip.hasItinerary ? 'bg-moss/10 text-moss' : 'bg-cream-deep text-ink-soft'
          }`}
        >
          {trip.hasItinerary ? `${trip.days?.length ?? ''} day plan` : 'No itinerary yet'}
        </span>
      </div>

      <div className="mt-5 border-t border-sand pt-4">
        {confirming ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-ink">Delete this trip?</span>
            <Button
              onClick={() => onDelete(trip)}
              disabled={busy}
              className="px-5 py-2 text-sm"
            >
              {busy ? 'Deleting…' : 'Yes, delete'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="px-5 py-2 text-sm"
            >
              Keep it
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onGenerate(trip)} disabled={busy} className="px-5 py-2 text-sm">
              {busy ? 'Working…' : trip.hasItinerary ? 'Regenerate plan' : 'Generate itinerary'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirming(true)}
              disabled={busy}
              className="px-5 py-2 text-sm"
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function Trips() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  function load() {
    return api('/trips')
      .then(setTrips)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(trip) {
    setBusyId(trip.id);
    setError('');
    try {
      await api(`/trips/${trip.id}`, { method: 'DELETE' });
      setTrips((current) => current.filter((t) => t.id !== trip.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleGenerate(trip) {
    setBusyId(trip.id);
    setError('');
    setNotice('');
    try {
      const updated = await api(`/trips/${trip.id}/itinerary`, { method: 'POST', body: {} });
      setTrips((current) => current.map((t) => (t.id === trip.id ? updated : t)));
      setNotice(`Built a ${updated.days.length}-day plan for ${updated.destination.city}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 max-w-2xl">
          <h1 className="font-display text-4xl leading-tight text-ink">Your trips</h1>
          <p className="mt-3 text-ink-soft">
            Saved plans stay editable. Generate an itinerary whenever you're ready.
          </p>
        </div>

        {loading && <Spinner label="Loading your trips" />}
        <div className="space-y-4">
          <Alert>{error}</Alert>
          {notice && (
            <div className="rounded-xl border border-moss/30 bg-moss/5 px-4 py-3 text-sm text-moss">
              {notice}
            </div>
          )}
        </div>

        {!loading && trips.length === 0 && !error && (
          <div className="rounded-2xl border border-dashed border-sand p-12 text-center">
            <p className="font-display text-xl text-ink">Nothing saved yet</p>
            <p className="mt-2 text-ink-soft">
              Find something affordable on the planner, then save it here.
            </p>
          </div>
        )}

        {trips.length > 0 && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                busyId={busyId}
                onDelete={handleDelete}
                onGenerate={handleGenerate}
              />
            ))}
          </div>
        )}
      </main>
    </Layout>
  );
}
