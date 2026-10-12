import React from "react";
import { Activity, CalendarDays, Calculator, Download, Landmark, ShieldCheck, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, PageHeader, StateBlock } from "../components/ui";
import { useFetch } from "../lib/useFetch";
import { fmtDate, inr } from "../lib/format";
import { downloadFinancialSnapshot } from "../lib/export";
import ActionCenter from "../components/ActionCenter";

export default function Planner() {
  const overview = useFetch("/planning/overview");
  const ownership = useFetch("/planning/ownership");
  const nav = useNavigate();
  const data = overview.data;

  return (
    <>
      <PageHeader
        title="Financial Planner"
        subtitle="Commitments, cash outlook and health signals in one calm review."
        icon={CalendarDays}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={downloadFinancialSnapshot}><Download size={15} /> Snapshot</Button>
            <Button variant="secondary" size="sm" onClick={() => nav("/calculators")}><Calculator size={15} /> Calculators</Button>
          </div>
        }
      />
      <StateBlock loading={overview.loading} error={overview.error} onRetry={overview.refetch}>
        {data && (
          <>
            <div className="grid gap-4 mb-6 sm:grid-cols-2 xl:grid-cols-4">
              <Metric icon={WalletCards} label="Cash on hand" value={inr(data.forecast.cash_on_hand, { compact: true })} />
              <Metric icon={Landmark} label="Scheduled out · next 30d" value={inr(data.forecast.scheduled_out, { compact: true })} tone="expense" />
              <Metric icon={Activity} label="Projected balance" value={inr(data.forecast.projected_balance, { compact: true })} tone={data.forecast.projected_balance >= 0 ? "income" : "expense"} />
              <Metric icon={ShieldCheck} label="Financial health" value={`${data.health.score}/100`} tone={data.health.score >= 70 ? "income" : "amber"} />
            </div>

            <div className="grid gap-6 xl:grid-cols-5">
              <div className="xl:col-span-3"><ActionCenter /></div>
              <div className="space-y-6 xl:col-span-2">
                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display font-semibold text-ink">Health check-up</h2>
                    <Badge tone={data.health.score >= 70 ? "green" : "amber"}>{data.health.score}/100</Badge>
                  </div>
                  <p className="mt-1 text-xs text-subink">Transparent household signals, never a black box.</p>
                  <div className="mt-4 space-y-3">
                    {data.health.signals.map((signal) => (
                      <div key={signal.label} className="flex items-start gap-2 text-sm">
                        <span className={`mt-1.5 h-2 w-2 rounded-full ${signal.good ? "bg-income" : "bg-amber"}`} />
                        <span className="text-subink">{signal.label}</span>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="p-5">
                  <h2 className="font-display font-semibold text-ink">Ownership views</h2>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {Object.entries(ownership.data?.views || {}).map(([key, value]) => (
                      <div className="rounded-lg bg-muted/60 p-2" key={key}>
                        <p className="overline text-faint">{key.replace("_", " ")}</p>
                        <p className="num text-sm font-bold">{inr(value, { compact: true })}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2">
                    {(ownership.data?.owners || []).map((owner) => (
                      <div key={owner.name} className="flex justify-between text-sm">
                        <span>{owner.name}</span>
                        <span className="num font-semibold">{inr(owner.value, { compact: true })}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            <Card className="mt-6 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display font-semibold text-ink">Cash-risk outlook</h2>
                  <p className="mt-1 text-xs text-subink">
                    Minimum projected balance: {inr(data.forecast.minimum_balance)} on {fmtDate(data.forecast.minimum_balance_date)}.
                    {" "}Scheduled amounts are forecasts, not posted ledger entries.
                  </p>
                </div>
                <Badge tone={data.forecast.minimum_balance < 0 ? "red" : "green"}>
                  {data.forecast.minimum_balance < 0 ? `${data.forecast.tight_dates.length} tight dates` : "Cash covered"}
                </Badge>
              </div>
              {(data.forecast.overdue_out > 0 || data.forecast.overdue_in > 0) && (
                <p className="mt-3 text-xs text-amber">
                  Overdue commitments are applied as due today in the projection: {inr(data.forecast.overdue_out)} out · {inr(data.forecast.overdue_in)} in.
                </p>
              )}
              {data.forecast.tight_dates.length > 0 && (
                <p className="mt-3 text-sm text-expense">
                  Cash may fall below zero on {data.forecast.tight_dates.map((item) => fmtDate(item.date)).join(", ")}.
                  {" "}Record an inflow, defer a due, or add funds before then.
                </p>
              )}
            </Card>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <List title="30-day calendar" subtitle="Expected obligations and collections." rows={data.calendar} onClick={(item) => nav(item.path)} event />
              <List title="Money timeline" subtitle="Recently recorded transactions." rows={data.timeline} onClick={(item) => nav(item.type === "INCOME" ? "/income" : item.type === "EXPENSE" ? "/expenses" : "/cash-flow")} />
            </div>
          </>
        )}
      </StateBlock>
    </>
  );
}

function List({ title, subtitle, rows, onClick, event }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-display font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-xs text-subink">{subtitle}</p>
      </div>
      <div className="divide-y divide-line">
        {rows.length ? rows.map((item, index) => (
          <button key={item.id || index} onClick={() => onClick(item)} className="flex w-full justify-between gap-4 px-5 py-3 text-left hover:bg-muted/40">
            <div>
              <p className="text-sm font-medium text-ink">
                {item.title || item.category || item.source || item.type}
                {event && <span className="font-normal text-subink"> · {item.detail}</span>}
              </p>
              <p className="mt-0.5 text-xs text-faint">{fmtDate(item.due_date || item.date)}</p>
            </div>
            <span className="num text-sm font-semibold">{inr(item.amount, { compact: true })}</span>
          </button>
        )) : <p className="px-5 py-10 text-center text-sm text-subink">No records yet.</p>}
      </div>
    </Card>
  );
}

function Metric({ icon: Icon, label, value, tone = "brand" }) {
  const colors = {
    brand: "bg-brand-light text-brand",
    income: "bg-emerald-50 text-income",
    expense: "bg-rose-50 text-expense",
    amber: "bg-amber-light text-amber",
  };
  return (
    <Card className="p-4">
      <div className="flex justify-between">
        <span className="overline text-faint">{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${colors[tone]}`}><Icon size={15} /></span>
      </div>
      <p className="num mt-3 text-xl font-extrabold text-ink">{value}</p>
    </Card>
  );
}
