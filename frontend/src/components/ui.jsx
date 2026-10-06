import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Inbox, Loader2, AlertTriangle } from "lucide-react";

export function cx(...a) { return a.filter(Boolean).join(" "); }

export function Card({ className, children, ...p }) {
  return (
    <div className={cx("premium-card bg-surface rounded-2xl border border-line/90 shadow-card transition-[transform,box-shadow,border-color] duration-300", className)} {...p}>
      {children}
    </div>
  );
}

export function Button({ variant = "primary", size = "md", className, children, ...p }) {
  const variants = {
    primary: "bg-brand text-white hover:bg-brand-hover shadow-xs",
    secondary: "bg-white text-ink border border-line hover:bg-muted",
    ghost: "text-subink hover:bg-muted",
    danger: "bg-expense text-white hover:brightness-95",
    dark: "bg-ink text-white hover:bg-slate-800",
  };
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-11 px-5 text-sm" };
  return (
    <button
      className={cx("btn-depth inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-[transform,box-shadow,background-color,color] duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none active:scale-[.98]",
        variants[variant], sizes[size], className)}
      {...p}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, className }) {
  return (
    <label className={cx("block", className)}>
      {label && <span className="overline text-faint block mb-1.5">{label}</span>}
      {children}
    </label>
  );
}

const inputCls = "w-full h-10 px-3 rounded-lg border border-line bg-white text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition";

export function Input({ className, ...p }) { return <input className={cx(inputCls, className)} {...p} />; }

export function DatalistInput({ options = [], listId, className, ...p }) {
  const id = listId || `dl-${Math.random().toString(36).slice(2)}`;
  return (
    <>
      <input list={id} className={cx(inputCls, className)} {...p} />
      <datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist>
    </>
  );
}
export function Textarea({ className, ...p }) { return <textarea className={cx(inputCls, "h-auto py-2 min-h-[76px]", className)} {...p} />; }
export function Select({ className, children, ...p }) {
  return <select className={cx(inputCls, "appearance-none bg-no-repeat pr-8", className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: "right 10px center" }} {...p}>{children}</select>;
}

const badgeMap = {
  green: "text-emerald-700 bg-emerald-50 border-emerald-200",
  red: "text-rose-700 bg-rose-50 border-rose-200",
  amber: "text-amber-700 bg-amber-50 border-amber-200",
  blue: "text-sky-700 bg-sky-50 border-sky-200",
  gray: "text-slate-600 bg-slate-100 border-slate-200",
  brand: "text-teal-700 bg-teal-50 border-teal-200",
};
export function Badge({ tone = "gray", children, className }) {
  return <span className={cx("badge-chip inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border", badgeMap[tone] || badgeMap.gray, className)}>{children}</span>;
}

const statusTones = {
  ACTIVE: "blue", PARTIALLY_REPAID: "amber", FULLY_REPAID: "green", OVERDUE: "red", WRITTEN_OFF: "gray",
  COLLECTED: "green", PARTIAL: "amber", PENDING: "amber", PLANNING: "gray", ON_HOLD: "amber",
  COMPLETED: "green", ARCHIVED: "gray", OCCUPIED: "green", VACANT: "gray",
};
export function StatusBadge({ status }) {
  if (!status) return null;
  return <Badge tone={statusTones[status] || "gray"}>{status.replace(/_/g, " ").toLowerCase()}</Badge>;
}

export function Modal({ open, onClose, title, children, size = "md", panelClassName, contentClassName }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" data-testid="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-backdrop absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className={cx("modal-panel relative bg-surface w-full rounded-t-2xl sm:rounded-2xl shadow-pop border border-line animate-fade-up max-h-[92vh] overflow-y-auto", w, panelClassName)}>
        <div className="sticky top-0 bg-surface/95 backdrop-blur border-b border-line px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-display font-semibold text-lg text-ink">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-subink" data-testid="modal-close"><X size={18} /></button>
        </div>
        <div className={cx("p-5", contentClassName)}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function DetailDrawer({ open, onClose, title, eyebrow, children, actions }) {
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(<div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={title}><button aria-label="Close detail panel" className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px]" onClick={onClose}/><aside className="detail-drawer absolute right-0 top-0 h-full w-full max-w-[34rem] bg-white border-l border-line shadow-2xl animate-[slide-in_.22s_cubic-bezier(.16,1,.3,1)] overflow-y-auto"><div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-line px-6 py-5 flex items-start justify-between gap-4"><div><div className="overline text-faint">{eyebrow || "Financial detail"}</div><h2 className="font-display text-xl font-bold text-ink mt-1">{title}</h2></div><button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-subink" aria-label="Close"><X size={19}/></button></div><div className="p-6">{children}</div>{actions && <div className="sticky bottom-0 p-4 bg-white border-t border-line flex gap-2">{actions}</div>}</aside></div>, document.body);
}

export function Spinner({ className }) { return <Loader2 className={cx("animate-spin", className)} />; }

export function StateBlock({ loading, error, empty, emptyText = "No records yet", onRetry, children }) {
  if (loading) return <div className="space-y-4 py-2" aria-label="Loading"><div className="h-7 w-48 rounded bg-slate-200 animate-pulse"/><div className="grid sm:grid-cols-3 gap-3"><div className="h-28 rounded-xl bg-slate-100 animate-pulse"/><div className="h-28 rounded-xl bg-slate-100 animate-pulse"/><div className="h-28 rounded-xl bg-slate-100 animate-pulse"/></div><div className="h-64 rounded-xl bg-slate-100 animate-pulse"/></div>;
  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <AlertTriangle className="w-8 h-8 text-amber" />
      <p className="text-sm text-subink">Couldn't load data.</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  );
  if (empty) return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center"><Inbox className="w-6 h-6 text-faint" /></div>
      <p className="text-sm text-subink">{emptyText}</p>
    </div>
  );
  return children;
}

export function PageHeader({ title, subtitle, actions, icon: Icon }) {
  return (
    <div className="page-header flex flex-wrap items-center justify-between gap-4 mb-7">
      <div className="flex min-w-0 items-center gap-4">
        {Icon && <div className="page-header__icon w-12 h-12 rounded-2xl bg-white text-brand flex items-center justify-center shrink-0"><Icon size={22} /></div>}
        <div>
          <h1 className="page-header__title font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="text-sm text-subink mt-1">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-header__actions flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Segmented({ options, value, onChange, testid }) {
  return (
    <div className="inline-flex bg-muted rounded-lg p-0.5 border border-line" data-testid={testid}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cx("px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
            value === o.value ? "bg-white text-ink shadow-xs" : "text-subink hover:text-ink")}
          data-testid={`seg-${o.value}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
