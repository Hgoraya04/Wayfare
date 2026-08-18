import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { signToken, authenticate } from '../middleware/auth.js';

const router = express.Router();

function toUser(row) {
  return { id: row.id, email: row.email, fullName: row.fullname };
}

router.post('/register', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const fullName = String(req.body?.fullName ?? '').trim() || null;

  if (!email.includes('@')) return res.status(400).json({ error: 'A valid email is required.' });
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const existing = await query('SELECT id FROM usercredentials WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'That email is already registered.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO usercredentials (email, password, fullName)
       VALUES ($1, $2, $3)
       RETURNING id, email, fullName`,
      [email, hash, fullName],
    );

    const user = toUser(result.rows[0]);
    res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    console.error('register failed:', err.message);
    res.status(500).json({ error: 'Could not create the account.' });
  }
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  try {
    const result = await query(
      'SELECT id, email, password, fullName FROM usercredentials WHERE email = $1',
      [email],
    );
    const row = result.rows[0];

    // Same response whether the email is unknown or the password is wrong, so
    // this endpoint can't be used to enumerate registered accounts.
    if (!row || !(await bcrypt.compare(password, row.password))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const user = toUser(row);
    res.json({ user, token: signToken(user) });
  } catch (err) {
    console.error('login failed:', err.message);
    res.status(500).json({ error: 'Could not sign you in.' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, fullName FROM usercredentials WHERE id = $1',
      [req.user.id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json(toUser(result.rows[0]));
  } catch (err) {
    console.error('me failed:', err.message);
    res.status(500).json({ error: 'Could not load your account.' });
  }
});

export default router;
