import React from "react";
import { useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Tags, Wallet } from "lucide-react";
import { Badge, Button, Card, PageHeader, StateBlock } from "../components/ui";
import { useFetch } from "../lib/useFetch";
import { fmtDate, inr } from "../lib/format";

const SEVERITY = { HIGH: "red", MEDIUM: "amber", LOW: "gray" };
const ICONS = {
  RECONCILIATION_VARIANCE: AlertTriangle,
  RECONCILIATION_DUE: RefreshCw,
  STALE_IMPORTED_BALANCE: Wallet,
  UNCATEGORIZED_TRANSACTION: Tags,
  UNASSIGNED_TRANSACTION: Wallet,
};

export default function DataQuality() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useFetch("/data-quality");
  const counts = data?.counts || {};
  const tiles = [
    { label: "Statement differences", value: counts.reconciliation_variances || 0, tone: "text-expense" },
    { label: "Checks due", value: counts.reconciliation_due || 0, tone: "text-amber" },
    { label: "Uncategorized", value: counts.uncategorized_transactions || 0, tone: "text-brand" },
    { label: "Unassigned accounts", value: counts.unassigned_transactions || 0, tone: "text-subink" },
  ];
  return <>
    <PageHeader title="Data Quality" subtitle="Find stale, incomplete, or inconsistent financial records and jump to a place to review each one." icon={Activity}
      actions={<Button variant="secondary" onClick={() => refetch()}><RefreshCw size={15} /> Refresh checks</Button>} />
    <StateBlock loading={loading} error={error} onRetry={refetch}>
      {data && <>
        <Card className="mb-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><div className="flex items-center gap-2"><h2 className="font-display text-lg font-bold text-ink">Workspace data check</h2><Badge tone={data.total_issues ? "amber" : "green"}>{data.total_issues ? `${data.total_issues} findings` : "Looks good"}</Badge></div><p className="mt-1 text-xs text-subink">Generated {fmtDate(data.generated_at)}. Checks flag records for review; they never adjust balances automatically.</p></div>
            {!data.total_issues && <CheckCircle2 className="text-income" size={25} />}
          </div>
          <div className="mt-5 grid grid-cols-2 xl:grid-cols-4 gap-3">{tiles.map((tile) => <div key={tile.label} className="rounded-xl bg-muted/60 p-3"><p className="overline text-faint">{tile.label}</p><p className={`num mt-1 text-2xl font-extrabold ${tile.tone}`}>{tile.value}</p></div>)}</div>
          <p className="mt-4 text-[11px] text-subink">Imported balances are flagged after {data.thresholds.imported_balance_stale_days} days without a source update. Account reconciliations are due after {data.thresholds.reconciliation_due_days} days.</p>
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4"><h2 className="font-display font-semibold text-ink">Items to review</h2><p className="mt-1 text-xs text-subink">Highest-impact checks appear first.</p></div>
          {data.findings.length ? <div className="divide-y divide-line">{data.findings.map((finding) => {
            const Icon = ICONS[finding.kind] || AlertTriangle;
            return <div key={finding.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-brand"><Icon size={17} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-ink">{finding.title}</h3><Badge tone={SEVERITY[finding.severity]}>{finding.severity.toLowerCase()}</Badge></div><p className="mt-1 text-xs leading-relaxed text-subink">{finding.detail}</p>{finding.amount != null && <p className="num mt-1 text-xs font-semibold text-ink">{inr(finding.amount)}</p>}</div></div>
              <Button variant="secondary" size="sm" className="shrink-0 self-end sm:self-center" onClick={() => navigate(finding.path)}>Review record</Button>
            </div>;
          })}</div> : <div className="p-10 text-center"><CheckCircle2 className="mx-auto text-income" size={30} /><p className="mt-3 font-semibold text-ink">No data-quality issues found</p><p className="mt-1 text-sm text-subink">We’ll list items here when a balance needs a review or a transaction is missing useful details.</p></div>}
          {data.truncated && <p className="border-t border-line px-5 py-3 text-xs text-subink">Only the first 100 findings are shown. Fix the displayed items and refresh for the next set.</p>}
        </Card>
      </>}
    </StateBlock>
  </>;
}
