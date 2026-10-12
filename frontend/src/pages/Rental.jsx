import React from "react";
import { Building2 } from "lucide-react";
import { useFetch } from "../lib/useFetch";
import { PageHeader, StateBlock, StatusBadge } from "../components/ui";
import KpiCard from "../components/KpiCard";
import { ChartCard, TrendLine, Donut } from "../components/charts";
import CrudManager from "../components/CrudManager";
import { inr } from "../lib/format";

export default function Rental() {
  const { data: s, loading, error, refetch } = useFetch("/rental/summary");
  const props = useFetch("/rental/properties");
  const assets = useFetch("/assets");
  const propNames = (props.data || []).map((p) => ({ value: p.name, label: p.name }));
  const assetOptions = (assets.data || []).map((asset) => ({ value: asset.id, label: asset.name }));

  const propFields = [
    { key: "name", label: "Property Name", required: true, full: true },
    { key: "owner", label: "Owner", default: "Self" },
    { key: "ownership_percent", label: "Ownership %", type: "number", default: 100 },
    { key: "current_value", label: "Current value (₹)", type: "money" },
    { key: "valuation_source", label: "Valuation Source", type: "select", options: ["Statement", "Market quote", "Professional valuation", "Manual estimate", "Other"] },
    { key: "valuation_date", label: "Value as of", type: "date" },
    { key: "balance_sheet_asset_id", label: "Linked balance-sheet asset", type: "select", options: assetOptions },
    { key: "address", label: "Address", full: true },
    { key: "image_url", label: "Image URL", full: true },
    { key: "tenant", label: "Tenant (creates a unit)" },
    { key: "monthly_rent", label: "Monthly Rent (₹)", type: "money" },
    { key: "rent_start_date", label: "Rent Start Date", type: "date" },
    { key: "rent_due_day", label: "Due Day (1–31)", type: "number", default: 1 },
    { key: "annual_increase_percent", label: "Annual Increase %", type: "number", default: 0 },
    { key: "deposit", label: "Deposit (₹)", type: "money" },
  ];
  const propCols = [
    { key: "name", label: "Property", render: (r) => <div><div className="font-medium text-ink">{r.name}</div><div className="text-xs text-faint">{r.address}</div></div> },
    { key: "units", label: "Units", render: (r) => <span className="num">{(r.units || []).length}</span> },
    { key: "rent", label: "Monthly Rent", align: "right", render: (r) => <span className="num font-semibold">{inr((r.units || []).reduce((a, u) => a + (u.monthly_rent || 0), 0))}</span> },
  ];

  const payFields = [
    { key: "property_name", label: "Property", type: "select", options: propNames, required: true },
    { key: "unit", label: "Unit", placeholder: "Ground Floor" },
    { key: "tenant", label: "Tenant" },
    { key: "period", label: "Period (YYYY-MM)", placeholder: "2026-06", required: true },
    { key: "due_date", label: "Due Date", type: "date" },
    { key: "amount_due", label: "Rent Due (₹)", type: "money", required: true },
    { key: "amount_received", label: "Received (₹)", type: "money", default: 0 },
  ];
  const payCols = [
    { key: "property_name", label: "Property", render: (r) => <div><div className="font-medium text-ink">{r.property_name}</div><div className="text-xs text-faint">{r.unit} · {r.tenant}</div></div> },
    { key: "period", label: "Period" },
    { key: "amount_due", label: "Due", align: "right", type: "money" },
    { key: "amount_received", label: "Received", align: "right", render: (r) => <span className="num text-income">{inr(r.amount_received)}</span> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Rental Income" subtitle="Properties, tenants and rent collection." icon={Building2} />
      <StateBlock loading={loading} error={error} onRetry={refetch}>
        {s && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
              <KpiCard label="Monthly Rent" raw={s.monthly_rent} tone="brand" testid="rent-monthly" />
              <KpiCard label="Collected · Month" raw={s.collected} tone="income" testid="rent-collected" />
              <KpiCard label="Outstanding" raw={s.outstanding} tone="ink" testid="rent-outstanding" />
              <KpiCard label="Overdue" raw={s.overdue} tone="expense" testid="rent-overdue" />
              <KpiCard label="Collection Rate" value={`${s.collection_rate}%`} tone="amber" testid="rent-rate" />
            </div>
            <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
              <ChartCard title="Rental Income Trend" height={230}>
                {s.income_trend?.length ? <TrendLine data={s.income_trend} color="#0D9488" name="Collected" /> : <NoData />}
              </ChartCard>
              <ChartCard title="Income by Property" height={230}>
                {s.by_property?.length ? <Donut data={s.by_property} centerLabel="Total" centerValue={inr(s.income_trend?.reduce((a, x) => a + x.value, 0) || 0, { compact: true })} /> : <NoData />}
              </ChartCard>
            </div>
          </>
        )}
      </StateBlock>
      <div className="space-y-6">
        <CrudManager title="Properties" endpoint="/rental/properties" addLabel="Add property" fields={propFields} columns={propCols}
          onChanged={() => { refetch(); props.refetch(); }}
          deps={[assets.data]}
          transform={(p) => {
            const { tenant, monthly_rent, deposit, rent_start_date, rent_due_day, annual_increase_percent, ...rest } = p;
            const body = { ...rest };
            if (monthly_rent) body.units = [{ name: "Unit 1", tenant: tenant || "", monthly_rent: monthly_rent || 0, deposit: deposit || 0, rent_start_date: p.rent_start_date, rent_due_day: p.rent_due_day || 1, annual_increase_percent: p.annual_increase_percent || 0, recurring_enabled: true, status: "OCCUPIED" }];
            return body;
          }} />
        <CrudManager title="Rent Collection" endpoint="/rental/payments" addLabel="Record rent" fields={payFields} columns={payCols} onChanged={refetch} deps={[props.data?.length]} />
      </div>
    </>
  );
}
function NoData() { return <div className="h-full flex items-center justify-center text-sm text-faint">No data yet</div>; }
