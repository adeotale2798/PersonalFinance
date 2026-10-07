import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarClock, CheckCircle2, Check, Clock3, CreditCard, CircleAlert, MoreHorizontal, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, StateBlock, Button, Modal, Field, Input } from "./ui";
import api, { apiError } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { fmtDate, inr, todayISO } from "../lib/format";

export default function ActionCenter({ compact = false }) {
  const { data, loading, error, refetch } = useFetch("/planning/overview");
  const overview = useFetch("/dashboard/overview");
  const nav = useNavigate();
  const actions = (data?.actions || []).slice(0, compact ? 4 : 8);
  const priorities = [...(overview.data?.budget_alerts || []), ...(overview.data?.next_actions || [])]
    .filter((item, index, rows) => rows.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((left, right) => ({ critical: 0, warning: 1, info: 2 }[left.severity] - { critical: 0, warning: 1, info: 2 }[right.severity])
      || (left.due_date || "9999-99-99").localeCompare(right.due_date || "9999-99-99"))
    .slice(0, compact ? 4 : 8);
  const [selected, setSelected] = useState(null); const [paying, setPaying] = useState(false); const [amount, setAmount] = useState(""); const [until, setUntil] = useState(""); const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [justUpdated, setJustUpdated] = useState(false);
  const updateTimer = useRef(null);
  useEffect(() => {
    const markUpdated = () => {
      setJustUpdated(true);
      window.clearTimeout(updateTimer.current);
      updateTimer.current = window.setTimeout(() => setJustUpdated(false), 2200);
    };
    window.addEventListener("nivara:data-changed", markUpdated);
    return () => {
      window.removeEventListener("nivara:data-changed", markUpdated);
      window.clearTimeout(updateTimer.current);
    };
  }, []);
  const mutate = async (action, extra = {}) => {
    if (!selected) return;
    setErr(""); setNotice(""); setPaying(true);
    try {
      await api.post(`/planning/actions/${encodeURIComponent(selected.id)}`, { action, source_collection: selected.source_collection, source_id: selected.source_id, ...extra });
      setNotice(action === "postpone" ? `${selected.label || selected.title} postponed until ${fmtDate(extra.snoozed_until)}.` : action === "record_payment" ? "Payment recorded and the priority resolved." : action === "review" ? "Marked reviewed." : "Priority resolved.");
      setSelected(null);
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setPaying(false);
    }
  };
  const payCapable = selected && ["lendings", "loans", "insurance", "rent_payments", "farm_rent_payments"].includes(selected.source_collection);
  const dueLabel = (dueDate) => {
    if (!dueDate) return "No due date";
    const date = String(dueDate).slice(0, 10);
    if (!Number.isFinite(Date.parse(`${date}T00:00:00`))) return "Due date unavailable";
    if (date < todayISO()) return `Overdue · ${fmtDate(date)}`;
    if (date === todayISO()) return "Due today";
    return `Due ${fmtDate(date)}`;
  };
  const primaryAction = (item) => {
    if (!item.isPriority && ["lendings", "loans", "insurance", "rent_payments", "farm_rent_payments"].includes(item.source_collection)) return "Record payment";
    if (item.id?.startsWith("budget-")) return "Adjust budget";
    if (item.id === "pending-expenses") return "Review expenses";
    if (item.id === "cash-shortfall") return "Open cash forecast";
    if (item.id?.startsWith("goal-due:")) return "Open savings goal";
    if (item.path === "/lending") return "Open lending";
    if (item.path === "/loans") return "Open loan";
    if (item.path === "/insurance") return "Open policy";
    if (item.path === "/rental") return "Open rent";
    if (item.path === "/farms") return "Open farm";
    if (item.path === "/pf-ppf") return "Open contribution";
    if (item.path === "/notifications") return "Open reminder";
    return item.path === "/planner" ? "Open planner" : "Open section";
  };
  const openAction = (item) => {
    if (["lendings", "loans", "insurance", "rent_payments", "farm_rent_payments"].includes(item.source_collection)) {
      setSelected(item);
      setAmount(String(item.amount || ""));
      setUntil("");
      setErr("");
    } else {
      nav(item.path);
    }
  };
  return <><Card className="relative overflow-hidden border-white/80 shadow-[0_20px_55px_-38px_rgba(42,64,102,.45)]" data-testid="action-center">
    <div className="flex items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-white via-white to-indigo-50/70 px-5 py-4">
      <div className="flex items-center gap-2"><span className="w-8 h-8 rounded-xl bg-amber-light text-amber grid place-items-center"><CalendarClock size={16}/></span><div><h2 className="font-display font-semibold text-ink">{compact ? "What needs your attention?" : "Action Center"}</h2><p className="text-xs text-subink">Priorities are based on recorded transactions and dated commitments.</p></div></div>
      <div className="flex shrink-0 items-center gap-2">
        <span role="status" aria-live="polite" data-testid="action-center-sync" className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold transition-colors sm:inline-flex ${justUpdated ? "border-teal-200 bg-teal-50 text-teal-800" : "border-slate-200 bg-white/80 text-faint"}`}>
          {justUpdated ? <Sparkles size={12} className="animate-pulse" /> : <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />}
          {justUpdated ? "Just updated" : "Auto-sync on"}
        </span>
        <button onClick={() => nav("/planner")} className="text-xs font-semibold text-brand inline-flex items-center gap-1">Planner <ArrowRight size={14}/></button>
      </div>
    </div>
    {priorities.length > 0 && <section aria-label="Financial priorities" className="border-b border-line bg-amber-50/50">
      <div className="flex items-center gap-2 px-5 pt-4 pb-1 text-xs font-extrabold text-ink"><CircleAlert size={15} className="text-amber" /> Focus next</div>
      <div className="divide-y divide-amber-100">{priorities.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-2 px-5 py-3 sm:flex-nowrap sm:gap-3">
        <span className="w-full min-w-0 sm:flex-1"><span className="block text-sm font-semibold text-ink">{item.label}</span><span className="block text-xs text-subink">{item.detail}</span><span className="mt-1 block text-[10px] font-bold text-amber-800">{dueLabel(item.due_date)}</span></span>
        {item.value != null && <span className="num shrink-0 text-sm font-bold text-ink">{inr(item.value, { compact: true })}</span>}
        <button onClick={() => nav(item.path)} className="ml-auto inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-brand hover:bg-white sm:ml-0" aria-label={`${primaryAction(item)}: ${item.label}`}>{primaryAction(item)} <ArrowRight size={14}/></button>
        <button onClick={() => { setNotice(""); setSelected({ ...item, isPriority: true }); setAmount(String(item.value || "")); setUntil(""); setErr(""); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-faint hover:bg-white hover:text-ink" aria-label={`Resolve or postpone ${item.label}`}><MoreHorizontal size={17}/></button>
      </div>)}</div>
    </section>}
    {notice && <p className="border-b border-line px-5 py-2.5 text-xs font-semibold text-income" role="status" data-testid="action-center-notice">{notice}</p>}
    {!loading && !error && priorities.length === 0 && actions.length > 0 && <p className="border-b border-line px-5 py-2 text-[11px] text-subink" role="status">No flagged priorities right now. Dated commitments are listed below.</p>}
    {!loading && !error && priorities.length === 0 && actions.length === 0 && <div className="px-5 py-4 text-center" role="status"><p className="text-sm font-semibold text-ink">You’re all caught up.</p><p className="mt-1 text-xs text-subink">New priorities and dated commitments will appear here when they need attention.</p></div>}
    <StateBlock loading={loading} error={error} onRetry={refetch} empty={false}>{actions.length ? <div className="divide-y divide-line">{actions.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-2 px-4 py-3 hover:bg-muted/50 transition-colors sm:flex-nowrap sm:gap-3 sm:px-5">
      <div className="w-full min-w-0 sm:flex-1"><p className="text-sm font-semibold text-ink">{item.title}</p><p className="mt-0.5 text-xs text-subink">{item.detail}</p><p className="mt-1 text-[10px] font-bold text-faint">{dueLabel(item.due_date)}{item.amount > 0 ? ` · ${inr(item.amount, { compact: true })}` : ""}</p></div>
      <button onClick={() => openAction(item)} className="ml-auto inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-bold text-brand hover:bg-brand-light sm:ml-0" aria-label={`${primaryAction(item)}: ${item.title}`} data-testid={`action-primary-${item.id}`}>{primaryAction(item)} <ArrowRight size={14}/></button>
      <button onClick={() => { setSelected(item); setAmount(String(item.amount || "")); setUntil(""); setErr(""); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-faint hover:bg-muted hover:text-ink" aria-label={`More actions for ${item.title}`}><MoreHorizontal size={17}/></button>
    </div>)}</div> : <div className="px-5 py-4 text-center"><p className="text-xs text-subink">No scheduled commitments to review.</p></div>}</StateBlock>
  </Card><Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.label || selected?.title || "Action"}><p className="text-sm text-subink mb-4">{selected?.detail} · {selected && dueLabel(selected.due_date)}</p>{payCapable && <Field label="Amount to record"><Input type="number" min="0" max={selected?.amount} value={amount} onChange={(e)=>setAmount(e.target.value)}/></Field>}<Field label="Postpone until"><Input type="date" value={until} onChange={(e)=>setUntil(e.target.value)}/></Field>{err && <p className="text-sm text-expense mt-3" role="alert">{err}</p>}<div className="grid grid-cols-2 gap-2 mt-4">{payCapable && <Button disabled={paying} onClick={()=>mutate("record_payment", {amount:Number(amount)})}><CreditCard size={15}/> Record payment</Button>}{!selected?.isPriority && <Button variant="secondary" disabled={paying} onClick={()=>mutate("review")}><Check size={15}/> Mark reviewed</Button>}<Button variant="secondary" disabled={paying || !until} onClick={()=>mutate("postpone", {snoozed_until:until})}><Clock3 size={15}/> Postpone</Button><Button variant="secondary" disabled={paying} onClick={()=>mutate("resolve")}>Mark resolved</Button></div></Modal></>;
}
