import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { PageHeader, StateBlock, Card, Button, Badge } from "../components/ui";
import { useFetch } from "../lib/useFetch";
import { fmtDate, inr, isoDateInTimezone } from "../lib/format";

const MONTHS = Array.from({ length: 12 }, (_, index) => new Date(2024, index, 1).toLocaleString("en", { month: "long" }));
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const money = (value) => Number(value || 0);

export default function Calendar() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const now = new Date();
  const year = Number(params.get("year")) || now.getFullYear();
  const month = Number(params.get("month")) || now.getMonth() + 1;
  const selectedDate = params.get("day") || isoDateInTimezone(now);
  const view = params.get("day") ? "day" : params.get("month") ? "month" : "year";
  const endpoint = `/calendar?year=${year}${view !== "year" ? `&month=${month}` : ""}${view === "day" ? `&day=${selectedDate}` : ""}`;
  const { data, loading, error, refetch } = useFetch(endpoint, [endpoint]);

  const setView = (nextView, nextYear = year, nextMonth = month, nextDay = selectedDate) => {
    const next = new URLSearchParams({ year: String(nextYear) });
    if (nextView !== "year") next.set("month", String(nextMonth));
    if (nextView === "day") next.set("day", nextDay);
    setParams(next);
  };
  const movePeriod = (delta) => {
    if (view === "year") return setView("year", year + delta);
    if (view === "day") {
      const cursor = new Date(`${selectedDate}T12:00:00`);
      cursor.setDate(cursor.getDate() + delta);
      const nextDay = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      return setView("day", cursor.getFullYear(), cursor.getMonth() + 1, nextDay);
    }
    const cursor = new Date(year, month - 1 + delta, 1);
    setView(view, cursor.getFullYear(), cursor.getMonth() + 1, `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-01`);
  };
  const chooseDay = (iso) => setView("day", Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), iso);
  const today = isoDateInTimezone(now);
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const periodTitle = view === "year" ? String(year) : view === "month" ? `${MONTHS[month - 1]} ${year}` : fmtDate(selectedDate);
  const total = data?.totals || {};
  const selectedTransactions = (data?.transactions || []).filter((item) => ["INCOME", "EXPENSE"].includes(item.type) && item.transaction_status !== "VOID");
  const dayCommitments = data?.commitments || [];

  return (
    <>
      <PageHeader title="Financial Calendar" subtitle="See recorded income and spending alongside clearly marked upcoming commitments." icon={CalendarDays}
        actions={<Button onClick={() => navigate("/daily-spending")}><Plus size={15} /> Record today's spending</Button>} />
      <Card className="p-4 sm:p-5 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-start sm:gap-2">
            <Button variant="secondary" size="sm" aria-label="Previous period" onClick={() => movePeriod(-1)}><ChevronLeft size={16} /></Button>
            <h2 className="min-w-0 flex-1 text-center font-display font-bold text-ink sm:min-w-36 sm:flex-none">{periodTitle}</h2>
            <Button variant="secondary" size="sm" aria-label="Next period" onClick={() => movePeriod(1)}><ChevronRight size={16} /></Button>
            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setView("day", todayYear, todayMonth, today)}>Today</Button>
          </div>
          <div className="flex gap-1 rounded-xl bg-muted p-1" aria-label="Calendar view">
            {["year", "month", "day"].map((item) => <button key={item} onClick={() => setView(item)} aria-pressed={view === item} className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize ${view === item ? "bg-white text-brand shadow-card" : "text-subink hover:text-ink"}`}>{item}</button>)}
          </div>
          {view !== "year" && <input aria-label="Choose calendar date" type="date" className="h-9 rounded-lg border border-line bg-white px-2 text-sm" value={view === "day" ? selectedDate : `${year}-${String(month).padStart(2, "0")}-01`} onChange={(event) => { if (event.target.value) chooseDay(event.target.value); }} />}
        </div>
      </Card>
      <StateBlock loading={loading} error={error} onRetry={refetch}>
        {data && <>
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-5">
            <Metric label="Posted income" value={inr(total.income)} tone="income" />
            <Metric label="Posted expenses" value={inr(total.expense)} tone="expense" />
            <Metric label="Net recorded" value={inr(total.net)} tone={money(total.net) >= 0 ? "income" : "expense"} />
            <Metric label="Pending · separate" value={`${inr(total.pending_income)} in · ${inr(total.pending_expense)} out`} tone="pending" />
            <Metric label="Forecast commitments" value={`${data.scheduled_count || 0} · ${inr(data.scheduled_total)}`} tone="pending" />
          </div>
          {view === "year" && <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{(data.months || []).map((item) => <button key={item.month} onClick={() => setView("month", year, Number(item.month.slice(5, 7)))} className="text-left"><Card className="p-4 hover:-translate-y-0.5 hover:shadow-pop"><div className="flex justify-between gap-2"><h3 className="font-display font-bold text-ink">{MONTHS[Number(item.month.slice(5, 7)) - 1]}</h3><Badge tone="gray">{item.days_with_activity} active days</Badge></div><div className="grid grid-cols-2 gap-3 mt-4 text-sm"><span className="text-income">In <b className="num block text-ink">{inr(item.income, { compact: true })}</b></span><span className="text-expense">Out <b className="num block text-ink">{inr(item.expense, { compact: true })}</b></span></div><div className="mt-3 flex justify-between text-xs"><span className="text-subink">Forecast commitments ({item.scheduled_count || 0})</span><span className="num font-semibold text-amber">{inr(item.scheduled_total, { compact: true })}</span></div><div className="mt-3 border-t border-line pt-2 flex justify-between text-xs"><span className="text-subink">Net</span><span className={`num font-bold ${money(item.net) >= 0 ? "text-income" : "text-expense"}`}>{inr(item.net)}</span></div></Card></button>)}</div>}
          {view !== "year" && <div className="grid xl:grid-cols-[minmax(0,1fr)_22rem] gap-5">
            <Card className="overflow-hidden">
              {view === "month" && <div className="grid grid-cols-7 border-b border-line bg-muted/50">{WEEKDAYS.map((label) => <div key={label} className="py-2 text-center overline text-faint">{label}</div>)}</div>}
              {view === "month" ? <MonthGrid year={year} month={month} today={today} days={data.days || []} onSelect={chooseDay} /> : <div className="p-4 space-y-5"><div><h3 className="font-display font-bold text-ink">Transactions</h3><p className="text-xs text-subink mt-1">Posted and pending ledger entries for {fmtDate(selectedDate)}. Forecast commitments are listed separately.</p></div>{selectedTransactions.length ? <div className="divide-y divide-line">{selectedTransactions.map((item) => <Transaction key={item.id} item={item} />)}</div> : <p className="rounded-xl bg-muted/50 p-5 text-center text-sm text-subink">No income or expense transactions recorded for this day.</p>}{dayCommitments.length > 0 && <section><h3 className="font-display font-bold text-ink">Upcoming / scheduled</h3><div className="mt-2 space-y-2">{dayCommitments.map((item) => <div key={item.id} className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-3"><div className="flex justify-between gap-3"><div><Badge tone="amber">Forecast</Badge><p className="mt-1 text-sm font-semibold text-ink">{item.title}</p><p className="text-xs text-subink">{item.detail}</p></div><span className="num text-sm font-bold text-ink">{inr(item.amount)}</span></div></div>)}</div></section>}</div>}
            </Card>
            <Card className="p-4 h-fit"><h3 className="font-display font-bold text-ink">{view === "month" ? `${MONTHS[month - 1]} at a glance` : "Day totals"}</h3><div className="mt-3 space-y-3 text-sm"><SummaryLine label="Posted income" amount={total.income} tone="income" /><SummaryLine label="Posted expense" amount={total.expense} tone="expense" /><SummaryLine label="Pending income" amount={total.pending_income} tone="pending" /><SummaryLine label="Pending expense" amount={total.pending_expense} tone="pending" /><SummaryLine label={`Forecast commitments (${data.scheduled_count || 0})`} amount={data.scheduled_total} tone="pending" /></div>{view === "month" && <><p className="mt-4 text-xs text-subink">Select a date to inspect posted and pending records. Forecast commitments are not included in recorded totals.</p><section className="mt-5 border-t border-line pt-4"><h4 className="text-sm font-bold text-ink">Scheduled this month</h4>{(data.commitments || []).length ? <div className="mt-2 space-y-2">{[...data.commitments].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6).map((item) => <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg bg-amber-50/70 p-2.5"><div className="min-w-0"><p className="text-xs font-semibold text-ink">{item.title}</p><p className="truncate text-[11px] text-subink">{fmtDate(item.date)} · {item.detail}</p></div><span className="num shrink-0 text-xs font-bold text-amber">{inr(item.amount, { compact: true })}</span></div>)}</div> : <p className="mt-2 text-xs text-subink">No forecast commitments scheduled.</p>}</section></>}</Card>
          </div>}
        </>}
      </StateBlock>
    </>
  );
}

function MonthGrid({ year, month, today, days, onSelect }) {
  const offset = new Date(year, month - 1, 1).getDay();
  const cells = [...Array(offset).fill(null), ...days];
  return <div className="grid grid-cols-7">{cells.map((day, index) => day ? <button key={day.date} onClick={() => onSelect(day.date)} aria-label={`${fmtDate(day.date)}, posted income ${inr(day.income)}, posted expenses ${inr(day.expense)}, pending income ${inr(day.pending_income)}, pending expenses ${inr(day.pending_expense)}, ${day.commitments?.length || 0} scheduled commitments`} className="min-h-28 border-b border-r border-line p-1.5 text-left transition-colors hover:bg-brand-light/40 sm:min-h-32 sm:p-2"><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${day.date === today ? "bg-brand text-white" : "text-ink"}`}>{Number(day.date.slice(8))}</span><div className="mt-1 space-y-0.5 text-[9px] leading-tight sm:text-[11px]">{money(day.income) > 0 && <div className="truncate text-income">In {inr(day.income, { compact: true })}</div>}{money(day.expense) > 0 && <div className="truncate text-expense">Out {inr(day.expense, { compact: true })}</div>}{money(day.pending_income) > 0 && <div className="truncate text-amber">P.in {inr(day.pending_income, { compact: true })}</div>}{money(day.pending_expense) > 0 && <div className="truncate text-amber">P.out {inr(day.pending_expense, { compact: true })}</div>}</div>{day.commitments?.length > 0 && <span className="mt-1 block truncate text-[9px] font-semibold text-amber sm:text-[10px]">{day.commitments.length} scheduled</span>}</button> : <div key={`pad-${index}`} className="min-h-28 border-b border-r border-line bg-muted/20 sm:min-h-32" />)}</div>;
}

function Metric({ label, value, tone }) { const color = tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : tone === "pending" ? "text-amber" : "text-ink"; return <Card className="p-4"><p className="overline text-faint">{label}</p><p className={`num mt-2 break-words text-lg font-extrabold ${color}`}>{value}</p></Card>; }
function SummaryLine({ label, amount, tone }) { return <div className="flex justify-between gap-2"><span className="text-subink">{label}</span><span className={`num font-semibold ${tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "text-amber"}`}>{inr(amount)}</span></div>; }
function Transaction({ item }) { const income = item.type === "INCOME", pending = item.transaction_status === "PENDING"; return <div className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-2"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${income ? "bg-emerald-50 text-income" : "bg-rose-50 text-expense"}`}>{income ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{item.category || item.source || (income ? "Income" : "Expense")}</p><p className="truncate text-xs text-subink">{item.description || item.account_id || "Ledger entry"}{pending ? " · Pending" : ""}</p></div></div><span className={`num shrink-0 text-sm font-bold ${income ? "text-income" : "text-expense"}`}>{income ? "+" : "−"}{inr(item.amount)}</span></div>; }
