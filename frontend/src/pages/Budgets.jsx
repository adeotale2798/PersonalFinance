import React, { useMemo, useState } from "react";
import { ArrowRight, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, StateBlock, Textarea } from "../components/ui";
import { useFetch } from "../lib/useFetch";
import api, { apiError } from "../lib/api";
import { inr } from "../lib/format";

const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export default function Budgets() {
  const [month, setMonth] = useState(currentMonth);
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ category: "", amount: "", budget_type: "MONTHLY", rollover: false, notes: "" });
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const budgets = useFetch(`/budgets?month=${encodeURIComponent(month)}`, [month]);
  const settings = useFetch("/settings");
  const plan = budgets.data;
  const categories = useMemo(() => Array.from(new Set([
    ...(settings.data?.expense_categories || []),
    ...(plan?.items || []).map((item) => item.category),
  ])), [settings.data, plan]);

  const openNew = () => {
    setEditing(null);
    setForm({ category: "", amount: "", budget_type: "MONTHLY", rollover: false, notes: "" });
    setErrorMessage("");
    setModalOpen(true);
  };
  const openEdit = (item) => {
    setEditing(item);
    setForm({
      category: item.category,
      amount: String(item.amount || ""),
      budget_type: item.budget_type || "MONTHLY",
      rollover: Boolean(item.rollover),
      notes: item.notes || "",
    });
    setErrorMessage("");
    setModalOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrorMessage("");
    try {
      await api.post("/budgets", {
        month,
        category: form.category.trim(),
        amount: Number(form.amount),
        budget_type: form.budget_type,
        rollover: Boolean(form.rollover),
        notes: form.notes.trim(),
      });
      setModalOpen(false);
      await budgets.refetch();
    } catch (error) {
      setErrorMessage(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!item.id || !window.confirm(`Remove the ${item.category} plan for ${month}? Transactions will not be deleted.`)) return;
    try {
      await api.delete(`/budgets/${item.id}`);
      await budgets.refetch();
    } catch (error) {
      setErrorMessage(apiError(error));
    }
  };

  return <>
    <PageHeader
      title="Budgets & spending plans"
      subtitle="Plan by category, compare posted spending, and set aside funds for irregular costs."
      icon={PiggyBank}
      actions={<Button size="sm" onClick={openNew}><Plus size={15} /> Add category plan</Button>}
    />

    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <label htmlFor="budget-month" className="overline text-faint block mb-1.5">Plan month</label>
        <Input id="budget-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="w-auto min-w-[10rem]" />
      </div>
      <p className="max-w-xl text-xs text-subink">Actuals include posted personal expenses. Pending expenses are shown separately and do not change account balances until posted.</p>
    </div>

    <StateBlock loading={budgets.loading} error={budgets.error} onRetry={budgets.refetch}>
      {plan && <>
        <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-5" aria-label="Budget month summary">
          <Summary label="Planned" value={plan.planned_total} />
          <Summary label="Available with carryover" value={plan.available_total} />
          <Summary label="Posted spending" value={plan.actual_total} />
          <Summary label="Still available" value={plan.remaining_total} tone={plan.remaining_total < 0 ? "expense" : "income"} />
        </section>

        <Card className="overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(10rem,1.2fr)_minmax(12rem,2fr)_repeat(4,minmax(6rem,.8fr))_auto] gap-3 px-5 py-3 bg-muted/60 border-b border-line text-[10px] uppercase tracking-wider font-extrabold text-faint">
            <span>Category</span><span>Progress</span><span className="text-right">Plan</span><span className="text-right">Carryover</span><span className="text-right">Spent</span><span className="text-right">Left</span><span className="text-right">Actions</span>
          </div>
          {plan.items.length ? <div className="divide-y divide-line">
            {plan.items.map((item) => <BudgetRow key={item.id || `${month}-${item.category}`} item={item} onEdit={openEdit} onRemove={remove} onNavigate={() => navigate("/expenses")} />)}
          </div> : <div className="px-5 py-12 text-center">
            <div className="mx-auto w-11 h-11 rounded-2xl bg-brand-light text-brand grid place-items-center"><PiggyBank size={21} /></div>
            <h2 className="mt-3 font-display font-semibold text-ink">Start with one category</h2>
            <p className="mt-1 text-sm text-subink">Set a monthly limit or create a sinking fund for an irregular expense.</p>
            <Button className="mt-4" size="sm" onClick={openNew}><Plus size={15} /> Create a plan</Button>
          </div>}
        </Card>
        {plan.unplanned_total > 0 && <button onClick={() => navigate("/expenses")} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-expense hover:underline">
          {inr(plan.unplanned_total)} posted spending is outside planned categories <ArrowRight size={15} />
        </button>}
      </>}
    </StateBlock>

    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Plan: ${editing.category}` : "Add category plan"}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Expense category">
          <Select required value={form.category} disabled={Boolean(editing)} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))}>
            <option value="">Choose a category…</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </Select>
        </Field>
        <Field label="Planned amount">
          <Input type="number" inputMode="decimal" min="0" step="0.01" required value={form.amount} onChange={(event) => setForm((value) => ({ ...value, amount: event.target.value }))} />
        </Field>
        <Field label="Plan type">
          <Select value={form.budget_type} onChange={(event) => setForm((value) => ({ ...value, budget_type: event.target.value }))}>
            <option value="MONTHLY">Monthly spending</option>
            <option value="SINKING">Sinking fund · irregular expense</option>
          </Select>
        </Field>
        <label className="flex items-start gap-2.5 text-sm text-subink">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={form.rollover} onChange={(event) => setForm((value) => ({ ...value, rollover: event.target.checked }))} />
          <span><strong className="text-ink">Carry forward unspent funds.</strong> Adds the previous month’s remaining plan to this month when both months have rollover enabled.</span>
        </label>
        <Field label="Note (optional)">
          <Textarea maxLength={500} value={form.notes} onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))} placeholder="e.g. annual insurance premium" />
        </Field>
        {errorMessage && <p role="alert" className="text-sm text-expense">{errorMessage}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Saving…" : "Save plan"}</Button>
        </div>
      </form>
    </Modal>
  </>;
}

function Summary({ label, value, tone = "ink" }) {
  const toneClass = tone === "expense" ? "text-expense" : tone === "income" ? "text-income" : "text-ink";
  return <Card className="p-4 sm:p-5"><p className="overline text-faint">{label}</p><p className={`num mt-2 text-xl sm:text-2xl font-extrabold ${toneClass}`}>{inr(value)}</p></Card>;
}

function BudgetRow({ item, onEdit, onRemove, onNavigate }) {
  const progress = item.percent_used == null ? 0 : Math.min(Math.max(item.percent_used, 0), 100);
  const over = item.remaining < 0;
  const pending = item.pending > 0;
  return <article className="grid md:grid-cols-[minmax(10rem,1.2fr)_minmax(12rem,2fr)_repeat(4,minmax(6rem,.8fr))_auto] gap-3 md:gap-3 items-center px-4 sm:px-5 py-4">
    <div className="min-w-0">
      <div className="font-semibold text-ink truncate">{item.category}</div>
      <div className="flex flex-wrap items-center gap-1.5 mt-1">
        {item.unplanned ? <Badge tone="amber">Unplanned</Badge> : <Badge tone={item.budget_type === "SINKING" ? "blue" : "gray"}>{item.budget_type === "SINKING" ? "Sinking fund" : "Monthly"}</Badge>}
        {pending && <span className="text-[10px] text-subink">{inr(item.pending, { compact: true })} pending</span>}
      </div>
    </div>
    <div className="min-w-0" role="img" aria-label={`${item.category}: ${inr(item.actual)} posted of ${inr(item.available)} available${pending ? `, ${inr(item.pending)} pending` : ""}`}>
      <div className="flex justify-between gap-2 text-[11px] text-subink mb-1"><span>{item.percent_used == null ? "No plan set" : `${Math.round(item.percent_used)}% used`}</span><span>{inr(item.actual, { compact: true })}</span></div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${over ? "bg-expense" : "bg-brand"}`} style={{ width: `${progress}%` }} /></div>
    </div>
    <div className="hidden md:contents">
      <Value label="Plan" value={item.amount} />
      <Value label="Carryover" value={item.carryover} />
      <Value label="Spent" value={item.actual} />
      <Value label="Left" value={item.remaining} tone={over ? "expense" : "ink"} />
    </div>
    <div className="flex justify-end gap-1">
      <button type="button" onClick={onNavigate} className="p-2 rounded-lg text-subink hover:bg-muted" aria-label={`View ${item.category} expense records`} title="View expense records"><ArrowRight size={15} /></button>
      {!item.unplanned && <button type="button" onClick={() => onEdit(item)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-brand hover:bg-brand-light">Edit</button>}
      {!item.unplanned && <button type="button" onClick={() => onRemove(item)} className="p-2 rounded-lg text-subink hover:bg-rose-50 hover:text-expense" aria-label={`Remove ${item.category} plan`} title="Remove plan"><Trash2 size={15} /></button>}
    </div>
    <div className="md:hidden grid grid-cols-2 gap-2 col-span-full pt-2 border-t border-line/70">
      <Value label="Plan" value={item.amount} /><Value label="Carryover" value={item.carryover} /><Value label="Spent" value={item.actual} /><Value label="Left" value={item.remaining} tone={over ? "expense" : "ink"} />
    </div>
  </article>;
}

function Value({ label, value, tone = "ink" }) {
  return <div className="min-w-0 text-right"><span className="md:hidden block overline text-faint mb-0.5">{label}</span><span className={`num text-sm font-bold ${tone === "expense" ? "text-expense" : "text-ink"}`}>{inr(value, { compact: true })}</span></div>;
}
