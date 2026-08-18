import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import tripRoutes from './routes/tripRoutes.js';
import destinationRoutes from './routes/destinationRoutes.js';

/**
 * Built separately from server.js so tests can mount the app with supertest
 * without opening a port.
 */
export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/destinations', destinationRoutes);
  app.use('/api/trips', tripRoutes);

  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

  // Express 5 forwards rejected promises here automatically, so an unexpected
  // throw in any route lands as JSON instead of an HTML stack trace.
  app.use((err, req, res, next) => {
    console.error('unhandled:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Something went wrong.' });
  });

  return app;
}
