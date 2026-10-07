import React, { useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Circle, CircleDollarSign, Landmark, Sparkles, Wallet, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../lib/useFetch";
import { useAuth } from "../lib/auth";
import { Badge, Card, DetailDrawer, Segmented, StateBlock } from "../components/ui";
import { Bars, ChartCard, Donut, Legendish, TrendLine } from "../components/charts";
import { fmtDate, inr, todayISO } from "../lib/format";
import api, { apiError } from "../lib/api";
import ActionCenter from "../components/ActionCenter";

const ranges = [{ value: "1M", label: "1M" }, { value: "6M", label: "6M" }, { value: "1Y", label: "1Y" }, { value: "ALL", label: "All" }];

export default function Overview() {
  const nav = useNavigate();
  const [range, setRange] = useState("ALL");
  const [drawer, setDrawer] = useState(null);
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [snapshotError, setSnapshotError] = useState("");
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const overview = useFetch("/dashboard/overview");
  const history = useFetch("/networth/history");
  const accounts = useFetch("/accounts");
  const goals = useFetch("/goals");
  const quality = useFetch("/data-quality");
  const { user, demoMode, setupDismissed, dismissSetup } = useAuth();
  const hasAccount = (accounts.data || []).length > 0;
  const hasGoal = (goals.data || []).length > 0;
  const setupReady = !accounts.loading && !goals.loading && !accounts.error && !goals.error;
  const showSetup = setupReady && !(hasAccount && hasGoal) && !setupDismissed;
  const data = overview.data;
  const historyData = useMemo(() => {
    const all = history.data?.items || [];
    if (range === "ALL") return all;
    const days = range === "1M" ? 31 : range === "6M" ? 183 : 365;
    const after = new Date(`${todayISO()}T00:00:00`).getTime() - days * 86400000;
    return all.filter((point) => new Date(`${point.date}T00:00:00`).getTime() >= after);
  }, [history.data, range]);
  const validHistory = historyData.filter((point) => point.date
    && Number.isFinite(Date.parse(`${point.date}T00:00:00`))
    && point.net_worth !== null
    && point.net_worth !== ""
    && Number.isFinite(Number(point.net_worth)));
  const hasTrendHistory = new Set(validHistory.map((point) => point.date)).size >= 3;
  const latestBalanceActivity = (accounts.data || [])
    .map((account) => account.balance_updated_at)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
  const latestReconciliation = (accounts.data || [])
    .map((account) => account.last_reconciled_at)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  const balanceSheetTotal = Math.max(0, data?.total_assets || 0) + Math.max(0, data?.total_liabilities || 0);
  const hasBalanceSheetData = balanceSheetTotal > 0;
  const assetShare = balanceSheetTotal ? Math.round(Math.max(0, data.total_assets) / balanceSheetTotal * 100) : 0;
  const drawerItems = ((drawer === "assets" ? data?.allocation : data?.liability_allocation) || []).filter((row) => row.value > 0);
  const allocation = (data?.allocation || []).filter((row) => row.value > 0);
  const allocationChartHeight = Math.max(285, allocation.length * 38 + 20);
  const activeGoals = (goals.data || []).filter((goal) => !["COMPLETED", "COMPLETE", "CANCELLED"].includes(String(goal.status || "").toUpperCase()));
  const recordSnapshot = async () => {
    setSnapshotMessage(""); setSnapshotError(""); setSavingSnapshot(true);
    try {
      const { data: snapshot } = await api.post("/networth/snapshot");
      setSnapshotMessage(`Today's ${fmtDate(snapshot.date)} ledger snapshot is saved.`);
      await history.refetch(true);
    } catch (error) {
      setSnapshotError(apiError(error));
    } finally {
      setSavingSnapshot(false);
    }
  };

  return <StateBlock loading={overview.loading} error={overview.error} onRetry={overview.refetch}>
    {data && <div className="space-y-5 sm:space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 px-0.5">
        <div><Badge tone="green" className="mb-3"><Sparkles size={12} /> Complete financial picture</Badge><h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-ink">{greeting}, {(user?.name || "there").split(" ")[0]}.</h1><p className="mt-1 text-sm text-subink">Your wealth moved <span className={data.month_savings >= 0 ? "font-bold text-income" : "font-bold text-expense"}>{data.month_savings >= 0 ? "+" : ""}{inr(data.month_savings, { compact: true })}</span> this month.</p></div>
        <Segmented options={ranges} value={range} onChange={setRange} />
      </section>

      {showSetup && <section className="first-run-setup" aria-labelledby="first-run-setup-title">
        <div className="first-run-setup__intro">
          <div className="first-run-setup__icon" aria-hidden="true"><Sparkles size={17} /></div>
          <div className="min-w-0">
            <h2 id="first-run-setup-title">Set up your financial foundation</h2>
            <p>Start with the basics. You can explore every other part of Nivara whenever you like.</p>
          </div>
          <button type="button" className="first-run-setup__dismiss" onClick={dismissSetup} aria-label="Skip setup and dismiss this guide" title="Skip setup"><X size={17} /></button>
        </div>
        <ol className="first-run-setup__steps">
          <li className={hasAccount ? "is-complete" : ""}>
            <span className="first-run-setup__step-icon" aria-hidden="true">{hasAccount ? <CheckCircle2 size={19} /> : <Circle size={19} />}</span>
            <div className="first-run-setup__step-copy"><strong>{hasAccount ? "Account added" : "Add an account"}</strong><span>{hasAccount ? "Your balances can now inform your overview." : "Track a bank account, wallet or cash balance."}</span></div>
            <button type="button" onClick={() => nav("/accounts")} aria-label={hasAccount ? "Review accounts" : "Add an account"}>{hasAccount ? "Review accounts" : "Add account"} <ArrowRight size={14} /></button>
          </li>
          <li className={hasGoal ? "is-complete" : ""}>
            <span className="first-run-setup__step-icon" aria-hidden="true">{hasGoal ? <CheckCircle2 size={19} /> : <Circle size={19} />}</span>
            <div className="first-run-setup__step-copy"><strong>{hasGoal ? "Goal created" : "Create a savings goal"}</strong><span>{hasGoal ? "Your plan is ready to track." : "Give an important plan a target amount and date."}</span></div>
            <button type="button" onClick={() => nav("/goals")} aria-label={hasGoal ? "Review goals" : "Create a savings goal"}>{hasGoal ? "Review goals" : "Create goal"} <ArrowRight size={14} /></button>
          </li>
        </ol>
        <p className="first-run-setup__footnote">This guide updates automatically as your account and goal are saved. Skip any time; navigation stays open.</p>
      </section>}

      {!quality.loading && !quality.error && quality.data?.total_issues > 0 && <button type="button" onClick={() => nav("/data-quality")} className="w-full rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
        <span className="flex flex-wrap items-center justify-between gap-3"><span><span className="block text-sm font-bold text-ink">{quality.data.total_issues} financial data-quality checks need review</span><span className="mt-1 block text-xs text-subink">{quality.data.counts.reconciliation_variances || 0} statement differences · {quality.data.counts.uncategorized_transactions || 0} uncategorized · {quality.data.counts.stale_imported_balances || 0} stale imported balances</span></span><span className="inline-flex items-center gap-1 text-xs font-bold text-brand">Review checks <ArrowRight size={14} /></span></span>
      </button>}

      <section className="grid xl:grid-cols-12 gap-4 sm:gap-5">
        <div className="nivara-hero wealth-command-panel rounded-2xl p-4 sm:p-5 xl:col-span-8 flex flex-col" data-testid="net-worth-panel">
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-semibold wealth-muted">Total net worth</div><div className="num text-4xl sm:text-5xl font-bold text-white mt-1.5">{inr(data.net_worth, { compact: true })}</div><p className="text-xs wealth-muted mt-1.5">Recorded assets minus liabilities · <button onClick={() => nav("/net-worth")} className="wealth-link">View balance sheet</button></p></div><button onClick={() => nav("/net-worth")} className="wealth-action px-3 py-2 rounded-lg text-xs font-bold transition-colors">Statement <ArrowRight size={14} className="inline ml-1" /></button></div>
          <div className="relative z-10 wealth-key-stats grid grid-cols-3 gap-2 sm:gap-3 mt-4"><MiniStat label="Assets" value={inr(data.total_assets, { compact: true })} onClick={() => setDrawer("assets")} /><MiniStat label="Liabilities" value={inr(data.total_liabilities, { compact: true })} onClick={() => setDrawer("liabilities")} /><MiniStat label="This month" value={`${data.month_savings >= 0 ? "+" : ""}${inr(data.month_savings, { compact: true })}`} positive /></div>
          <div className="hero-chart-shell relative z-10 rounded-xl mt-3 h-[185px] sm:h-[205px] p-2.5" data-testid="net-worth-history">
            <div className="wealth-history-heading"><span>Recorded net-worth history</span><span className="flex items-center gap-2">{!demoMode && validHistory.length > 0 && <span className="wealth-history-origin">{validHistory[validHistory.length - 1].source === "manual" ? "User-recorded" : "Daily capture"}</span>}{demoMode && <span className="wealth-history-sample">Illustrative demo data</span>}<button type="button" onClick={recordSnapshot} disabled={savingSnapshot} className="wealth-snapshot-button" data-testid="record-net-worth-snapshot">{savingSnapshot ? "Saving…" : "Record today"}</button></span></div>
            <p className="wealth-history-cadence">Saved balances and entered asset valuations · one point per day; recording again refreshes today’s point.</p>
            {history.loading && !history.data ? <div className="wealth-history-loading" role="status">Loading saved snapshots…</div> : history.error && !history.data ? <div className="wealth-history-error" role="status"><strong>Net-worth history is temporarily unavailable.</strong><span>Your current balances are still shown above.</span><button onClick={() => history.refetch()}>Retry history</button></div> : hasTrendHistory ? <div className="wealth-chart-area"><TrendLine data={validHistory} xKey="date" yKey="net_worth" name="Net worth" dateLabels color="#4B5BE5" /></div> : <div className="wealth-history-sparse" role="status">{validHistory.length ? <><strong>{validHistory.length === 1 ? "One snapshot recorded" : "Not enough dated snapshots yet"}</strong><span>{validHistory.length === 1 ? `Latest: ${fmtDate(validHistory[0].date)} · ${inr(validHistory[0].net_worth, { compact: true })}.` : `${new Set(validHistory.map((point) => point.date)).size} distinct snapshots in this range.`} Record at least 3 dated snapshots to see a trend. No history is estimated.</span></> : <><strong>No recorded snapshots in this range</strong><span>This chart uses saved balance snapshots, not estimated historical values. Choose a wider range or add a dated snapshot.</span></>}</div>}
          </div>
          {snapshotMessage && <p className="mt-2 text-xs font-semibold text-income" role="status" data-testid="snapshot-confirmation">{snapshotMessage}</p>}
          {snapshotError && <p className="mt-2 text-xs font-semibold text-expense" role="alert">{snapshotError}</p>}
        </div>

        <Card className="xl:col-span-4 p-5 sm:p-6 flex flex-col">
          <div className="flex items-start justify-between">
            <div><div className="overline text-faint">Balance sheet</div><h2 className="font-display text-xl font-semibold text-ink mt-1">Assets & liabilities</h2><p className="text-xs text-subink mt-1">Your recorded financial position</p></div>
            <span className="w-10 h-10 rounded-xl bg-brand-light text-brand grid place-items-center"><Landmark size={18} /></span>
          </div>
          <div className="mt-5 space-y-5">
            <div className="flex items-end justify-between gap-3">
              <div><span className="block text-xs text-subink">Assets</span><strong className="num text-xl font-bold text-ink">{inr(data.total_assets, { compact: true })}</strong></div>
              <div className="text-right"><span className="block text-xs text-subink">Liabilities</span><strong className="num text-xl font-bold text-ink">{inr(data.total_liabilities, { compact: true })}</strong></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4" data-testid="account-freshness">
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-faint">Latest balance activity</p><p className="mt-1 text-xs font-semibold text-ink">{latestBalanceActivity ? fmtDate(latestBalanceActivity) : "No dated activity"}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-faint">Latest reconciliation</p><p className="mt-1 text-xs font-semibold text-ink">{latestReconciliation ? fmtDate(latestReconciliation) : "Not reconciled"}</p></div>
            </div>
            <div>
              <div className="h-2.5 rounded-full overflow-hidden bg-slate-100 flex" role="img" aria-label={hasBalanceSheetData ? `${assetShare}% of recorded assets and liabilities are assets` : "No recorded asset or liability balances"}>
                <div className="h-full rounded-full bg-gradient-to-r from-[#4b5be5] to-[#21b6c1] transition-[width] duration-500" style={{ width: `${assetShare}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-faint">
                {hasBalanceSheetData ? <><span>{assetShare}% assets</span><span>{100 - assetShare}% liabilities</span></> : <span className="w-full text-center">No balances recorded yet</span>}
              </div>
            </div>
          </div>
          <div className="mt-auto rounded-xl border border-line bg-muted/65 px-4 py-3.5">
            <p className="font-bold text-xs text-ink">Monthly cash position</p>
            <p className="text-[11px] text-subink mt-1">Income minus expenses: <strong className={data.month_savings >= 0 ? "text-income" : "text-expense"}>{data.month_savings >= 0 ? "+" : ""}{inr(data.month_savings, { compact: true })}</strong></p>
            <button onClick={() => nav("/cash-flow")} className="mt-2 text-xs text-brand font-bold">Explore cash flow <ArrowRight size={13} className="inline" /></button>
          </div>
        </Card>
      </section>

      <section className="grid lg:grid-cols-12 gap-4 sm:gap-5"><div className="lg:col-span-7 min-w-0"><ActionCenter compact /></div><Card className="lg:col-span-5 min-w-0 p-5 sm:p-6"><div className="flex items-start justify-between"><div><div className="overline text-faint">Your position</div><h3 className="font-display font-semibold text-lg text-ink mt-1">At a glance</h3></div><button onClick={() => nav("/planner")} className="w-9 h-9 rounded-xl bg-brand-light text-brand grid place-items-center" aria-label="Open financial planner"><ArrowUpRight size={17} /></button></div><div className="divide-y divide-line mt-4">{[["Liquid today", data.cash_position?.available_now, Wallet, "/accounts"], ["Expected receivables", data.cash_position?.expected_receivables, CircleDollarSign, "/lending"], ["Known obligations", data.cash_position?.upcoming_obligations, Landmark, "/loans"]].map(([label, value, Icon, path]) => <button key={label} onClick={() => nav(path)} className="w-full flex items-center justify-between py-3.5 text-left group"><span className="flex min-w-0 items-center gap-3 text-sm text-subink"><span className="w-8 h-8 shrink-0 rounded-lg bg-muted text-brand grid place-items-center"><Icon size={15} /></span><span className="truncate">{label}</span></span><span className="num shrink-0 font-bold text-ink group-hover:text-brand">{inr(value, { compact: true })}</span></button>)}<button type="button" onClick={() => nav("/goals")} className="w-full flex items-center justify-between gap-3 py-3.5 text-left group" data-testid="dashboard-goals-cta"><span className="flex min-w-0 items-center gap-3 text-sm text-subink"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-brand"><Sparkles size={15} /></span><span className="min-w-0"><span className="block truncate">Savings goals</span><span className="block text-[10px] text-faint">{goals.loading ? "Loading goals…" : goals.error ? "Goal data is unavailable" : activeGoals.length ? `${activeGoals.length} active · keep your plans in view` : "No goals tracked yet"}</span></span></span><span className="shrink-0 text-xs font-bold text-brand group-hover:text-brand-dark">{activeGoals.length ? "View goals" : goals.error ? "Open goals" : "Set a goal"} <ArrowRight size={13} className="inline" /></span></button></div></Card></section>
      <section className="grid lg:grid-cols-12 gap-4 sm:gap-5"><ChartCard className="asset-allocation-card lg:col-span-7" title="Asset allocation" subtitle={allocation.length ? "Breakdown of your recorded assets" : "No asset breakdown recorded yet"} right={<button onClick={() => nav("/net-worth")} className="text-xs font-bold text-income">View portfolio <ArrowRight size={13} className="inline" /></button>} height={allocationChartHeight}><div className="allocation-chart-total" data-testid="allocation-total-summary"><span className="overline text-faint">Total assets</span><span className="num font-extrabold text-ink">{inr(data.total_assets, { compact: true })}</span></div><div className="allocation-chart-layout"><div className="allocation-chart-donut"><Donut data={allocation} centerLabel="ASSET MIX" centerValue={String(allocation.length)} centerDetail="asset types" /></div><Legendish data={allocation} /></div></ChartCard><ChartCard className="lg:col-span-5" title="Monthly cash flow" subtitle="Income versus expenses" right={<button onClick={() => nav("/cash-flow")} className="text-xs font-bold text-income">See details <ArrowRight size={13} className="inline" /></button>} height={allocationChartHeight}><div className="grid grid-cols-2 gap-3 mb-4"><CashTile label="Income" value={data.month_income} positive /><CashTile label="Expenses" value={data.month_expense} /></div><div className="h-[132px]"><Bars data={data.cash_flow || []} xKey="month" monthLabels series={[{ key: "in", name: "Income", color: "#05A66C" }, { key: "out", name: "Expenses", color: "#F6B4A7" }]} /></div></ChartCard></section>

      <DetailDrawer open={!!drawer} onClose={() => setDrawer(null)} title={drawer === "assets" ? "Asset allocation" : "Liabilities"} eyebrow="Financial breakdown">{drawerItems.length ? <div className="space-y-3">{drawerItems.map((row) => <button onClick={() => nav(drawer === "assets" ? "/net-worth" : "/loans")} key={row.name} className="w-full text-left p-4 rounded-xl border border-line hover:border-brand/30 hover:bg-brand-light/30 flex justify-between"><span className="font-semibold text-ink">{row.name}</span><span className="num font-bold">{inr(row.value)}</span></button>)}</div> : <div className="chart-empty min-h-36">No breakdown data is recorded yet.</div>}</DetailDrawer>
    </div>}
  </StateBlock>;
}

function MiniStat({ label, value, positive, onClick }) { return <button onClick={onClick} className="soft-tile wealth-stat text-left rounded-xl px-3 py-2.5 min-w-0"><span className="wealth-label block text-[10px] truncate">{label}</span><strong className={`num wealth-value block text-sm sm:text-base mt-1 truncate ${positive ? "text-income" : ""}`}>{value}</strong></button>; }
function CashTile({ label, value, positive }) { const Direction = positive ? ArrowUpRight : ArrowDownRight; return <div className="rounded-xl bg-muted/80 p-3"><span className={`w-6 h-6 rounded-full grid place-items-center ${positive ? "bg-emerald-100 text-income" : "bg-rose-100 text-expense"}`}><Direction size={14} /></span><span className="block text-[10px] text-subink mt-2">{label}</span><strong className={`num text-lg mt-0.5 block ${positive ? "text-income" : "text-ink"}`}>{inr(value, { compact: true })}</strong></div>; }
