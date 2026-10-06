import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ArrowLeftRight, Wallet, TrendingUp, CreditCard, Handshake, Inbox,
  PiggyBank, ShieldCheck, Building2, Scale, FolderKanban, Users,
  FileText, Settings, Plus, LogOut, Menu, X, Landmark, Umbrella, Sprout, LockKeyhole, Bell, BookOpen, BellRing, ChevronRight, CarFront, Target, ChevronDown, CalendarDays, Calculator, Clock3, Upload, Search, Sparkles, TrendingDown,
} from "lucide-react";
import { cx } from "./ui";
import { useAuth } from "../lib/auth";
import QuickAdd from "./QuickAdd";
import { Button } from "./ui";
import api, { apiError } from "../lib/api";
import { inr } from "../lib/format";
import { useFetch } from "../lib/useFetch";

const NAV = [
  {
    group: "Personal Finance",
    items: [
      { name: "Action Center", path: "/", icon: LayoutDashboard, tid: "nav-overview" },
      { name: "Review Inbox", path: "/review", icon: Inbox, tid: "nav-review" },
      { name: "Financial Planner", path: "/planner", icon: CalendarDays, tid: "nav-planner" },
      { name: "Calculators", path: "/calculators", icon: Calculator, tid: "nav-calculators" },
      { name: "Cash Flow", path: "/cash-flow", icon: ArrowLeftRight, tid: "nav-cash-flow" },
      { name: "Financial Calendar", path: "/calendar", icon: CalendarDays, tid: "nav-calendar" },
      { name: "Daily Spending", path: "/daily-spending", icon: CreditCard, tid: "nav-daily-spending" },
      { name: "Recurring Bills", path: "/recurring", icon: BellRing, tid: "nav-recurring" },
      { name: "Debt Payoff Planner", path: "/debt-payoff", icon: TrendingDown, tid: "nav-debt-payoff" },
      { name: "Data Quality", path: "/data-quality", icon: ShieldCheck, tid: "nav-data-quality" },
      { name: "Accounts & Cash", path: "/accounts", icon: Wallet, tid: "nav-accounts" },
      { name: "Income", path: "/income", icon: TrendingUp, tid: "nav-income" },
      { name: "Expenses", path: "/expenses", icon: CreditCard, tid: "nav-expenses" },
      { name: "Budgets & Plans", path: "/budgets", icon: Calculator, tid: "nav-budgets" },
      { name: "Lending & Borrowing", path: "/lending", icon: Handshake, tid: "nav-lending" },
      { name: "Savings & Investments", path: "/savings", icon: PiggyBank, tid: "nav-savings" },
      { name: "PF & PPF", path: "/pf-ppf", icon: ShieldCheck, tid: "nav-pf-ppf" },
      { name: "Loans", path: "/loans", icon: Landmark, tid: "nav-loans" },
      { name: "Insurance", path: "/insurance", icon: Umbrella, tid: "nav-insurance" },
      { name: "Rental Income", path: "/rental", icon: Building2, tid: "nav-rental" },
      { name: "Net Worth", path: "/net-worth", icon: Scale, tid: "nav-net-worth" },
      { name: "Losses", path: "/losses", icon: LockKeyhole, tid: "nav-losses" },
      { name: "Daily Diary", path: "/diary", icon: BookOpen, tid: "nav-diary" },
      { name: "Personal Necessities", path: "/necessities", icon: CarFront, tid: "nav-necessities" },
      { name: "Goals", path: "/goals", icon: Target, tid: "nav-goals" },
    ],
  },
  {
    group: "Projects & Farms",
    items: [
      { name: "All Projects", path: "/projects", icon: FolderKanban, tid: "nav-projects" },
      { name: "Farms & Farming", path: "/farms", icon: Sprout, tid: "nav-farms" },
    ],
  },
  {
    group: "Governance & Admin",
    items: [
      { name: "Family Members", path: "/family", icon: Users, tid: "nav-family" },
      { name: "Documents", path: "/documents", icon: FileText, tid: "nav-documents" },
      { name: "Import Center", path: "/smart-import", icon: Upload, tid: "nav-imports" },
      { name: "Settings", path: "/settings", icon: Settings, tid: "nav-settings" },
    ],
  },
];

const MOBILE = [
  { name: "Home", path: "/", icon: LayoutDashboard, tid: "mobile-nav-home" },
  { name: "Daily", path: "/daily-spending", icon: CreditCard, tid: "mobile-nav-daily" },
  { name: "Next", path: "/planner", icon: Target, tid: "mobile-nav-next" },
  { name: "Accounts", path: "/accounts", icon: Wallet, tid: "mobile-nav-accounts" },
  { name: "More", icon: Menu, tid: "mobile-nav-more" },
];

const HOUSEHOLD_NAV = [{
  group: "Shared household accounts",
  items: [
    { name: "Accounts & Cash", path: "/accounts", icon: Wallet, tid: "nav-accounts" },
    { name: "Daily Spending", path: "/daily-spending", icon: CreditCard, tid: "nav-daily-spending" },
    { name: "Income", path: "/income", icon: TrendingUp, tid: "nav-income" },
    { name: "Expenses", path: "/expenses", icon: CreditCard, tid: "nav-expenses" },
  ],
}];
const HOUSEHOLD_MOBILE = [
  { name: "Accounts", path: "/accounts", icon: Wallet, tid: "mobile-nav-accounts" },
  { name: "Daily", path: "/daily-spending", icon: CreditCard, tid: "mobile-nav-daily" },
  { name: "Income", path: "/income", icon: TrendingUp, tid: "mobile-nav-income" },
  { name: "Expenses", path: "/expenses", icon: CreditCard, tid: "mobile-nav-expenses" },
  { name: "More", icon: Menu, tid: "mobile-nav-more" },
];

function Brand({ version, onVersion }) {
  return (
    <div className="brand-lockup flex items-center gap-2.5">
      <img src="/brand/nivara-logo-mark.png" alt="" className="brand-mark h-11 w-11 rounded-xl border border-white/60 bg-white object-contain shadow-card" />
      <div className="leading-tight">
        <div className="brand-name font-sans font-extrabold text-[14px] tracking-[-.045em]">NIVARA <span>FINANCE</span></div>
        <div className="brand-tagline">BUILD · MANAGE · GROW <button onClick={onVersion} title="Open version control">V{version}</button></div>
      </div>
    </div>
  );
}

function NavItems({ onNavigate, collapsed = false }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const navGroups = user?.role === "HOUSEHOLD_USER" ? HOUSEHOLD_NAV : NAV;
  const [openGroups, setOpenGroups] = useState(() => Object.fromEntries(navGroups.map((group) => [group.group, false])));
  useEffect(() => {
    const activeGroup = navGroups.find((group) => group.items.some((item) => item.path === pathname || (item.path !== "/" && pathname.startsWith(`${item.path}/`))));
    if (activeGroup) setOpenGroups((current) => current[activeGroup.group] ? current : { ...current, [activeGroup.group]: true });
  }, [pathname, navGroups]);
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
      {navGroups.map((g) => (
        <div key={g.group}>
          {!collapsed && <button onClick={() => setOpenGroups((current) => ({ ...current, [g.group]: !current[g.group] }))} className="w-full overline text-faint px-3 mb-1.5 flex items-center justify-between hover:text-ink" aria-expanded={!!openGroups[g.group]}><span>{g.group}</span><ChevronDown size={13} className={cx("transition-transform", !openGroups[g.group] && "-rotate-90")}/></button>}
          <div className={cx("space-y-0.5", !collapsed && !openGroups[g.group] && "hidden")}>
            {g.items.map((it) => (
              <NavLink key={it.path} to={it.path} end={it.path === "/"} onClick={onNavigate} data-testid={it.tid}
                className={({ isActive }) => cx(
                  "app-nav-link flex items-center gap-3 px-3 py-2 rounded-lg text-[11px] font-bold transition-[background-color,color,transform,box-shadow]",
                  isActive ? "bg-gradient-to-r from-[#f3efff] to-[#f8fbff] text-brand-dark shadow-xs border-l-2 border-brand" : "text-subink hover:bg-muted hover:text-ink hover:translate-x-0.5"
                )} title={collapsed ? it.name : undefined}>
                <it.icon size={17} className="shrink-0" />
                {!collapsed && <span className="truncate">{it.name}</span>}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function HeaderClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer); }, []);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
  return <div className="hidden xl:block text-right leading-tight whitespace-nowrap mr-1"><div className="text-[10px] font-extrabold text-ink">{now.toLocaleDateString(undefined, { weekday:"short", day:"2-digit", month:"short", year:"numeric" })}</div><div className="text-[9px] text-faint mt-0.5">{now.toLocaleTimeString(undefined, { hour:"2-digit", minute:"2-digit", hour12:true })} · {zone}</div></div>;
}

function GlobalSearch() {
  const nav = useNavigate();
  const { user } = useAuth();
  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const mobileInputRef = useRef(null);
  const [query, setQuery] = useState(""), [items, setItems] = useState([]), [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!searchRef.current?.contains(event.target)) {
        setOpen(false);
        setMobileOpen(false);
      }

    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);
  const navGroups = user?.role === "HOUSEHOLD_USER" ? HOUSEHOLD_NAV : NAV;
  const moduleItems = navGroups.flatMap((group) => group.items)
    .filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
    .map((item) => ({ group: "NAVIGATION", id: `route:${item.path}`, label: item.name, detail: "Open section", path: item.path }));
  const searchItems = [...moduleItems, ...items];
  useEffect(() => { const shortcut = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); if (window.matchMedia("(min-width: 981px)").matches) inputRef.current?.focus(); else { setMobileOpen(true); window.setTimeout(() => mobileInputRef.current?.focus(), 0); } setOpen(true); } }; window.addEventListener("keydown", shortcut); return () => window.removeEventListener("keydown", shortcut); }, []);
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setItems([]);
      setError("");
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get(`/search?q=${encodeURIComponent(value)}`);
        if (!cancelled) {
          setItems(Array.isArray(response.data.items) ? response.data.items : []);
          setActive(0);
        }
      } catch (requestError) {
        if (!cancelled) {
          setItems([]);
          setError(apiError(requestError));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query]);
  const choose = (item) => { if (!item?.path) return; nav(item.path); setOpen(false); setMobileOpen(false); setQuery(""); };
  const keyDown = (event) => {
    if (event.key === "ArrowDown" && searchItems.length) { event.preventDefault(); setActive((value) => Math.min(value + 1, searchItems.length - 1)); }
    if (event.key === "ArrowUp" && searchItems.length) { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
    if (event.key === "Enter" && searchItems.length) choose(searchItems[active]);
    if (event.key === "Escape") { setOpen(false); setMobileOpen(false); }
  };
  const results = open && query.trim().length >= 2;
  const resultPanel = (id, className = "") => results && <div id={id} className={cx("absolute left-0 right-0 top-11 z-50 max-h-[min(65vh,24rem)] overflow-y-auto rounded-xl border border-line bg-white p-2 shadow-pop", className)} role="listbox" aria-label="Search results">
    {searchItems.map((item, index) => <button key={`${item.group || item.type}-${item.id || item.path}-${index}`} role="option" aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => choose(item)} className={cx("w-full rounded-lg px-3 py-2 text-left", active === index ? "bg-brand-light" : "hover:bg-muted")}><span className="overline text-faint">{item.group || item.type || "Record"}</span><span className="block text-sm font-semibold text-ink">{item.label || item.title || "Untitled"}</span>{item.detail && <span className="block text-xs text-subink">{item.detail}</span>}</button>)}
    {loading && <p className="px-3 py-3 text-center text-xs text-subink">Searching financial records…</p>}
    {error && <p className="px-3 py-3 text-center text-xs text-expense" role="alert">{error}</p>}
    {!loading && !error && !searchItems.length && <p className="px-3 py-5 text-center text-sm text-subink">No matching sections or records for “{query.trim()}”.</p>}
  </div>;
  return <div ref={searchRef} className="contents">
    <div className="relative hidden w-[clamp(10.5rem,19vw,18rem)] shrink-0 min-[981px]:block">
      <label className="sr-only" htmlFor="financial-search">Search financial records</label>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input ref={inputRef} id="financial-search" role="combobox" aria-expanded={results} aria-controls="financial-search-results" aria-autocomplete="list" value={query} onKeyDown={keyDown}       onChange={(event) => { setQuery(event.target.value); setItems([]); setActive(0); setOpen(true); }} onFocus={() => { if (query.trim().length >= 2) setOpen(true); }} placeholder="Search accounts, transactions, projects…" className="h-10 w-full rounded-full border border-line bg-white/90 pl-9 pr-14 text-xs outline-none transition focus:border-brand/50 focus:ring-2 focus:ring-brand/15" />
      <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 py-0.5 text-[9px] text-faint">⌘K</kbd>
      {resultPanel("financial-search-results")}
    </div>
    <button type="button" aria-label="Search financial records" onClick={() => { setMobileOpen((value) => !value); setOpen(true); }} className="flex h-9 w-9 items-center justify-center rounded-lg text-subink hover:bg-muted min-[981px]:hidden"><Search size={18} /></button>
    {mobileOpen && <div className="fixed inset-x-3 top-[4.75rem] z-50 rounded-2xl border border-line bg-white p-3 shadow-pop min-[981px]:hidden">
      <label className="sr-only" htmlFor="financial-search-mobile">Search financial records</label>
      <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input ref={mobileInputRef} id="financial-search-mobile" role="combobox" aria-expanded={results} aria-controls="financial-search-mobile-results" aria-autocomplete="list" value={query} onKeyDown={keyDown} onChange={(event) => { setQuery(event.target.value); setItems([]); setActive(0); setOpen(true); }} placeholder="Search accounts, transactions, projects…" className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand/20" /></div>
      {resultPanel("financial-search-mobile-results", "relative mt-2 top-auto")}
    </div>}
  </div>;
}

function MobileNextAction() {
  const nav = useNavigate();
  const location = useLocation();
  const { data, loading, error } = useFetch("/dashboard/overview");
  const priorities = [...(data?.budget_alerts || []), ...(data?.next_actions || [])]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((left, right) => ({ critical: 0, warning: 1, info: 2 }[left.severity] - { critical: 0, warning: 1, info: 2 }[right.severity])
      || (left.due_date || "9999-99-99").localeCompare(right.due_date || "9999-99-99"));
  const next = priorities[0];
  const destination = next?.path || "/planner";
  const active = location.pathname === destination || (destination !== "/" && location.pathname.startsWith(`${destination}/`));
  return <button type="button" onClick={() => nav(destination)} disabled={loading} data-testid="mobile-nav-next"
    aria-label={loading ? "Finding your next priority" : next ? `Open next priority: ${next.label}` : error ? "Priorities unavailable; open financial planner" : "Open financial planner; no current priority"}
    className={cx("flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-semibold", active ? "text-brand" : "text-faint")}>
    <Target size={20} /><span>Next</span>
  </button>;
}

function Notifications() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const panelRef = useRef(null);
  const load = () => api.get("/notifications").then((r) => setItems(r.data.items || [])).catch(() => {});
  useEffect(() => {
    load();
    window.addEventListener("nivara:notifications-changed", load);
    return () => window.removeEventListener("nivara:notifications-changed", load);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);
  const acknowledge = async (item) => {
    try { setItems((current) => current.filter((entry) => entry.id !== item.id)); await api.post(`/notifications/${item.id}/acknowledge`); load(); window.dispatchEvent(new Event("nivara:notifications-changed")); }
    catch (e) { setError(apiError(e)); }
  };
  return <div className="relative" ref={panelRef}><button onClick={() => setOpen((value) => !value)} className="relative w-9 h-9 rounded-lg text-subink hover:bg-muted flex items-center justify-center" aria-label="Notifications" aria-expanded={open} title="Notifications"><Bell size={18} />{items.length > 0 && <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-expense text-white text-[10px] font-bold flex items-center justify-center">{items.length > 99 ? "99+" : items.length}</span>}</button>
    {open && <div className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[calc(100dvh-5.25rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-pop animate-fade-up min-[981px]:absolute min-[981px]:inset-x-auto min-[981px]:right-0 min-[981px]:top-11 min-[981px]:max-h-[min(60vh,28rem)] min-[981px]:w-[min(23rem,calc(100vw-2rem))]" role="dialog" aria-label="Alerts and reminders"><div className="flex items-start justify-between gap-3 px-1 pb-3"><div><div className="font-display font-semibold text-ink">Alerts & reminders</div><p className="text-xs text-subink mt-0.5">Your next financial actions, ordered by urgency.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close notifications" className="shrink-0 rounded-lg p-1 text-faint hover:bg-muted hover:text-ink min-[981px]:hidden"><X size={17} /></button></div>{error && <p className="text-sm text-expense px-1 mb-3" role="alert">{error}</p>}{items.length ? <div className="space-y-2 pr-1">{items.slice(0, 4).map((item) => <div key={item.id} className="p-3 rounded-xl border border-line bg-muted/40"><div className="flex justify-between gap-3"><div className="min-w-0"><div className="font-semibold text-sm text-ink">{item.title}</div><div className="text-xs text-faint mt-0.5">{item.message}{item.due_date ? ` · due ${item.due_date}` : ""}</div></div>{item.amount > 0 && <div className="num font-bold text-expense whitespace-nowrap">{inr(item.amount)}</div>}</div><div className="mt-3 flex justify-end"><Button size="sm" variant="secondary" onClick={() => acknowledge(item)}>Acknowledge</Button></div></div>)}</div> : <div className="text-sm text-subink text-center py-8">You’re all caught up.</div>}<button onClick={() => { setOpen(false); nav("/notifications"); }} className="mt-3 w-full text-sm font-semibold text-brand flex items-center justify-center gap-1">View all notifications <ChevronRight size={15} /></button></div>}
  </div>;
}

function OverdueAlertPopups() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const dismissed = useRef(new Set());
  const load = () => api.get("/notifications").then((response) => {
    const today = new Date().toISOString().slice(0, 10);
    setItems((response.data.items || []).filter((item) => item.due_date && item.due_date < today && !dismissed.current.has(item.id)).slice(0, 5));
  }).catch(() => {});
  useEffect(() => {
    load();
    window.addEventListener("nivara:notifications-changed", load);
    return () => window.removeEventListener("nivara:notifications-changed", load);
  }, []);
  const dismiss = (id) => { dismissed.current.add(id); setItems((current) => current.filter((item) => item.id !== id)); };
  if (!items.length) return null;
  return <div className="overdue-dock fixed left-3 bottom-20 min-[981px]:left-auto min-[981px]:right-5 min-[981px]:bottom-5 z-[25] w-[min(22rem,calc(100vw-1.5rem))]" aria-live="polite">
    <button onClick={() => setOpen((value) => !value)} aria-expanded={open} className="overdue-dock__trigger ml-auto flex items-center gap-2 rounded-full border border-rose-200/80 bg-white/95 px-3.5 py-2 text-xs font-bold text-ink shadow-pop backdrop-blur-xl transition hover:-translate-y-0.5">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-rose-50 text-expense"><BellRing size={14} /></span>
      <span>{items.length} overdue {items.length === 1 ? "item" : "items"}</span>
      <ChevronDown size={14} className={cx("text-faint transition-transform", open && "rotate-180")} />
    </button>
    {open && <div className="mt-2 max-h-[min(55vh,24rem)] space-y-2 overflow-y-auto rounded-2xl border border-line/80 bg-white/95 p-3 shadow-pop backdrop-blur-xl animate-fade-up">
      <div className="flex items-center justify-between px-1 pb-1"><div><p className="text-sm font-bold text-ink">Needs attention</p><p className="text-[11px] text-subink">Overdue items, without interrupting your work.</p></div><button onClick={() => { setOpen(false); nav("/notifications"); }} className="text-xs font-bold text-brand hover:text-brand-dark">Review all</button></div>
      {items.map((item) => <div key={item.id} className="flex items-start gap-2.5 rounded-xl border border-line/80 bg-muted/50 p-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-expense shadow-xs"><BellRing size={14} /></span>
        <button onClick={() => { setOpen(false); nav("/notifications"); }} className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-bold text-ink">{item.title}</span><span className="mt-0.5 block text-[11px] leading-relaxed text-subink">{item.message}{item.amount > 0 ? ` · ${inr(item.amount)}` : ""}</span></button>
        <button onClick={() => dismiss(item.id)} className="rounded-lg p-1 text-faint hover:bg-white hover:text-ink" aria-label={`Dismiss ${item.title}`}><X size={14} /></button>
      </div>)}
    </div>}
  </div>;
}

export default function Layout({ children }) {
  const { user, logout, demoMode } = useAuth();
  const householdUser = user?.role === "HOUSEHOLD_USER";
  const mobileItems = householdUser ? HOUSEHOLD_MOBILE : MOBILE;
  const [drawer, setDrawer] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [version, setVersion] = useState("—");
  const nav = useNavigate();
  const loc = useLocation();
  const initials = (user?.name || user?.email || "A").slice(0, 1).toUpperCase();
  const pageTitle = loc.pathname === "/"
    ? "Overview"
    : (householdUser ? HOUSEHOLD_NAV : NAV).flatMap((group) => group.items).find((item) => item.path === loc.pathname)?.name
      || (loc.pathname.startsWith("/projects/") ? "Project workspace" : "Nivara Finance");
  const mobileMoreActive = !mobileItems.some((item) => item.path && (
    item.path === loc.pathname || (item.path !== "/" && loc.pathname.startsWith(`${item.path}/`))
  ));
  useEffect(() => { if (!householdUser) api.get("/error-logs/unread-count").then((r) => setErrorCount(r.data.count || 0)).catch(() => {}); }, [loc.pathname, householdUser]);
  useEffect(() => { if (!householdUser) api.get("/version-history").then((r) => setVersion(r.data.current || "—")).catch(() => {}); }, [householdUser]);

  return (
    <div className="app-shell min-h-screen bg-bg flex">
      {/* Desktop sidebar */}
      <aside className={cx("app-sidebar bg-white/85 backdrop-blur-xl border-r border-slate-200/70 hidden min-[981px]:flex flex-col h-screen sticky top-0 z-30 transition-[width] duration-300", sidebarCollapsed ? "w-20" : "w-[16.5rem]")}>
        <div className={cx("app-brand-row h-[5rem] px-4 flex items-center", sidebarCollapsed ? "justify-center" : "justify-between")}>
          <div className={sidebarCollapsed ? "hidden" : ""}><Brand version={version} onVersion={() => nav("/versions")} /></div>
          {sidebarCollapsed && <img src="/brand/nivara-logo-mark.png" alt="Nivara Finance" className="brand-mark h-11 w-11 rounded-xl border border-white/60 bg-white object-contain shadow-card" />}
          <button onClick={() => setSidebarCollapsed((value) => !value)} className={cx("sidebar-collapse w-8 h-8 rounded-lg text-subink hover:bg-muted flex items-center justify-center", sidebarCollapsed && "absolute -right-4 bg-white border border-line shadow-sm")} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}><ChevronRight size={16} className={cx("transition-transform", !sidebarCollapsed && "rotate-180")}/></button>
        </div>
        <NavItems collapsed={sidebarCollapsed} />
        <div className="sidebar-footer">
          {!sidebarCollapsed && <div className="sidebar-profile">
            <div className="sidebar-profile__avatar">{initials}</div>
            <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{user?.name || "Workspace admin"}</div><div className="truncate text-[10px]">{user?.email || "Private workspace"}</div></div>
            <button onClick={logout} data-testid="logout-btn" className="sidebar-signout" aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
          </div>}
          {sidebarCollapsed && <button onClick={logout} data-testid="logout-btn" className="sidebar-signout sidebar-signout--collapsed" aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>}
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 min-[981px]:hidden">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <div className="app-mobile-drawer absolute left-0 top-0 bottom-0 w-72 bg-surface flex flex-col animate-fade-in">
            <div className="h-16 px-5 flex items-center justify-between border-b border-line">
              <Brand version={version} onVersion={() => { setDrawer(false); nav("/versions"); }} /><button onClick={() => setDrawer(false)} aria-label="Close navigation" className="p-1.5 text-subink"><X size={20} /></button>
            </div>
            <NavItems onNavigate={() => setDrawer(false)} />
            <div className="p-3 border-t border-line">
              <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-subink hover:bg-muted"><LogOut size={17} /> Sign out</button>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="app-header min-h-[4.25rem] px-3 sm:px-5 lg:px-7 bg-white/90 backdrop-blur-xl border-b border-line/70 sticky top-0 z-20 flex items-center justify-between gap-3 sm:gap-5">
          <div className="min-w-0 flex-1 min-[981px]:hidden">
            <span className="block truncate font-display text-base font-semibold text-ink">{pageTitle}</span>
          </div>
          <div className="hidden min-w-0 items-center gap-2.5 text-sm font-extrabold tracking-tight text-ink min-[981px]:flex min-[981px]:flex-1"><span className="h-2 w-2 shrink-0 rounded-full bg-brand shadow-[0_0_0_4px_rgba(75,91,229,.10)]" /><span className="truncate">{pageTitle}</span></div>
          {!householdUser && <GlobalSearch />}
          <div className="flex items-center gap-2 sm:gap-3">
            <HeaderClock />
            {!householdUser && <Notifications />}
            {!householdUser && <button onClick={() => setQuickAdd(true)} data-testid="header-quick-add"
              aria-label="Record a transaction" title="Record a transaction"
              className="header-record inline-flex items-center gap-1.5 h-9 px-3.5 sm:px-4 rounded-full bg-gradient-to-r from-brand to-[#16a8b7] text-white text-[10px] font-extrabold hover:brightness-105 transition shadow-[0_8px_18px_rgba(75,91,229,.24)]">
              <Plus size={14} /><span className="hidden sm:inline">Record</span>
            </button>}
            <div className="relative flex items-center gap-2 pl-1">
              {!householdUser && <button onClick={() => setAdminOpen((v) => !v)} className="hidden sm:inline-flex items-center gap-1 h-8 px-2 rounded-full border border-line bg-white text-[10px] font-bold text-ink hover:bg-muted">Admin <ChevronDown size={13}/>{errorCount > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-expense text-white text-[10px] flex items-center justify-center">{errorCount > 99 ? "99+" : errorCount}</span>}</button>}
              {adminOpen && <div className="absolute right-0 top-11 w-56 p-2 rounded-xl border border-line bg-white shadow-pop z-40"><button onClick={() => { setAdminOpen(false); nav("/notifications"); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted">Notification center</button><button onClick={() => { setAdminOpen(false); nav("/versions"); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted">Version control</button><button onClick={() => { setAdminOpen(false); nav("/error-log"); }} className="w-full flex justify-between text-left px-3 py-2 rounded-lg text-sm hover:bg-muted">Operational logs {errorCount > 0 && <span className="text-expense font-bold">{errorCount}</span>}</button><button onClick={() => { setAdminOpen(false); nav("/access-control"); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted">Access control</button></div>}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-800 to-slate-500 ring-2 ring-white shadow-xs text-white flex items-center justify-center text-xs font-bold" data-testid="user-avatar">{initials}</div>
              <div className="hidden md:block leading-tight">
                <div className="max-w-32 truncate text-sm font-semibold text-ink">{user?.name || "Admin"}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">{user?.role?.replaceAll("_", " ")}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="app-main flex-1 p-4 sm:p-6 lg:p-8 max-w-[1540px] w-full mx-auto pb-28 min-[981px]:pb-10" key={loc.pathname}>
          {demoMode && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-teal-50 px-4 py-3 shadow-sm" role="status">
            <div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700"><Sparkles size={16} /></span><div className="min-w-0"><p className="text-sm font-bold text-ink">Public demo workspace</p><p className="text-xs text-subink"><span className="hidden min-[641px]:inline">Explore freely. Changes are temporary and are never saved to the database.</span><span className="min-[641px]:hidden">Temporary sample data · not saved</span></p></div></div>
            <button onClick={logout} className="rounded-full border border-indigo-200 bg-white px-3.5 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50">Exit demo</button>
          </div>}
          <div className="animate-fade-up">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <div className="app-mobile-nav mobile-safe-bottom min-[981px]:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-lg border-t border-line z-30 flex items-center justify-around px-2">
        {mobileItems.map((m) => m.tid === "mobile-nav-next" ? <MobileNextAction key={m.tid} /> : m.path ? (
          <NavLink key={m.path} to={m.path} end={m.path === "/"} data-testid={m.tid}
            className={({ isActive }) => cx("flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-semibold",
              isActive ? "text-brand" : "text-faint")}>
            <m.icon size={20} /><span>{m.name}</span>
          </NavLink>
        ) : <button key={m.tid} type="button" onClick={() => setDrawer(true)} data-testid={m.tid} aria-label="Open all sections" aria-expanded={drawer} aria-current={mobileMoreActive ? "page" : undefined}
          className={cx("flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-semibold",
            mobileMoreActive ? "text-brand" : "text-faint")}>
          <m.icon size={20} /><span>{m.name}</span>
        </button>)}
      </div>

      {!householdUser && <><QuickAdd open={quickAdd} onClose={() => setQuickAdd(false)} onDone={() => { setQuickAdd(false); nav(0); }} /><OverdueAlertPopups /></>}
    </div>
  );
}
