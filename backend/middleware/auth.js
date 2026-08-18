import jwt from 'jsonwebtoken';

const TOKEN_TTL = '7d';

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error('JWT_SECRET is not set. Add it to backend/.env');
  }
  return value;
}

export function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, secret(), { expiresIn: TOKEN_TTL });
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    req.user = jwt.verify(token, secret());
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}
