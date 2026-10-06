import React, { useState } from "react";
import { ArrowRight, CalendarClock, CheckCircle2, Check, Clock3, CreditCard, CircleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, StateBlock, Button, Modal, Field, Input } from "./ui";
import api, { apiError } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { fmtDate, inr } from "../lib/format";

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
  const mutate = async (action, extra = {}) => { if (!selected) return; setErr(""); setPaying(true); try { await api.post(`/planning/actions/${encodeURIComponent(selected.id)}`, { action, source_collection:selected.source_collection, source_id:selected.source_id, ...extra }); setSelected(null); refetch(); } catch (e) { setErr(apiError(e)); } finally { setPaying(false); } };
  const payCapable = selected && ["lendings", "loans", "insurance", "rent_payments", "farm_rent_payments"].includes(selected.source_collection);
  return <><Card className="overflow-hidden" data-testid="action-center">
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
      <div className="flex items-center gap-2"><span className="w-8 h-8 rounded-xl bg-amber-light text-amber grid place-items-center"><CalendarClock size={16}/></span><div><h2 className="font-display font-semibold text-ink">{compact ? "What needs your attention?" : "Action Center"}</h2><p className="text-xs text-subink">Priorities are based on recorded transactions and dated commitments.</p></div></div>
      <button onClick={() => nav("/planner")} className="text-xs font-semibold text-brand inline-flex items-center gap-1">Full planner <ArrowRight size={14}/></button>
    </div>
    {priorities.length > 0 && <section aria-label="Financial priorities" className="border-b border-line bg-amber-50/50">
      <div className="flex items-center gap-2 px-5 pt-4 pb-1 text-xs font-extrabold text-ink"><CircleAlert size={15} className="text-amber" /> Focus next</div>
      <div className="divide-y divide-amber-100">{priorities.map((item) => <button key={item.id} onClick={() => nav(item.path)} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-amber-50">
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{item.label}</span><span className="block text-xs text-subink">{item.detail}</span></span>
        {item.value != null && <span className="num shrink-0 text-sm font-bold text-ink">{inr(item.value, { compact: true })}</span>}
        <ArrowRight size={15} className="shrink-0 text-brand" />
      </button>)}</div>
    </section>}
    <StateBlock loading={loading} error={error} onRetry={refetch} empty={false}>{actions.length ? <div className="divide-y divide-line">{actions.map((item) => <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors"><button onClick={() => nav(item.path)} className="flex items-center gap-3 min-w-0 flex-1 text-left"><span className={`w-2 h-2 rounded-full shrink-0 ${item.due_date < new Date().toISOString().slice(0, 10) ? "bg-expense" : "bg-amber"}`}/><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink">{item.title}</p><p className="text-xs text-subink truncate">{item.detail} · {fmtDate(item.due_date)}</p></div>{item.amount > 0 && <span className="num text-sm font-bold text-ink whitespace-nowrap">{inr(item.amount,{compact:true})}</span>}</button><button onClick={() => { setSelected(item); setAmount(String(item.amount || "")); setUntil(""); setErr(""); }} className="p-2 rounded-lg text-brand hover:bg-brand-light" aria-label={`Act on ${item.title}`}><ArrowRight size={16}/></button></div>)}</div> : <div className="px-5 py-10 text-center"><CheckCircle2 className="mx-auto text-income mb-2" size={24}/><p className="text-sm font-semibold text-ink">You’re clear for now</p><p className="text-xs text-subink mt-1">No commitments are due in the next 30 days.</p></div>}</StateBlock>
  </Card><Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title || "Action"}><p className="text-sm text-subink mb-4">{selected?.detail} · due {selected && fmtDate(selected.due_date)}</p>{payCapable && <Field label="Amount to record"><Input type="number" min="0" max={selected?.amount} value={amount} onChange={(e)=>setAmount(e.target.value)}/></Field>}<Field label="Postpone until"><Input type="date" value={until} onChange={(e)=>setUntil(e.target.value)}/></Field>{err && <p className="text-sm text-expense mt-3">{err}</p>}<div className="grid grid-cols-2 gap-2 mt-4">{payCapable && <Button disabled={paying} onClick={()=>mutate("record_payment", {amount:Number(amount)})}><CreditCard size={15}/> Record payment</Button>}<Button variant="secondary" disabled={paying} onClick={()=>mutate("review")}><Check size={15}/> Review</Button><Button variant="secondary" disabled={paying || !until} onClick={()=>mutate("postpone", {snoozed_until:until})}><Clock3 size={15}/> Postpone</Button><Button variant="secondary" disabled={paying} onClick={()=>mutate("resolve")}>Mark resolved</Button></div></Modal></>;
}
