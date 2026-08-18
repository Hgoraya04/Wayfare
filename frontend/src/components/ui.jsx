/** Small shared primitives. Kept in one file while the set is this small. */

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium ' +
    'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' +
    'focus-visible:outline-terracotta disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-terracotta text-cream hover:bg-terracotta-dark',
    ghost: 'bg-transparent text-ink-soft hover:text-ink hover:bg-cream-deep',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Field({ label, id, error, ...props }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded-xl border border-sand bg-white px-4 py-3 text-ink
                   placeholder:text-ink-soft/50 focus:border-terracotta focus:outline-none
                   focus:ring-2 focus:ring-terracotta/20"
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />
      {error && <p className="text-sm text-terracotta-dark">{error}</p>}
    </div>
  );
}

export function Alert({ children }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-dark"
    >
      {children}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-3 text-ink-soft" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-sand border-t-terracotta" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}
