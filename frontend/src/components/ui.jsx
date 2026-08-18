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

/** Number input with a leading unit, e.g. "$" or "days". */
export function NumberField({ label, id, prefix, suffix, hint, ...props }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="flex items-center rounded-xl border border-sand bg-white focus-within:border-terracotta focus-within:ring-2 focus-within:ring-terracotta/20">
        {prefix && <span className="pl-4 text-ink-soft">{prefix}</span>}
        <input
          id={id}
          type="number"
          className="w-full bg-transparent px-3 py-3 text-ink focus:outline-none"
          {...props}
        />
        {suffix && <span className="pr-4 text-sm text-ink-soft">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

/** Toggleable pill, used for trip styles and country filters. */
export function Chip({ active, children, className = '', ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${className} ${
        active
          ? 'border-terracotta bg-terracotta text-cream'
          : 'border-sand bg-white text-ink-soft hover:border-terracotta/40 hover:text-ink'
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Select({ label, id, children, ...props }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        className="w-full appearance-none rounded-xl border border-sand bg-white px-4 py-3 text-ink
                   focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
