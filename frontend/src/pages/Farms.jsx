import React, { useState } from "react";
import { Sprout, MapPin, Leaf, Download } from "lucide-react";
import { useFetch } from "../lib/useFetch";
import { PageHeader, StateBlock, Card, Badge, Segmented, Button, Modal, Field, Input } from "../components/ui";
import KpiCard from "../components/KpiCard";
import { ChartCard, CashFlowArea } from "../components/charts";
import CrudManager from "../components/CrudManager";
import { downloadEntity } from "../lib/export";
import { inr, todayISO } from "../lib/format";
import api, { apiError } from "../lib/api";

export default function Farms() {
  const { data: s, loading, error, refetch } = useFetch("/farms/summary");
  const farms = useFetch("/farms");
  const assets = useFetch("/assets");
  const [filter, setFilter] = useState("all");

  const farmOpts = (farms.data || []).map((f) => ({ value: f.id, label: `${f.name} (${f.number})` }));
  const assetOptions = (assets.data || []).map((asset) => ({ value: asset.id, label: asset.name }));
  const farmMap = Object.fromEntries((farms.data || []).map((f) => [f.id, f.name]));

  const farmFields = [
    { key: "name", label: "Farm Name", required: true },
    { key: "number", label: "Farm Number / ID", required: true },
    { key: "crop", label: "Crop", default: "Guava" },
    { key: "area", label: "Area", type: "number" },
    { key: "area_unit", label: "Unit", type: "select", options: ["acre", "hectare", "guntha", "bigha"], default: "acre" },
    { key: "location", label: "Location", full: true },
    { key: "owner", label: "Owner / entity", default: "Farm / business" },
    { key: "ownership_percent", label: "Ownership %", type: "number", default: 100 },
    { key: "estimated_value", label: "Estimated value (₹)", type: "money" },
    { key: "valuation_source", label: "Valuation Source", type: "select", options: ["Statement", "Market quote", "Professional valuation", "Manual estimate", "Other"] },
    { key: "valuation_date", label: "Value as of", type: "date" },
    { key: "balance_sheet_asset_id", label: "Linked balance-sheet asset", type: "select", options: assetOptions },
    { key: "annual_rent_enabled", label: "Rented out yearly? (Yes/No)", type: "select", options: [{ value: true, label: "Yes" }, { value: false, label: "No" }], default: false },
    { key: "tenant", label: "Yearly Lease Tenant" },
    { key: "annual_rent", label: "Annual Rent (₹)", type: "money" },
    { key: "lease_start_date", label: "Lease Start Date", type: "date" },
    { key: "annual_rent_due_date", label: "Annual Rent Due Date", type: "date" },
    { key: "annual_increase_percent", label: "Annual Increase %", type: "number", default: 0 },
    { key: "notes", label: "Notes", type: "textarea", full: true },
  ];
  const farmCols = [
    { key: "name", label: "Farm", render: (r) => <div><div className="font-medium text-ink">{r.name}</div><div className="text-xs text-faint num">{r.number}</div></div> },
    { key: "crop", label: "Crop", render: (r) => <Badge tone="green"><Leaf size={11} /> {r.crop}</Badge> },
    { key: "area", label: "Area", render: (r) => `${r.area || "—"} ${r.area_unit || ""}` },
    { key: "location", label: "Location" },
  ];

  const ledgerFields = [
    { key: "type", label: "Type", type: "select", options: [{ value: "INCOME", label: "Income" }, { value: "EXPENSE", label: "Expense" }], default: "EXPENSE", required: true },
    { key: "farm_id", label: "Farm", type: "select", options: farmOpts, required: true },
    { key: "date", label: "Date", type: "date", default: todayISO(), required: true },
    { key: "amount", label: "Amount (₹)", type: "money", required: true },
    { key: "category", label: "Category / Source", placeholder: "Guava Sale, Fertilizer, Labour…", required: true },
    { key: "description", label: "Note", full: true },
  ];
  const ledgerCols = [
    { key: "date", label: "Date", type: "date" },
    { key: "farm_id", label: "Farm", render: (r) => <span className="font-medium text-ink">{farmMap[r.farm_id] || "—"}</span> },
    { key: "type", label: "Type", render: (r) => <Badge tone={r.type === "INCOME" ? "green" : "red"}>{r.type}</Badge> },
    { key: "category", label: "Category", render: (r) => r.category || r.source || "—" },
    { key: "amount", label: "Amount", align: "right", render: (r) => <span className={"num font-semibold " + (r.type === "INCOME" ? "text-income" : "text-expense")}>{inr(r.amount)}</span> },
  ];

  const ledgerUrl = filter === "all" ? "/transactions?scope=FARM" : `/transactions?scope=FARM&farm_id=${filter}`;

  return (
    <>
      <PageHeader title="Farms & Farming" subtitle="Per-farm income & expense ledger for your guava farms." icon={Sprout}
        actions={<Button variant="secondary" size="sm" onClick={() => downloadEntity("farms", {}, "farms")}><Download size={15} /> Export Excel</Button>} />
      <StateBlock loading={loading} error={error} onRetry={refetch}>
        {s && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
              <KpiCard label="Farm Income" raw={s.total_income} tone="income" testid="farm-income" />
              <KpiCard label="Farm Expense" raw={s.total_expense} tone="expense" testid="farm-expense" />
              <KpiCard label="Net Profit" raw={s.net} tone={s.net >= 0 ? "brand" : "expense"} testid="farm-net" />
              <KpiCard label="Farms" value={String(s.count)} tone="violet" icon={Sprout} testid="farm-count" />
              <KpiCard label="Yearly Rent Collected" raw={s.annual_rent_received} tone="amber" testid="farm-rent-collected" />
            </div>
            <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
              {s.per_farm.map((f) => (
                <Card key={f.id} className="p-5" data-testid={`farm-summary-${f.id}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div><h3 className="font-display font-semibold text-ink">{f.name}</h3><div className="flex items-center gap-1 text-xs text-faint mt-0.5"><MapPin size={11} /> {f.location || "—"} · {f.area} {f.area_unit}</div></div>
                    <Badge tone="green">{f.number}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-emerald-50"><div className="overline text-faint">Income</div><div className="num font-semibold text-sm text-income">{inr(f.income, { compact: true })}</div></div>
                    <div className="p-2 rounded-lg bg-rose-50"><div className="overline text-faint">Expense</div><div className="num font-semibold text-sm text-expense">{inr(f.expense, { compact: true })}</div></div>
                    <div className="p-2 rounded-lg bg-teal-50"><div className="overline text-faint">Net</div><div className="num font-semibold text-sm text-brand">{inr(f.net, { compact: true })}</div></div>
                  </div>
                </Card>
              ))}
            </div>
            {s.monthly?.length > 0 && (
              <ChartCard title="Farm Cash Flow" subtitle="Income vs expense" height={240} className="mb-6">
                <CashFlowArea data={s.monthly} />
              </ChartCard>
            )}
          </>
        )}
      </StateBlock>

      <div className="space-y-6">
        <CrudManager title="Farms" endpoint="/farms" addLabel="Add farm" fields={farmFields} columns={farmCols} deps={[assets.data]} onChanged={() => { refetch(); farms.refetch(); }}
          transform={(farm) => ({ ...farm, annual_rent_enabled: farm.annual_rent_enabled === true || farm.annual_rent_enabled === "true" })} />
        <AnnualRentCollection onChanged={refetch} />
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className="font-display font-semibold text-ink px-1">Farm Ledger</h3>
            <Segmented testid="farm-filter" value={filter} onChange={setFilter}
              options={[{ value: "all", label: "All" }, ...(farms.data || []).map((f) => ({ value: f.id, label: f.name }))]} />
          </div>
          <CrudManager title="Ledger Entries" endpoint="/transactions" listEndpoint={ledgerUrl}
            addLabel="Add entry" fields={ledgerFields} columns={ledgerCols} onChanged={refetch}
            transform={(x) => ({ ...x, scope: "FARM", source: x.type === "INCOME" ? x.category : undefined })} deps={[filter, farms.data?.length]} />
        </div>
      </div>
    </>
  );
}

function AnnualRentCollection({ onChanged }) {
  const rents = useFetch("/farms/rent-payments");
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const receive = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) { setError("Enter a valid received amount"); return; }
    setBusy(true); setError("");
    try {
      await api.post(`/farms/rent-payments/${selected.id}/receive`, { amount: value });
      setSelected(null); setAmount(""); rents.refetch(); onChanged();
    } catch (e) { setError(e.response ? apiError(e) : e.message); } finally { setBusy(false); }
  };

  const rows = rents.data || [];
  return <Card className="overflow-hidden">
    <div className="px-5 py-4 border-b border-line"><h3 className="font-display font-semibold text-ink">Yearly Farm Rent</h3><p className="text-xs text-faint mt-0.5">Annual lease dues are created automatically from each farm’s lease settings.</p></div>
    <StateBlock loading={rents.loading} error={rents.error} empty={rows.length === 0} emptyText="No yearly farm leases configured yet." onRetry={rents.refetch}>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/60 text-faint overline border-b border-line"><tr><th className="px-4 py-2.5">Farm / Tenant</th><th className="px-4 py-2.5">Year</th><th className="px-4 py-2.5 text-right">Due</th><th className="px-4 py-2.5 text-right">Received</th><th className="px-4 py-2.5 text-right">Balance</th><th className="px-4 py-2.5" /></tr></thead><tbody>{rows.map((r) => <tr key={r.id} className="border-b border-line/70"><td className="px-4 py-3"><div className="font-medium text-ink">{r.farm_name}</div><div className="text-xs text-faint">{r.tenant || "—"}</div></td><td className="px-4 py-3">{r.period}</td><td className="px-4 py-3 text-right num">{inr(r.amount_due)}</td><td className="px-4 py-3 text-right num text-income">{inr(r.amount_received)}</td><td className="px-4 py-3 text-right num font-semibold">{inr(Math.max(r.amount_due - r.amount_received, 0))}</td><td className="px-4 py-3 text-right">{r.amount_received < r.amount_due && <Button size="sm" variant="secondary" onClick={() => { setSelected(r); setAmount(""); setError(""); }}>Record payment</Button>}</td></tr>)}</tbody></table></div>
    </StateBlock>
    <Modal open={!!selected} onClose={() => setSelected(null)} title={`Record farm rent — ${selected?.farm_name}`}>
      <Field label={`Amount received (max ${inr(Math.max((selected?.amount_due || 0) - (selected?.amount_received || 0), 0))})`}><Input type="number" autoFocus value={amount} max={Math.max((selected?.amount_due || 0) - (selected?.amount_received || 0), 0)} onChange={(e) => setAmount(e.target.value)} /></Field>
      {error && <div className="text-sm text-expense mt-3">{error}</div>}<div className="flex gap-2 pt-4"><Button variant="secondary" className="flex-1" onClick={() => setSelected(null)}>Cancel</Button><Button className="flex-1" disabled={busy} onClick={receive}>{busy ? "Saving…" : "Save payment"}</Button></div>
    </Modal>
  </Card>;
}
