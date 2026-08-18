import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './ui.jsx';

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-full px-4 py-2 text-sm transition-colors ${
          isActive ? 'bg-cream-deep text-ink' : 'text-ink-soft hover:text-ink'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-sand">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-5">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Wayfare</p>
          <nav className="flex items-center gap-1">
            <NavItem to="/plan">Plan a trip</NavItem>
            <NavItem to="/destinations">Destinations</NavItem>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <span className="hidden text-sm text-ink-soft sm:inline">
                {user.fullName ?? user.email}
              </span>
            )}
            <Button variant="ghost" onClick={logout} className="px-4 py-2">
              Sign out
            </Button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
