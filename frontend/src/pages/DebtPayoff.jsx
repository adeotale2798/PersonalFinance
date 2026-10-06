import React, { useMemo, useState } from "react";
import { AlertCircle, Calculator, CircleDollarSign, TrendingDown } from "lucide-react";
import { Button, Card, Field, Input, PageHeader, StateBlock } from "../components/ui";
import { apiError } from "../lib/api";
import api from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { fmtDate, inr } from "../lib/format";

const today = () => {
  const current = new Date();
  return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
};

const planLabels = {
  avalanche: "Avalanche",
  snowball: "Snowball",
};

export default function DebtPayoff() {
  const { data: loans, loading: loansLoading, error: loansError, refetch } = useFetch("/loans");
  const [extraMonthly, setExtraMonthly] = useState("0");
  const [startDate, setStartDate] = useState(today);
  const [plan, setPlan] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState("");
  const activeLoans = useMemo(
    () => (loans || []).filter((loan) => !["closed", "paid", "paid off", "paid_off"].includes(String(loan.status || "Open").trim().toLowerCase()) && Number(loan.outstanding) > 0),
    [loans],
  );
  const outstanding = activeLoans.reduce((sum, loan) => sum + (Number(loan.outstanding) || 0), 0);

  const runPlan = async (event) => {
    event.preventDefault();
    setPlanning(true);
    setPlanError("");
    try {
      const response = await api.post("/debt-payoff/plan", {
        extra_monthly: Number(extraMonthly),
        start_date: startDate || null,
      });
      setPlan(response.data);
    } catch (error) {
      setPlan(null);
      setPlanError(apiError(error));
    } finally {
      setPlanning(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Debt payoff planner"
        subtitle="Compare two payoff strategies against your open loan accounts—without changing loan records."
        icon={TrendingDown}
      />
      <StateBlock loading={loansLoading} error={loansError} onRetry={refetch}>
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Your planning scenario</h2>
                <p className="text-sm text-subink mt-1">The plan uses each open loan’s current balance, rate, and EMI.</p>
              </div>
              <div className="rounded-xl bg-muted/70 px-4 py-2">
                <div className="overline text-faint">Included debt</div>
                <div className="num font-bold text-ink">{inr(outstanding, { decimals: 2 })}</div>
                <div className="text-xs text-subink">{activeLoans.length} open loan{activeLoans.length === 1 ? "" : "s"}</div>
              </div>
            </div>
            <form onSubmit={runPlan} className="grid sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
              <Field label="Extra payment each month (₹)">
                <Input
                  type="number"
                  min="0"
                  max="100000000"
                  step="0.01"
                  required
                  value={extraMonthly}
                  onChange={(event) => { setExtraMonthly(event.target.value); setPlan(null); }}
                />
              </Field>
              <Field label="First payment date">
                <Input
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => { setStartDate(event.target.value); setPlan(null); }}
                />
                <span className="block text-xs text-faint mt-1">Interest accrues monthly before each modeled payment.</span>
              </Field>
              <Button type="submit" disabled={planning || activeLoans.length === 0}>
                <Calculator size={16} /> {planning ? "Calculating…" : "Compare plans"}
              </Button>
            </form>
            {planError && <p className="mt-4 text-sm text-expense" role="alert">{planError}</p>}
            {activeLoans.length === 0 && <p className="mt-4 text-sm text-subink">Add an open loan with an outstanding balance to create a payoff plan.</p>}
          </Card>

          <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>Illustrative estimates use monthly interest at the recorded annual rate and the recorded EMI. Actual lender calculations, fees, and payment timing may differ. This planner is read-only and never posts payments to your ledger.</p>
          </div>

          {plan && (
            <>
              <section className="grid lg:grid-cols-2 gap-4" aria-label="Payoff strategy comparison">
                {["avalanche", "snowball"].map((key) => (
                  <PlanCard key={key} plan={plan[key]} baseline={plan.minimum_only} extra={plan.extra_monthly} />
                ))}
              </section>
              <section className="grid lg:grid-cols-2 gap-4">
                {["avalanche", "snowball"].map((key) => (
                  <DebtTable key={key} title={`${planLabels[key]} payoff order`} debts={plan[key].debts} />
                ))}
              </section>
            </>
          )}
        </div>
      </StateBlock>
    </>
  );
}

function PlanCard({ plan, baseline, extra }) {
  const interestSaved = baseline.status === "complete" && plan.status === "complete"
    ? Math.max(0, baseline.total_interest - plan.total_interest)
    : null;
  const monthsSaved = baseline.status === "complete" && plan.status === "complete"
    ? Math.max(0, baseline.months - plan.months)
    : null;
  const isBaseline = plan.strategy === "minimum_only";
  const label = planLabels[plan.strategy] || "Minimum payments";
  const statusText = plan.status === "complete"
    ? `Debt-free ${fmtDate(plan.payoff_date)}`
    : plan.status === "impossible"
      ? "Not projected to pay off with these payments"
      : `Still outstanding after ${plan.months.toLocaleString()} months`;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{label}</h2>
          <p className="text-sm text-subink mt-1">{isBaseline ? "Minimum payments only" : `${inr(extra, { decimals: 2 })} extra each month`}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${plan.status === "complete" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
          {plan.status === "complete" ? "Complete" : "Needs review"}
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold text-ink">{statusText}</p>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Metric icon={CircleDollarSign} label="Total interest" value={inr(plan.total_interest, { decimals: 2 })} />
        <Metric icon={Calculator} label="Total paid so far" value={inr(plan.total_paid, { decimals: 2 })} />
        {interestSaved !== null && !isBaseline && <Metric label="Interest saved" value={inr(interestSaved, { decimals: 2 })} />}
        {monthsSaved !== null && !isBaseline && <Metric label="Months saved" value={`${monthsSaved}`} />}
      </div>
    </Card>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-subink">{Icon && <Icon size={14} />}{label}</div>
      <div className="num font-bold text-ink mt-1">{value}</div>
    </div>
  );
}

function DebtTable({ title, debts }) {
  return (
    <Card className="p-5 overflow-hidden">
      <h2 className="font-display font-semibold text-ink">{title}</h2>
      <div className="overflow-x-auto mt-3">
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-faint">
            <th className="py-2 pr-3 font-medium">Loan</th>
            <th className="py-2 px-3 text-right font-medium">Interest</th>
            <th className="py-2 px-3 text-right font-medium">Months</th>
            <th className="py-2 pl-3 text-right font-medium">Payoff date / remaining</th>
          </tr></thead>
          <tbody>{debts.map((debt) => (
            <tr key={debt.id} className="border-b border-line last:border-0">
              <td className="py-3 pr-3 font-medium text-ink">{debt.name}</td>
              <td className="py-3 px-3 text-right num text-subink">{inr(debt.interest_paid, { decimals: 2 })}</td>
              <td className="py-3 px-3 text-right num text-subink">{debt.months ?? "—"}</td>
              <td className="py-3 pl-3 text-right text-subink">
                {debt.payoff_date ? fmtDate(debt.payoff_date) : inr(debt.remaining_balance, { decimals: 2 })}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Card>
  );
}
