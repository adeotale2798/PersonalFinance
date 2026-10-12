import React, { useEffect, useState } from "react";
import { PiggyBank, Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../lib/useFetch";
import { PageHeader, StateBlock, Badge, DetailDrawer, Button, Modal, Field, Input, Select } from "../components/ui";
import KpiCard from "../components/KpiCard";
import { ChartCard, Donut, TrendLine } from "../components/charts";
import CrudManager from "../components/CrudManager";
import { inr, todayISO } from "../lib/format";
import api, { apiError } from "../lib/api";

export default function Savings() {
  const nav = useNavigate();
  const [selectedInvestment, setSelectedInvestment] = useState(null);
  const [investmentActivity, setInvestmentActivity] = useState([]);
  const [investmentValuations, setInvestmentValuations] = useState([]);
  const [entryMode, setEntryMode] = useState("");
  const [entryType, setEntryType] = useState("CONTRIBUTION");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayISO());
  const [entryNote, setEntryNote] = useState("");
  const [valuationSource, setValuationSource] = useState("Statement");
  const [entryError, setEntryError] = useState("");
  const [entryBusy, setEntryBusy] = useState(false);
  const { data: s, loading, error, refetch } = useFetch("/savings/summary");
  const invSummary = useFetch("/investments");
  const family = useFetch("/family");
  const ownerOpts = ["Self", ...((family.data || []).map((f) => f.name))];

  const invTotal = (invSummary.data || []).reduce((a, i) => a + (i.current_value || 0), 0);
  const invCost = (invSummary.data || []).reduce((a, i) => a + (i.cost || 0), 0);

  useEffect(() => {
    if (!selectedInvestment) {
      setInvestmentActivity([]);
      setInvestmentValuations([]);
      return undefined;
    }
    let active = true;
    Promise.all([
      api.get(`/investments/${selectedInvestment.id}/activity`),
      api.get(`/investments/${selectedInvestment.id}/valuations`),
    ]).then(([activity, valuations]) => {
      if (active) {
        setInvestmentActivity(activity.data);
        setInvestmentValuations(valuations.data);
      }
    }).catch((error) => {
      if (active) setEntryError(apiError(error));
    });
    return () => { active = false; };
  }, [selectedInvestment?.id]);

  const savingsFields = [
    { key: "name", label: "Name", required: true, full: true },
    { key: "type", label: "Type", type: "select", options: ["SAVINGS", "FD", "RD", "CASH", "OTHER"], default: "SAVINGS", required: true },
    { key: "institution", label: "Institution" },
    { key: "owner", label: "Owner", type: "select", options: ownerOpts, default: "Self" },
    { key: "ownership_percent", label: "Ownership %", type: "number", default: 100 },
    { key: "current_value", label: "Current Value (₹)", type: "money", required: true },
    { key: "valuation_source", label: "Valuation Source", type: "select", options: ["Statement", "Market quote", "Professional valuation", "Manual estimate", "Other"] },
    { key: "valuation_date", label: "Value as of", type: "date" },
    { key: "interest_rate", label: "Interest %", type: "number" },
    { key: "start_date", label: "Start Date", type: "date" },
    { key: "maturity_date", label: "Maturity Date", type: "date" },
    { key: "notes", label: "Notes", type: "textarea", full: true },
  ];
  const savingsCols = [
    { key: "name", label: "Name", render: (r) => <div><div className="font-medium text-ink">{r.name}</div><div className="text-xs text-faint">{r.institution}</div></div> },
    { key: "type", label: "Type", render: (r) => <Badge tone="brand">{r.type}</Badge> },
    { key: "owner", label: "Owner" },
    { key: "interest_rate", label: "Rate", render: (r) => r.interest_rate ? `${r.interest_rate}%` : "—" },
    { key: "current_value", label: "Value", align: "right", type: "money" },
  ];

  const invFields = [
    { key: "name", label: "Investment", required: true, full: true },
    { key: "type", label: "Type", type: "select", options: ["Stocks", "Mutual Fund", "Bonds", "Deposits", "Gold", "Crypto", "Other"], default: "Mutual Fund" },
    { key: "cost", label: "Invested (₹)", type: "money", required: true },
    { key: "purchase_date", label: "Initial purchase date", type: "date" },
    { key: "current_value", label: "Current Value (₹)", type: "money", required: true },
    { key: "owner", label: "Owner", type: "select", options: ownerOpts, default: "Self" },
    { key: "ownership_percent", label: "Ownership %", type: "number", default: 100 },
    { key: "valuation_source", label: "Valuation Source", type: "select", options: ["Statement", "Market quote", "Professional valuation", "Manual estimate", "Other"] },
    { key: "valuation_date", label: "Value as of", type: "date" },
  ];
  const invCols = [
    { key: "name", label: "Investment", render: (r) => <span className="font-medium text-ink">{r.name}</span> },
    { key: "type", label: "Type", render: (r) => <Badge tone="blue">{r.type}</Badge> },
    { key: "cost", label: "Invested", align: "right", type: "money" },
    { key: "current_value", label: "Current", align: "right", type: "money" },
    { key: "gain", label: "Change vs cost", align: "right", render: (r) => { const g = (r.current_value || 0) - (r.cost || 0); return <span className={"num font-semibold " + (g >= 0 ? "text-income" : "text-expense")}>{g >= 0 ? "+" : ""}{inr(g)}</span>; } },
  ];

  const openEntry = (mode) => {
    setEntryMode(mode);
    setEntryType("CONTRIBUTION");
    setEntryAmount(mode === "valuation" ? String(selectedInvestment?.current_value || "") : "");
    setEntryDate(todayISO());
    setEntryNote("");
    setEntryError("");
  };

  const saveEntry = async () => {
    if (!selectedInvestment) return;
    setEntryBusy(true);
    setEntryError("");
    try {
      if (entryMode === "valuation") {
        const { data: valuation } = await api.post(`/investments/${selectedInvestment.id}/valuations`, {
          current_value: Number(entryAmount), date: entryDate, source: valuationSource,
        });
        if (valuation.current_position_updated) {
          setSelectedInvestment((current) => ({
            ...current,
            current_value: valuation.current_value,
            valuation_date: valuation.date,
            valuation_source: valuation.source,
          }));
        }
      } else {
        await api.post(`/investments/${selectedInvestment.id}/activity`, {
          type: entryType, amount: Number(entryAmount), date: entryDate, note: entryNote,
        });
      }
      const [activity, valuations] = await Promise.all([
        api.get(`/investments/${selectedInvestment.id}/activity`),
        api.get(`/investments/${selectedInvestment.id}/valuations`),
      ]);
      setInvestmentActivity(activity.data);
      setInvestmentValuations(valuations.data);
      await invSummary.refetch(true);
      setEntryMode("");
    } catch (error) {
      setEntryError(apiError(error));
    } finally {
      setEntryBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Savings & Investments" subtitle="Deposits, savings instruments and market investments." icon={PiggyBank} actions={<button onClick={()=>nav("/smart-import")} className="inline-flex h-9 items-center gap-2 px-3 rounded-lg bg-brand text-white text-xs font-semibold"><Bot size={15}/> Smart import</button>} />
      <StateBlock loading={loading} error={error} onRetry={refetch}>
        {s && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <KpiCard label="Total Savings" raw={s.total} tone="brand" testid="sav-total" />
              <KpiCard label="Savings Products" value={String(s.count)} tone="ink" testid="sav-count" />
              <KpiCard label="Investments Value" raw={invTotal} tone="info" testid="sav-inv" />
              <KpiCard label="Change vs recorded cost" raw={invTotal - invCost} sub="Unrealized; excludes proceeds and fees" tone={invTotal - invCost >= 0 ? "income" : "expense"} testid="sav-gain" />
            </div>
            <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
              <ChartCard title="Savings by Type" height={220}>
                {s.by_type?.length ? <Donut data={s.by_type} centerLabel="Total" centerValue={inr(s.total, { compact: true })} /> : <NoData />}
              </ChartCard>
              <ChartCard title="Contribution Trend" height={220}>
                {s.contribution_trend?.length ? <TrendLine data={s.contribution_trend} color="#0D9488" name="Contributed" /> : <NoData />}
              </ChartCard>
            </div>
          </>
        )}
      </StateBlock>
      <div className="space-y-6">
        <CrudManager title="Savings Products" endpoint="/savings" addLabel="Add savings" fields={savingsFields} columns={savingsCols} onChanged={refetch} />
        <CrudManager title="Investments" endpoint="/investments" addLabel="Add investment" fields={invFields} columns={invCols} onRowClick={setSelectedInvestment} onChanged={() => { refetch(); invSummary.refetch(); }} />
      </div>
      <DetailDrawer open={!!selectedInvestment} onClose={() => setSelectedInvestment(null)} title={selectedInvestment?.name} eyebrow="Investment position">
        <div className="grid grid-cols-2 gap-3">
          {[["Current value", selectedInvestment?.current_value], ["Recorded cost", selectedInvestment?.cost], ["Change vs cost", (selectedInvestment?.current_value || 0) - (selectedInvestment?.cost || 0)], ["Quantity", selectedInvestment?.quantity || 0]].map(([label, value]) => <div key={label} className="p-3 rounded-lg bg-muted"><div className="overline text-faint">{label}</div><div className="num font-bold text-ink mt-1">{label === "Quantity" ? value : inr(value)}</div></div>)}
        </div>
        <p className="mt-4 text-xs text-subink">Value as of {selectedInvestment?.valuation_date || "date not recorded"} · {selectedInvestment?.valuation_source || "source not recorded"}</p>
        <p className="mt-2 text-xs text-subink">Change versus recorded cost is not an annualized or time-weighted return. Returns require complete dated cash flows and valuations.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => openEntry("activity")}>Record activity</Button>
          <Button size="sm" variant="secondary" onClick={() => openEntry("valuation")}>Record valuation</Button>
        </div>
        {entryError && !entryMode && <p className="mt-3 text-sm text-expense" role="alert">{entryError}</p>}
        <section className="mt-6">
          <h3 className="font-display font-semibold text-ink">Activity history</h3>
          {investmentActivity.length ? <div className="mt-2 divide-y divide-line">{investmentActivity.map((item) => <div key={item.id} className="flex justify-between gap-3 py-2 text-sm"><span><span className="font-medium">{item.type}</span><span className="block text-xs text-faint">{item.date}{item.note ? ` · ${item.note}` : ""}</span></span><span className="num font-semibold">{inr(item.amount)}</span></div>)}</div> : <p className="mt-2 text-xs text-faint">No investment cash-flow activity recorded.</p>}
        </section>
        <section className="mt-5">
          <h3 className="font-display font-semibold text-ink">Valuation history</h3>
          {investmentValuations.length ? <div className="mt-2 divide-y divide-line">{investmentValuations.map((item) => <div key={item.id} className="flex justify-between gap-3 py-2 text-sm"><span><span className="font-medium">{item.source}</span><span className="block text-xs text-faint">{item.date}</span></span><span className="num font-semibold">{inr(item.current_value)}</span></div>)}</div> : <p className="mt-2 text-xs text-faint">No dated valuations recorded.</p>}
        </section>
      </DetailDrawer>
      <Modal open={!!entryMode} onClose={() => !entryBusy && setEntryMode("")} title={entryMode === "valuation" ? "Record valuation" : "Record investment activity"}>
        {entryMode === "activity" && <Field label="Activity"><Select value={entryType} onChange={(event) => setEntryType(event.target.value)}><option value="CONTRIBUTION">Contribution</option><option value="SALE">Sale proceeds</option><option value="DISTRIBUTION">Distribution</option><option value="FEE">Fee</option></Select></Field>}
        <Field label={entryMode === "valuation" ? "Market value (₹)" : "Cash-flow amount (₹)"}><Input type="number" min="0" step="0.01" value={entryAmount} onChange={(event) => setEntryAmount(event.target.value)} /></Field>
        <Field label={entryMode === "valuation" ? "Valuation date" : "Activity date"}><Input type="date" value={entryDate} max={todayISO()} onChange={(event) => setEntryDate(event.target.value)} /></Field>
        {entryMode === "valuation" && <Field label="Source"><Select value={valuationSource} onChange={(event) => setValuationSource(event.target.value)}>{["Statement", "Market quote", "Professional valuation", "Manual estimate", "Other"].map((source) => <option key={source}>{source}</option>)}</Select></Field>}
        {entryMode === "activity" && <Field label="Note (optional)"><Input value={entryNote} onChange={(event) => setEntryNote(event.target.value)} maxLength={500} /></Field>}
        {entryError && entryMode && <p className="text-sm text-expense mt-3" role="alert">{entryError}</p>}
        <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" disabled={entryBusy} onClick={() => setEntryMode("")}>Cancel</Button><Button disabled={entryBusy || !entryAmount || Number(entryAmount) <= 0 || !entryDate} onClick={saveEntry}>{entryBusy ? "Saving…" : "Save record"}</Button></div>
      </Modal>
    </>
  );
}
function NoData() { return <div className="h-full flex items-center justify-center text-sm text-faint">No data yet</div>; }
