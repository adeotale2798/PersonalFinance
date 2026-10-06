import React, { useMemo, useState } from "react";
import { BellRing, CalendarClock, CheckCircle2, CreditCard, Pause, Pencil, Play, Plus, TrendingUp } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, StateBlock, Textarea } from "../components/ui";
import { useFetch } from "../lib/useFetch";
import api, { apiError } from "../lib/api";
import { inr, todayISO } from "../lib/format";

const blankForm = {
  name: "",
  cadence: "MONTHLY",
  amount: "",
  category: "",
  account_id: "",
  next_due_date: "",
  status: "active",
  last_used_date: "",
  notes: "",
};

const statusTone = { active: "green", paused: "amber", cancelled: "gray" };

export default function Recurring() {
  const recurring = useFetch("/recurring");
  const accounts = useFetch("/accounts");
  const settings = useFetch("/settings");
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [payment, setPayment] = useState(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const data = recurring.data || {};
  const items = data.items || [];
  const categories = useMemo(() => Array.from(new Set([
    ...(settings.data?.expense_categories || []),
    ...items.map((item) => item.category),
  ])).filter(Boolean), [settings.data, items]);

  const openNew = () => {
    setEditing(null);
    setForm({
      ...blankForm,
      category: categories[0] || "",
      account_id: accounts.data?.[0]?.id || "",
      next_due_date: new Date().toISOString().slice(0, 10),
    });
    setErrorMessage("");
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name,
      cadence: item.cadence,
      amount: String(item.amount),
      category: item.category,
      account_id: item.account_id,
      next_due_date: item.next_due_date,
      status: item.status,
      last_used_date: item.last_used_date || "",
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
      const payload = { ...form, amount: Number(form.amount), last_used_date: form.last_used_date || null };
      if (editing) await api.put(`/recurring/${editing.id}`, payload);
      else await api.post("/recurring", payload);
      setModalOpen(false);
      await recurring.refetch();
    } catch (error) {
      setErrorMessage(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (item, status) => {
    setActionError("");
    try {
      await api.patch(`/recurring/${item.id}/status`, { status });
      await recurring.refetch();
    } catch (error) {
      setActionError(apiError(error));
    }
  };

  const recordPayment = async (event) => {
    event.preventDefault();
    if (!payment) return;
    setPaymentBusy(true);
    setActionError("");
    try {
      await api.post(`/recurring/${payment.id}/record-payment`, {
        date: payment.date,
        amount: payment.amount === "" ? null : Number(payment.amount),
      });
      setPayment(null);
      await recurring.refetch();
    } catch (error) {
      setActionError(apiError(error));
    } finally {
      setPaymentBusy(false);
    }
  };

  const accountName = (accountId) => accounts.data?.find((account) => account.id === accountId)?.name || "Account unavailable";
  const alerts = data.renewal_alerts || [];

  return <>
    <PageHeader
      title="Recurring bills & subscriptions"
      subtitle="Track upcoming renewals and price changes. Forecasts are reminders only and never create transactions."
      icon={CalendarClock}
      actions={<Button size="sm" onClick={openNew}><Plus size={15} /> Add recurring item</Button>}
    />

    <div className="grid sm:grid-cols-2 gap-3 mb-5">
      <Card className="p-4 flex items-start gap-3">
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-brand-light text-brand shrink-0"><BellRing size={17} /></span>
        <div>
          <p className="text-sm font-semibold text-ink">Renewal alerts</p>
          <p className="text-xs text-subink mt-1">{alerts.length ? `${alerts.length} active renewal${alerts.length === 1 ? "" : "s"} due within 30 days or overdue.` : "No active renewals are due in the next 30 days."}</p>
          {alerts.slice(0, 3).map((alert) => <p key={alert.schedule_id} className="text-xs text-ink mt-1.5">
            <strong>{alert.name}</strong> · {alert.message} · {inr(alert.amount)}
          </p>)}
        </div>
      </Card>
      <Card className="p-4 flex items-start gap-3">
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-amber-50 text-amber-700 shrink-0"><CheckCircle2 size={17} /></span>
        <div>
          <p className="text-sm font-semibold text-ink">Careful usage check</p>
          <p className="text-xs text-subink mt-1">“Possibly unused” requires a dated last-used entry or a linked posted payment at least {data.unused_threshold_days || 90} days old. Missing evidence stays unknown, not unused.</p>
        </div>
      </Card>
    </div>

    {actionError && <p role="alert" className="mb-3 text-sm text-expense">{actionError}</p>}
    <StateBlock loading={recurring.loading} error={recurring.error} onRetry={recurring.refetch}>
      {recurring.data && <div className="space-y-3">
        {items.length ? items.map((item) => <ScheduleCard
          key={item.id}
          item={item}
          accountName={accountName(item.account_id)}
          onEdit={() => openEdit(item)}
          onStatus={(status) => setStatus(item, status)}
          onRecord={() => setPayment({ id: item.id, name: item.name, date: todayISO(), amount: String(item.amount) })}
        />) : <Card className="px-5 py-12 text-center">
          <div className="mx-auto w-11 h-11 rounded-2xl bg-brand-light text-brand grid place-items-center"><CreditCard size={21} /></div>
          <h2 className="mt-3 font-display font-semibold text-ink">Add your first recurring item</h2>
          <p className="mt-1 text-sm text-subink">Keep bills and subscriptions visible without recording forecast dates as spending.</p>
          <Button className="mt-4" size="sm" onClick={openNew}><Plus size={15} /> Add recurring item</Button>
        </Card>}
        <p className="text-xs text-faint">Projected occurrences cover the next {data.projection_horizon_days || 90} days. Record a transaction separately after payment; projections do not affect balances or spending totals.</p>
      </div>}
    </StateBlock>

    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${editing.name}` : "Add recurring item"}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Bill or subscription name">
          <Input required maxLength={120} value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="e.g. Internet plan" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Amount">
            <Input type="number" inputMode="decimal" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm((value) => ({ ...value, amount: event.target.value }))} />
          </Field>
          <Field label="Cadence">
            <Select value={form.cadence} onChange={(event) => setForm((value) => ({ ...value, cadence: event.target.value }))}>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="YEARLY">Yearly</option>
            </Select>
          </Field>
          <Field label="Expense category">
            <Select required value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))}>
              <option value="">Choose category</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              {form.category && !categories.includes(form.category) && <option value={form.category}>{form.category}</option>}
            </Select>
          </Field>
          <Field label="Payment account">
            <Select required value={form.account_id} onChange={(event) => setForm((value) => ({ ...value, account_id: event.target.value }))}>
              <option value="">Choose account</option>
              {(accounts.data || []).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </Select>
          </Field>
          <Field label="Next due date">
            <Input type="date" required value={form.next_due_date} onChange={(event) => setForm((value) => ({ ...value, next_due_date: event.target.value }))} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(event) => setForm((value) => ({ ...value, status: event.target.value }))}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
          <Field label="Last used (optional, explicit date)">
            <Input type="date" max={new Date().toISOString().slice(0, 10)} value={form.last_used_date} onChange={(event) => setForm((value) => ({ ...value, last_used_date: event.target.value }))} />
          </Field>
        </div>
        <Field label="Note (optional)">
          <Textarea maxLength={500} value={form.notes} onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))} placeholder="Renewal details or reminder" />
        </Field>
        {errorMessage && <p role="alert" className="text-sm text-expense">{errorMessage}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Saving…" : "Save item"}</Button>
        </div>
      </form>
    </Modal>
    <Modal open={Boolean(payment)} onClose={() => setPayment(null)} title={payment ? `Record ${payment.name} payment` : "Record payment"}>
      {payment && <form onSubmit={recordPayment} className="space-y-4">
        <p className="text-sm text-subink">This records one posted expense in the normal ledger and advances the next due date. It does not create future payments.</p>
        <Field label="Paid date"><Input type="date" required max={todayISO()} value={payment.date} onChange={(event) => setPayment((current) => ({ ...current, date: event.target.value }))} /></Field>
        <Field label="Amount actually paid"><Input type="number" min="0.01" step="0.01" required value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} /></Field>
        {actionError && <p role="alert" className="text-sm text-expense">{actionError}</p>}
        <div className="flex gap-2"><Button type="button" variant="secondary" className="flex-1" onClick={() => setPayment(null)}>Cancel</Button><Button type="submit" className="flex-1" disabled={paymentBusy}>{paymentBusy ? "Saving…" : "Save posted expense"}</Button></div>
      </form>}
    </Modal>
  </>;
}

function ScheduleCard({ item, accountName, onEdit, onStatus, onRecord }) {
  const usage = item.usage_signal || {};
  return <Card className="p-4 sm:p-5">
    <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-semibold text-ink">{item.name}</h2>
          <Badge tone={statusTone[item.status] || "neutral"}>{item.status}</Badge>
          {usage.possibly_unused && <Badge tone="amber">Possibly unused</Badge>}
          {item.price_signal && <Badge tone="red"><TrendingUp size={12} className="mr-1" /> Price increased</Badge>}
        </div>
        <p className="mt-1 text-sm text-subink">{inr(item.amount)} · {item.cadence.toLowerCase()} · {item.category} · {accountName}</p>
        {item.notes && <p className="mt-2 text-xs text-subink">{item.notes}</p>}
        <div className="mt-3 grid sm:grid-cols-2 gap-2">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-faint font-bold">Usage evidence</p>
            <p className="mt-1 text-xs text-subink">{usage.explanation}</p>
          </div>
          {item.price_signal && <div className="rounded-xl bg-expense/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-expense font-bold">Price change · {item.price_signal.changed_on}</p>
            <p className="mt-1 text-xs text-subink">{inr(item.price_signal.from_amount)} → {inr(item.price_signal.to_amount)}. {item.price_signal.explanation}</p>
          </div>}
        </div>
        {item.price_history?.length > 0 && <details className="mt-3 text-xs text-subink">
          <summary className="cursor-pointer font-semibold text-ink">Price-change history ({item.price_history.length})</summary>
          <ul className="mt-2 space-y-1">
            {item.price_history.map((change, index) => <li key={`${change.changed_on}-${index}`}>{change.changed_on}: {inr(change.from_amount)} → {inr(change.to_amount)} ({change.change_type})</li>)}
          </ul>
        </details>}
      </div>
      <div className="xl:w-72 shrink-0">
        <p className="text-xs text-faint">Next due</p>
        <p className="mt-0.5 font-semibold text-ink">{item.next_due_date}</p>
        {item.projected_occurrences?.length > 0 && <div className="mt-2 space-y-1">
          {item.projected_occurrences.slice(0, 3).map((occurrence) => <p key={occurrence.due_date} className="text-xs text-subink">
            <CalendarClock size={12} className="inline mr-1" />{occurrence.due_date} · {inr(occurrence.amount)} <span className="text-faint">(projected)</span>
          </p>)}
        </div>}
        <div className="flex flex-wrap gap-2 mt-3">
          {item.status === "active" && <Button size="sm" onClick={onRecord}><CheckCircle2 size={13} /> Record paid</Button>}
          <Button size="sm" variant="secondary" onClick={onEdit}><Pencil size={13} /> Edit</Button>
          {item.status !== "cancelled" && <Button size="sm" variant="secondary" onClick={() => onStatus(item.status === "active" ? "paused" : "active")}>
            {item.status === "active" ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Resume</>}
          </Button>}
          {item.status !== "cancelled" && <Button size="sm" variant="secondary" onClick={() => onStatus("cancelled")}>Cancel</Button>}
        </div>
      </div>
    </div>
  </Card>;
}
