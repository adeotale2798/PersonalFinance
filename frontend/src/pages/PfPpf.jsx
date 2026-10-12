import React from "react";
import { ShieldCheck, Download } from "lucide-react";
import { useFetch } from "../lib/useFetch";
import { PageHeader, StateBlock, Badge, Button } from "../components/ui";
import KpiCard from "../components/KpiCard";
import { ChartCard, TrendLine } from "../components/charts";
import CrudManager from "../components/CrudManager";
import { downloadEntity } from "../lib/export";
import { inr } from "../lib/format";

export default function PfPpf() {
  const { data: s, loading, error, refetch } = useFetch("/pf-ppf/summary");
  const family = useFetch("/family");
  const ownerOpts = ["Self", ...((family.data || []).map((f) => f.name))];

  const fields = [
    { key: "kind", label: "Type", type: "select", options: ["PF", "PPF", "NPS"], default: "PF", required: true },
    { key: "institution", label: "Institution", placeholder: "EPFO / SBI", required: true },
    { key: "account_number", label: "Account No. (masked)" },
    { key: "owner", label: "Owner", type: "select", options: ownerOpts, default: "Self" },
    { key: "ownership_percent", label: "Ownership %", type: "number", default: 100 },
    { key: "opening_balance", label: "Opening Balance (₹)", type: "money", default: 0 },
    { key: "current_balance", label: "Current Balance (₹)", type: "money", required: true },
    { key: "valuation_source", label: "Valuation Source", type: "select", options: ["Statement", "Market quote", "Professional valuation", "Manual estimate", "Other"] },
    { key: "valuation_date", label: "Balance as of", type: "date" },
    { key: "maturity_date", label: "Maturity Date", type: "date" },
    { key: "next_contribution_date", label: "Next contribution due", type: "date" },
    { key: "expected_contribution", label: "Expected contribution (₹)", type: "money" },
    { key: "notes", label: "Notes", type: "textarea", full: true },
  ];
  const cols = [
    { key: "kind", label: "Type", render: (r) => <Badge tone={r.kind === "PF" ? "blue" : "brand"}>{r.kind}</Badge> },
    { key: "institution", label: "Institution", render: (r) => <div><div className="font-medium text-ink">{r.institution}</div><div className="text-xs text-faint num">{r.account_number}</div></div> },
    { key: "owner", label: "Owner" },
    { key: "current_balance", label: "Balance", align: "right", type: "money" },
  ];

  return (
    <>
      <PageHeader title="PF & PPF" subtitle="Provident fund and public provident fund balances." icon={ShieldCheck}
        actions={<Button variant="secondary" size="sm" onClick={() => downloadEntity("pf_ppf", {}, "pf-ppf")}><Download size={15} /> Export Excel</Button>} />
      <StateBlock loading={loading} error={error} onRetry={refetch}>
        {s && (
          <>
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
              <KpiCard label="Total PF + PPF" raw={s.total} tone="brand" testid="pf-total" />
              <KpiCard label="PF Balance" raw={s.pf} tone="info" testid="pf-pf" />
              <KpiCard label="PPF Balance" raw={s.ppf} tone="ink" testid="pf-ppf" />
            </div>
            <ChartCard title="Contribution Trend" height={240} className="mb-6">
              {s.contribution_trend?.length ? <TrendLine data={s.contribution_trend} color="#0D9488" name="Contributed" /> : <div className="h-full flex items-center justify-center text-sm text-faint">No contributions logged</div>}
            </ChartCard>
          </>
        )}
      </StateBlock>
      <CrudManager title="PF / PPF Accounts" endpoint="/pf-ppf" addLabel="Add account" fields={fields} columns={cols} onChanged={refetch} />
    </>
  );
}
