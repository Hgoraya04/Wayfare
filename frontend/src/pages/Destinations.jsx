import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Layout from '../components/Layout.jsx';
import { Alert, Spinner } from '../components/ui.jsx';

const REGION_ORDER = ['Europe', 'Europe/Asia', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'];

function DestinationCard({ destination }) {
  return (
    <article className="group rounded-2xl border border-sand bg-white/60 p-6 transition-colors hover:border-terracotta/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-xl text-ink">{destination.city}</h3>
          <p className="text-sm text-ink-soft">{destination.country}</p>
        </div>
        <div className="text-right whitespace-nowrap">
          <p className="font-display text-lg text-terracotta">${destination.fromPerDay}</p>
          <p className="text-xs text-ink-soft">per day</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {destination.tripStyles.map((style) => (
          <span
            key={style}
            className="rounded-full bg-cream-deep px-2.5 py-1 text-xs capitalize text-ink-soft"
          >
            {style}
          </span>
        ))}
      </div>
    </article>
  );
}

export default function Destinations() {
  const [destinations, setDestinations] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/destinations')
      .then(setDestinations)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const regions = [...new Set(destinations.map((d) => d.region))].sort(
    (a, b) => REGION_ORDER.indexOf(a) - REGION_ORDER.indexOf(b),
  );

  return (
    <Layout>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 max-w-2xl">
          <h1 className="font-display text-4xl leading-tight text-ink">
            Where do you want to go?
          </h1>
          <p className="mt-3 text-ink-soft">
            {destinations.length} destinations, priced from the cheapest realistic way to
            visit — lodging, food, local transport and activities, per person per day.
          </p>
        </div>

        {loading && <Spinner label="Loading destinations" />}
        <Alert>{error}</Alert>

        {!loading && !error && (
          <div className="space-y-12">
            {regions.map((region) => (
              <section key={region}>
                <h2 className="mb-5 text-xs uppercase tracking-[0.2em] text-ink-soft">
                  {region}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {destinations
                    .filter((d) => d.region === region)
                    .sort((a, b) => a.fromPerDay - b.fromPerDay)
                    .map((d) => (
                      <DestinationCard key={d.id} destination={d} />
                    ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </Layout>
  );
}
