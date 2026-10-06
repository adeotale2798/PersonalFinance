import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, CreditCard, ExternalLink, PlusCircle } from "lucide-react";
import { Badge, Button, Card, Field, Input, PageHeader, Select, StateBlock, Textarea } from "../components/ui";
import { useFetch } from "../lib/useFetch";
import api, { apiError } from "../lib/api";
import { fmtDate, inr, indianNumber, moneyValue, todayISO } from "../lib/format";
import { useAuth } from "../lib/auth";

export default function DailySpending() {
  const { user } = useAuth();
  const householdUser = user?.role === "HOUSEHOLD_USER";
  const navigate = useNavigate();
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState({ amount: "", category: "", account_id: "", payment_mode: "", transaction_status: "POSTED", description: "", project_id: "" });
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const accounts = useFetch("/accounts");
  const settings = useFetch("/settings");
  const projects = useFetch(householdUser ? "/accounts" : "/projects");
  const transactions = useFetch(`/transactions?type=EXPENSE&from=${date}&to=${date}`, [date]);
  const rows = transactions.data || [];
  const totals = useMemo(() => rows.reduce((sum, row) => {
    if (row.transaction_status === "VOID") return sum;
    const key = row.transaction_status === "PENDING" ? "pending" : "posted";
    sum[key] += Number(row.amount || 0);
    return sum;
  }, { posted: 0, pending: 0 }), [rows]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    const amount = Number(moneyValue(form.amount));
    if (!Number.isFinite(amount) || amount <= 0) return setErrorMessage("Enter an amount greater than zero.");
    if (!form.category) return setErrorMessage("Choose a category so the expense can be included in your reports.");
    if (householdUser && !form.account_id) return setErrorMessage("Choose an account you have permission to use.");
    setSaving(true);
    try {
      await api.post("/transactions", {
        type: "EXPENSE",
        date,
        amount,
        category: form.category,
        account_id: form.account_id || null,
        payment_mode: form.payment_mode || null,
        transaction_status: form.transaction_status,
        description: form.description.trim(),
        ...(!householdUser ? { project_id: form.project_id || null } : {}),
        scope: !householdUser && form.project_id ? "PROJECT" : "PERSONAL",
        record_source: "MANUAL",
      });
      setForm((current) => ({ ...current, amount: "", description: "", transaction_status: "POSTED" }));
      await transactions.refetch(true);
    } catch (error) {
      setErrorMessage(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions = settings.data?.expense_categories || [];
  const paymentOptions = settings.data?.payment_methods || [];
  const usableAccounts = (accounts.data || []).filter((item) => !householdUser || item.access_level === "use");
  return <>
    <PageHeader title="Daily Spending" subtitle="Record today's expenses quickly; they flow into your existing ledger, budgets, accounts, and calendar." icon={CreditCard}
      actions={<Button variant="secondary" onClick={() => navigate("/expenses")}><ExternalLink size={15} /> Manage all expenses</Button>} />
    <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(20rem,.85fr)] gap-5">
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-light text-brand"><PlusCircle size={20} /></span><div><h2 className="font-display text-lg font-bold text-ink">Add an expense</h2><p className="text-xs text-subink">One entry is saved as one normal expense transaction.</p></div></div>
        <form onSubmit={save} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Date"><Input type="date" required value={date} onChange={(event) => setDate(event.target.value)} data-testid="daily-expense-date" /></Field>
            <Field label="Amount"><Input inputMode="decimal" required value={indianNumber(form.amount)} onChange={(event) => set("amount", moneyValue(event.target.value))} placeholder="0.00" autoFocus data-testid="daily-expense-amount" /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Category"><Select required value={form.category} onChange={(event) => set("category", event.target.value)} data-testid="daily-expense-category"><option value="">Choose category</option>{categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
            <Field label="Payment method"><Select value={form.payment_mode} onChange={(event) => set("payment_mode", event.target.value)}><option value="">Not specified</option>{paymentOptions.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={`Paid from account${householdUser ? " *" : ""}`}><Select required={householdUser} value={form.account_id} onChange={(event) => set("account_id", event.target.value)}><option value="">Unassigned</option>{usableAccounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
            <Field label="Status"><Select value={form.transaction_status} onChange={(event) => set("transaction_status", event.target.value)}><option value="POSTED">Paid · Posted</option><option value="PENDING">Pending charge</option></Select></Field>
          </div>
          {!householdUser && <Field label="Project (optional)"><Select value={form.project_id} onChange={(event) => set("project_id", event.target.value)}><option value="">Personal expense</option>{(projects.data || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>}
          <Field label="Note"><Textarea maxLength={500} value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="Merchant, purpose, or a short note" /></Field>
          {errorMessage && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-expense">{errorMessage}</p>}
          <Button type="submit" className="w-full" disabled={saving || !settings.data || (householdUser && usableAccounts.length === 0)}>{saving ? "Saving expense…" : "Save expense"}</Button>
          {householdUser && usableAccounts.length === 0 && <p role="status" className="text-xs text-amber-700">You have view-only access. Ask the account owner for permission to record entries.</p>}
          <p className="text-[11px] leading-relaxed text-subink">Posted entries affect recorded totals and the selected account balance. Pending entries stay visible but do not affect posted balances until you update their status.</p>
        </form>
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-line p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-lg font-bold text-ink">Spending for the day</h2><p className="mt-1 text-xs text-subink">{fmtDate(date)}</p></div><CalendarClock className="text-brand" size={20} /></div>
          <div className="mt-4 grid grid-cols-2 gap-3"><Total label="Posted" amount={totals.posted} tone="expense" /><Total label="Pending" amount={totals.pending} tone="pending" /></div>
        </div>
        <StateBlock loading={transactions.loading} error={transactions.error} onRetry={transactions.refetch} empty={!transactions.loading && rows.filter((item) => item.transaction_status !== "VOID").length === 0} emptyText="No expenses recorded for this date.">
          <div className="divide-y divide-line max-h-[34rem] overflow-y-auto">{rows.filter((item) => item.transaction_status !== "VOID").map((item) => <button key={item.id} onClick={() => navigate("/expenses")} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-muted/40"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{item.category || "Uncategorized"}{item.project_id ? <span className="font-normal text-subink"> · Project</span> : ""}</span><span className="mt-0.5 block truncate text-xs text-subink">{item.description || item.payment_mode || "Expense"} · {item.account_id ? (accounts.data || []).find((account) => account.id === item.account_id)?.name || "Account" : "Unassigned account"}</span></span><span className="flex shrink-0 flex-col items-end gap-1"><span className="num text-sm font-bold text-expense">{inr(item.amount)}</span><Badge tone={item.transaction_status === "PENDING" ? "amber" : "green"}>{item.transaction_status === "PENDING" ? "Pending" : "Posted"}</Badge></span></button>)}</div>
        </StateBlock>
        <div className="border-t border-line p-4 text-xs text-subink">Need to correct an entry? Use <button className="font-bold text-brand hover:underline" onClick={() => navigate("/expenses")}>Expenses</button> to edit it or mark it void while retaining a clear audit trail.</div>
      </Card>
    </div>
  </>;
}

function Total({ label, amount, tone }) { return <div className="rounded-xl bg-muted/60 p-3"><p className="overline text-faint">{label}</p><p className={`num mt-1 text-lg font-extrabold ${tone === "expense" ? "text-expense" : "text-amber"}`}>{inr(amount)}</p></div>; }
