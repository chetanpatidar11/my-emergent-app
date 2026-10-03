export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Page({ children }) {
  return <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto fade-up">{children}</div>;
}

export function Card({ children, className = "" }) {
  return <div className={`card-glass rounded-xl p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function Btn({ children, variant = "primary", className = "", ...p }) {
  const styles = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    ghost: "bg-white/5 text-white hover:bg-white/10",
    danger: "bg-destructive/15 text-destructive hover:bg-destructive/25",
    accent: "bg-accent text-white hover:opacity-90",
  };
  return (
    <button {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50 ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Field({ label, ...p }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input {...p}
        className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary" />
    </label>
  );
}

export function Select({ label, children, ...p }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select {...p}
        className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary">
        {children}
      </select>
    </label>
  );
}

export function Badge({ children, tone = "muted" }) {
  const tones = {
    green: "bg-primary/15 text-primary",
    blue: "bg-accent/15 text-accent",
    amber: "bg-yellow-500/15 text-yellow-400",
    red: "bg-destructive/15 text-destructive",
    muted: "bg-white/8 text-muted-foreground",
  };
  return <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card-glass rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-head text-xl font-bold text-white mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
