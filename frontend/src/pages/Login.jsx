import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Field, Alert } from '../components/ui.jsx';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('demo@wayfare.app');
  const [password, setPassword] = useState('demo1234');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isRegister) await register(email, password, fullName);
      else await login(email, password);
      navigate('/destinations');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-ink-soft">Wayfare</p>
          <h1 className="font-display text-4xl leading-tight text-ink">
            {isRegister ? 'Start planning' : 'Welcome back'}
          </h1>
          <p className="mt-3 text-ink-soft">
            {isRegister
              ? 'Create an account to save and edit your trips.'
              : 'Sign in to pick up where you left off.'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-sand bg-white/60 p-8 shadow-sm"
        >
          <Alert>{error}</Alert>

          {isRegister && (
            <Field
              label="Your name"
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Alex Traveller"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )}

          <Field
            label="Email"
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Field
            label="Password"
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'One moment…' : isRegister ? 'Create account' : 'Sign in'}
          </Button>

          <p className="text-center text-sm text-ink-soft">
            {isRegister ? 'Already have an account?' : 'New here?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(isRegister ? 'login' : 'register');
                setError('');
              }}
              className="font-medium text-terracotta underline underline-offset-4 hover:text-terracotta-dark"
            >
              {isRegister ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </form>

        {!isRegister && (
          <p className="mt-6 text-center text-xs text-ink-soft">
            Demo login is pre-filled — just press Sign in.
          </p>
        )}
      </div>
    </main>
  );
}
