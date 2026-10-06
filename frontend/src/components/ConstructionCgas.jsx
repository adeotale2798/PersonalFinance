import React, { useMemo, useState } from "react";
import { Badge, Button, Card, Field, Input, Modal, Select, StateBlock, Textarea } from "./ui";
import DocumentsPanel from "./DocumentsPanel";
import KpiCard from "./KpiCard";
import { useFetch } from "../lib/useFetch";
import api, { apiError } from "../lib/api";
import { fmtDate, inr } from "../lib/format";

const STATUS_LABELS = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted to bank",
  RETURNED: "Returned for changes",
  APPROVED: "Approved",
  PARTIALLY_RELEASED: "Partially released",
  RELEASED: "Released",
  COMPLETED: "Completed",
};

const DOCUMENT_CATEGORIES = [
  "Contractor Bill",
  "CA Certificate",
  "Architect Certificate",
  "Bank Form C",
  "Payment Proof",
  "Re-deposit Proof",
  "Other",
];

const emptyDemand = () => ({
  stage_name: "",
  requested_amount: "",
  requested_date: "",
  bank_reference: "",
  status: "DRAFT",
  bills: [{ contractor: "", bill_number: "", bill_date: "", amount: "" }],
  withdrawn_amount: "",
  withdrawal_date: "",
  utilized_amount: "",
  redeposited_amount: "",
  notes: "",
});

function billTotal(bills = []) {
  return bills.reduce((total, bill) => total + (Number(bill.amount) || 0), 0);
}

export default function ConstructionCgas({ projectId }) {
  const endpoint = `/projects/${projectId}/cgas`;
  const { data, loading, error, refetch } = useFetch(endpoint, [projectId]);
  const accounts = useFetch("/accounts");
  const configuration = data?.configuration;
  const demands = data?.demands || [];
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [configSaving, setConfigSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyDemand);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const draftConfig = config || {
    bank_name: configuration?.bank_name || "",
    account_id: configuration?.account_id || "",
    deposit_date: configuration?.deposit_date || "",
    total_deposited_amount: String(configuration?.total_deposited_amount ?? 0),
    construction_deadline: configuration?.construction_deadline || "",
    notes: configuration?.notes || "",
  };
  const totals = useMemo(() => demands.reduce((result, demand) => {
    result.requested += Number(demand.requested_amount || 0);
    result.withdrawn += Number(demand.withdrawn_amount || 0);
    result.unaccounted += Number(demand.unaccounted_amount || 0);
    return result;
  }, { requested: 0, withdrawn: 0, unaccounted: 0 }), [demands]);

  const saveConfiguration = async (event) => {
    event.preventDefault();
    setConfigSaving(true);
    setConfigError("");
    try {
      await api.put(endpoint, { ...draftConfig, account_id: draftConfig.account_id || null });
      setConfig(null);
      await refetch(true);
    } catch (requestError) {
      setConfigError(apiError(requestError));
    } finally {
      setConfigSaving(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyDemand());
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (demand) => {
    setEditing(demand);
    setForm({
      ...emptyDemand(),
      ...demand,
      requested_amount: String(demand.requested_amount ?? ""),
      requested_date: demand.requested_date || "",
      withdrawn_amount: String(demand.withdrawn_amount || ""),
      withdrawal_date: demand.withdrawal_date || "",
      utilized_amount: String(demand.utilized_amount || ""),
      redeposited_amount: String(demand.redeposited_amount || ""),
      bills: demand.bills?.length
        ? demand.bills.map((bill) => ({ ...bill, amount: String(bill.amount ?? "") }))
        : [{ contractor: "", bill_number: "", bill_date: "", amount: "" }],
    });
    setFormError("");
    setModalOpen(true);
  };

  const setBill = (index, key, value) => {
    setForm((current) => ({
      ...current,
      bills: current.bills.map((bill, billIndex) => billIndex === index ? { ...bill, [key]: value } : bill),
    }));
  };

  const saveDemand = async (event) => {
    event.preventDefault();
    setFormError("");
    const requestedAmount = Number(form.requested_amount);
    const withdrawnAmount = Number(form.withdrawn_amount || 0);
    const utilizedAmount = Number(form.utilized_amount || 0);
    const redepositedAmount = Number(form.redeposited_amount || 0);
    const bills = form.bills
      .filter((bill) => bill.contractor.trim() || bill.bill_number.trim() || bill.amount)
      .map((bill) => ({ ...bill, amount: Number(bill.amount || 0), bill_date: bill.bill_date || null }));
    if (!form.stage_name.trim()) return setFormError("Enter a stage name.");
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) return setFormError("Enter a demand amount greater than zero.");
    if (form.status !== "DRAFT" && bills.length === 0) return setFormError("Add at least one contractor bill before submitting the demand.");
    if (bills.some((bill) => !Number.isFinite(bill.amount) || bill.amount <= 0)) return setFormError("Each bill needs an amount greater than zero.");
    if (utilizedAmount + redepositedAmount > withdrawnAmount) return setFormError("Utilized and re-deposited amounts cannot exceed the actual withdrawal.");
    if (withdrawnAmount > 0 && !form.withdrawal_date) return setFormError("Enter the actual withdrawal date.");
    setSaving(true);
    try {
      const body = {
        ...form,
        stage_name: form.stage_name.trim(),
        requested_amount: requestedAmount,
        requested_date: form.requested_date || null,
        withdrawn_amount: withdrawnAmount,
        withdrawal_date: form.withdrawal_date || null,
        utilized_amount: utilizedAmount,
        redeposited_amount: redepositedAmount,
        bills,
      };
      if (editing) await api.put(`${endpoint}/demands/${editing.id}`, body);
      else await api.post(`${endpoint}/demands`, body);
      setModalOpen(false);
      await refetch(true);
    } catch (requestError) {
      setFormError(apiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const deleteDemand = async (demand) => {
    if (!window.confirm(`Delete the "${demand.stage_name}" demand?`)) return;
    setActionError("");
    try {
      await api.delete(`${endpoint}/demands/${demand.id}`);
      await refetch(true);
    } catch (requestError) {
      setActionError(apiError(requestError));
    }
  };

  if (!configuration && !loading && !error) {
    return <Card className="p-5 sm:p-6">
      <div className="max-w-3xl">
        <Badge tone="brand">Capital Gains Account Scheme · Type A</Badge>
        <h2 className="mt-3 font-display text-xl font-bold text-ink">Set up CGAS tracking</h2>
        <p className="mt-1 text-sm text-subink">Save the basic account details once, then add only the construction stages and bank demands you need.</p>
        <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900">This keeps your paperwork and utilization record in one place. It does not send instructions to your bank, move money, or update account balances. Record paid construction expenses separately in Project Finance.</p>
        <form onSubmit={saveConfiguration}>
          <ConfigurationForm
            config={draftConfig}
            setConfig={setConfig}
            accounts={accounts.data || []}
            saving={configSaving}
            error={configError}
          />
        </form>
      </div>
    </Card>;
  }

  return <div className="space-y-5">
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge tone="brand">CGAS Type A · savings account</Badge>
          <h2 className="mt-2 font-display text-xl font-bold text-ink">Construction funding</h2>
          <p className="mt-1 text-sm text-subink">Track your own stages, bank demands, bills, certificates, actual withdrawals, and utilization.</p>
          <p className="mt-2 max-w-4xl rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900">Paperwork tracker only: demands are submitted to your bank manually. This screen does not move funds or post expenses; record paid costs separately in Project Finance to update the project ledger and account balances.</p>
        </div>
        <Button onClick={openAdd} data-testid="cgas-add-demand">Add demand</Button>
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <h3 className="font-display font-semibold text-ink">CGAS account details</h3>
        <p className="mt-1 text-xs text-subink">Enter the construction deadline as confirmed with your CA. Linking an app account is a reference only and does not change its balance.</p>
        <form onSubmit={saveConfiguration}>
          <ConfigurationForm
            config={draftConfig}
            setConfig={setConfig}
            accounts={accounts.data || []}
            saving={configSaving}
            error={configError}
            compact
          />
        </form>
      </div>
    </Card>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Total deposited in CGAS" raw={Number(configuration?.total_deposited_amount || 0)} tone="income" />
      <KpiCard label="Demanded" raw={totals.requested} tone="brand" />
      <KpiCard label="Actually withdrawn" raw={totals.withdrawn} tone="income" />
      <KpiCard label="Utilization to account for" raw={totals.unaccounted} tone={totals.unaccounted ? "amber" : "ink"} />
    </div>

    {actionError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-expense">{actionError}</p>}
    <StateBlock loading={loading} error={error} onRetry={refetch} empty={!loading && demands.length === 0} emptyText="No demands yet. Add a stage and bank demand when you are ready.">
      <div className="space-y-4">
        {demands.map((demand) => <DemandCard key={demand.id} demand={demand} projectId={projectId} onEdit={() => openEdit(demand)} onDelete={() => deleteDemand(demand)} />)}
      </div>
    </StateBlock>

    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit CGAS demand" : "Add CGAS demand"} size="xl">
      <form onSubmit={saveDemand} className="space-y-5">
        <section>
          <h3 className="mb-3 font-display font-semibold text-ink">Stage and demand</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Your stage name *"><Input required maxLength={120} value={form.stage_name} onChange={(event) => setForm((current) => ({ ...current, stage_name: event.target.value }))} placeholder="e.g. Foundation work" data-testid="cgas-stage-name" /></Field>
            <Field label="Demand amount (₹) *"><Input required type="number" min="0.01" step="0.01" value={form.requested_amount} onChange={(event) => setForm((current) => ({ ...current, requested_amount: event.target.value }))} data-testid="cgas-demand-amount" /></Field>
            <Field label="Demand date"><Input type="date" value={form.requested_date || ""} onChange={(event) => setForm((current) => ({ ...current, requested_date: event.target.value }))} /></Field>
            <Field label="Bank reference"><Input maxLength={120} value={form.bank_reference || ""} onChange={(event) => setForm((current) => ({ ...current, bank_reference: event.target.value }))} placeholder="Acknowledgement or reference number" /></Field>
            <Field label="Status"><Select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
          </div>
        </section>

        <section className="border-t border-line pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h3 className="font-display font-semibold text-ink">Contractor bills</h3><p className="mt-0.5 text-xs text-subink">Add multiple bills to this demand. Upload copies after saving the demand.</p></div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setForm((current) => ({ ...current, bills: [...current.bills, { contractor: "", bill_number: "", bill_date: "", amount: "" }] }))}>Add bill</Button>
          </div>
          <div className="space-y-3">
            {form.bills.map((bill, index) => <div key={index} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
              <Field label="Contractor"><Input value={bill.contractor} onChange={(event) => setBill(index, "contractor", event.target.value)} maxLength={160} placeholder="Contractor or supplier" /></Field>
              <Field label="Bill number"><Input value={bill.bill_number} onChange={(event) => setBill(index, "bill_number", event.target.value)} maxLength={100} /></Field>
              <Field label="Bill date"><Input type="date" value={bill.bill_date || ""} onChange={(event) => setBill(index, "bill_date", event.target.value)} /></Field>
              <Field label="Bill amount (₹)"><Input type="number" min="0" step="0.01" value={bill.amount} onChange={(event) => setBill(index, "amount", event.target.value)} /></Field>
              <Button type="button" variant="ghost" size="sm" disabled={form.bills.length === 1} onClick={() => setForm((current) => ({ ...current, bills: current.bills.filter((_, billIndex) => billIndex !== index) }))} aria-label={`Remove bill ${index + 1}`}>Remove</Button>
            </div>)}
          </div>
          <div className="mt-3 flex justify-end text-sm text-subink">Bill total <span className="num ml-2 font-bold text-ink">{inr(billTotal(form.bills))}</span></div>
        </section>

        <section className="border-t border-line pt-4">
          <h3 className="mb-3 font-display font-semibold text-ink">Actual withdrawal and utilization</h3>
          <p className="mb-3 text-xs text-subink">Enter these only after the bank withdrawal occurs. Keep utilized and re-deposited amounts within the withdrawn amount.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Actually withdrawn (₹)"><Input type="number" min="0" step="0.01" value={form.withdrawn_amount} onChange={(event) => setForm((current) => ({ ...current, withdrawn_amount: event.target.value }))} /></Field>
            <Field label="Withdrawal date"><Input type="date" value={form.withdrawal_date || ""} onChange={(event) => setForm((current) => ({ ...current, withdrawal_date: event.target.value }))} /></Field>
            <Field label="Amount utilized (₹)"><Input type="number" min="0" step="0.01" value={form.utilized_amount} onChange={(event) => setForm((current) => ({ ...current, utilized_amount: event.target.value }))} /></Field>
            <Field label="Unused amount re-deposited (₹)"><Input type="number" min="0" step="0.01" value={form.redeposited_amount} onChange={(event) => setForm((current) => ({ ...current, redeposited_amount: event.target.value }))} /></Field>
          </div>
        </section>
        <Field label="Notes"><Textarea maxLength={2000} value={form.notes || ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
        {formError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-expense">{formError}</p>}
        <div className="flex gap-2"><Button type="button" variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit" className="flex-1" disabled={saving}>{saving ? "Saving…" : "Save demand"}</Button></div>
      </form>
    </Modal>
  </div>;
}

function ConfigurationForm({ config, setConfig, accounts, saving, error, compact = false }) {
  const set = (key, value) => setConfig((current) => ({ ...(current || config), [key]: value }));
  return <div className={compact ? "mt-3" : "mt-5"}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Bank name"><Input maxLength={120} value={config.bank_name} onChange={(event) => set("bank_name", event.target.value)} placeholder="Bank holding the CGAS account" /></Field>
      <Field label="Linked app account (optional)"><Select value={config.account_id || ""} onChange={(event) => set("account_id", event.target.value)}><option value="">Not linked</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></Field>
      <Field label="CGAS deposit date"><Input type="date" value={config.deposit_date || ""} onChange={(event) => set("deposit_date", event.target.value)} /></Field>
      <Field label="Total amount deposited in CGAS (₹)"><Input type="number" min="0" step="0.01" value={config.total_deposited_amount ?? "0"} onChange={(event) => set("total_deposited_amount", event.target.value)} placeholder="0.00" data-testid="cgas-total-deposited" /></Field>
      <Field label="Construction deadline (as confirmed with your CA)"><Input type="date" value={config.construction_deadline || ""} onChange={(event) => set("construction_deadline", event.target.value)} /></Field>
      <Field label="Notes" className="sm:col-span-2"><Textarea maxLength={1000} value={config.notes || ""} onChange={(event) => set("notes", event.target.value)} placeholder="Optional account or bank notes" /></Field>
    </div>
    <p className="mt-2 text-xs text-subink">Enter the cumulative amount deposited into CGAS, including any later deposits. Update this figure when more is deposited; it is a tracker and does not change the linked account balance.</p>
    {error && <p role="alert" className="mt-3 text-sm text-expense">{error}</p>}
    <div className="mt-3 flex justify-end"><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save CGAS details"}</Button></div>
  </div>;
}

function DemandCard({ demand, projectId, onEdit, onDelete }) {
  const utilizationPending = Number(demand.unaccounted_amount || 0) > 0;
  return <Card className="overflow-hidden">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><Badge tone={demand.status === "RETURNED" ? "amber" : demand.status === "COMPLETED" ? "green" : "blue"}>{STATUS_LABELS[demand.status] || demand.status}</Badge><span className="text-xs text-faint">{demand.requested_date ? fmtDate(demand.requested_date) : "Date not set"}{demand.bank_reference ? ` · Ref ${demand.bank_reference}` : ""}</span></div>
        <h3 className="mt-2 font-display text-lg font-bold text-ink">{demand.stage_name}</h3>
        <p className="mt-1 text-sm text-subink">Demand {inr(demand.requested_amount)} · {demand.bills?.length || 0} bill{demand.bills?.length === 1 ? "" : "s"} ({inr(demand.bill_total)} total)</p>
      </div>
      <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={onEdit}>Edit</Button><Button variant="ghost" size="sm" onClick={onDelete}>Delete</Button></div>
    </div>
    {demand.bills?.length > 0 && <div className="border-b border-line px-5 py-3">
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">Bills in this demand</h4>
      <ul className="space-y-1.5">{demand.bills.map((bill, index) => <li key={`${bill.bill_number}-${index}`} className="flex flex-wrap justify-between gap-2 text-sm"><span className="text-subink">{bill.contractor || "Contractor not named"}{bill.bill_number ? ` · ${bill.bill_number}` : ""}{bill.bill_date ? ` · ${fmtDate(bill.bill_date)}` : ""}</span><span className="num font-semibold text-ink">{inr(bill.amount)}</span></li>)}</ul>
    </div>}
    <div className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div><span className="block text-xs text-faint">Withdrawn</span><span className="num font-semibold text-ink">{inr(demand.withdrawn_amount)}</span></div>
      <div><span className="block text-xs text-faint">Utilized</span><span className="num font-semibold text-ink">{inr(demand.utilized_amount)}</span></div>
      <div><span className="block text-xs text-faint">Re-deposited</span><span className="num font-semibold text-ink">{inr(demand.redeposited_amount)}</span></div>
      <div><span className="block text-xs text-faint">Utilization date guide · 60 days after withdrawal</span><span className="font-semibold text-ink">{demand.utilization_due_date ? fmtDate(demand.utilization_due_date) : "Set after withdrawal"}</span></div>
    </div>
    {utilizationPending && <p className="mx-5 mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Still to account for: <strong className="num">{inr(demand.unaccounted_amount)}</strong>. Confirm the applicable CGAS requirements and due date with your bank/CA.</p>}
    {demand.notes && <p className="mx-5 mb-4 whitespace-pre-wrap text-sm text-subink">{demand.notes}</p>}
    <div className="border-t border-line p-4">
      <DocumentsPanel
        relatedEntityId={demand.id}
        relatedEntityType="cgas_demand"
        projectId={projectId}
        title="Bills & supporting documents"
        categories={DOCUMENT_CATEGORIES}
        defaultCategory="Contractor Bill"
      />
    </div>
  </Card>;
}
