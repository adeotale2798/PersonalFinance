import React, { useState } from "react";
import { Wallet, Scale } from "lucide-react";
import { useFetch } from "../lib/useFetch";
import { PageHeader, StateBlock, Badge, Button, Modal, Field, Input, Textarea } from "../components/ui";
import KpiCard from "../components/KpiCard";
import CrudManager from "../components/CrudManager";
import { inr, todayISO, fmtDate } from "../lib/format";
import api, { apiError } from "../lib/api";
import { useAuth } from "../lib/auth";

const TYPES = ["BANK", "CASH", "WALLET", "OTHER"];

export default function Accounts() {
  const { user } = useAuth();
  const householdUser = user?.role === "HOUSEHOLD_USER";
  const { data, loading, error, refetch } = useFetch("/accounts");
  const [selected, setSelected] = useState(null);
  const [statementBalance, setStatementBalance] = useState("");
  const [asOfDate, setAsOfDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [shareAccount, setShareAccount] = useState(null);
  const [householdUsers, setHouseholdUsers] = useState([]);
  const [accessGrants, setAccessGrants] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [accessLevel, setAccessLevel] = useState("read");
  const [accessError, setAccessError] = useState("");
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const accts = data || [];
  const total = accts.reduce((s, a) => s + (a.current_balance || 0), 0);
  const bank = accts.filter((a) => a.type !== "CASH").reduce((s, a) => s + (a.current_balance || 0), 0);
  const cash = accts.filter((a) => a.type === "CASH").reduce((s, a) => s + (a.current_balance || 0), 0);

  const fields = [
    { key: "name", label: "Account Name", required: true, full: true },
    { key: "type", label: "Type", type: "select", options: TYPES, default: "BANK", required: true },
    { key: "bank_name", label: "Bank / Institution" },
    { key: "masked_number", label: "Account No. (last 4)" },
    { key: "opening_balance", label: "Opening Balance (₹)", type: "money", default: 0 },
    { key: "balance_source", label: "Balance Source", type: "select", options: ["MANUAL", "IMPORT"], default: "MANUAL" },
    { key: "owner", label: "Owner", default: "Self" },
    { key: "ownership_percent", label: "Ownership %", type: "number", default: 100 },
    { key: "status", label: "Status", type: "select", options: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  ];
  const columns = [
    { key: "name", label: "Account", render: (r) => <div><div className="font-medium text-ink">{r.name}</div><div className="text-xs text-faint">{r.bank_name} {r.masked_number}</div></div> },
    { key: "type", label: "Type", render: (r) => <Badge tone={r.type === "CASH" ? "amber" : "blue"}>{r.type}</Badge> },
    { key: "owner", label: "Owner" },
    { key: "current_balance", label: "Balance", type: "money", align: "right", render: (r) => <span className="num font-semibold text-ink">{inr(r.current_balance)}</span> },
    { key: "freshness", label: "Data confidence", render: (r) => <div className="min-w-[8rem]"><div className="flex items-center gap-1.5"><Badge tone={r.reconciliation_status === "MATCHED" ? "green" : r.reconciliation_status === "VARIANCE" ? "amber" : "gray"}>{(r.reconciliation_status || "NOT_RECONCILED").replace(/_/g, " ")}</Badge></div><p className="text-[10px] text-faint mt-1">{r.balance_source || "MANUAL"} · {r.balance_updated_at ? fmtDate(r.balance_updated_at) : "no activity date"}</p></div> },
    { key: "reconcile", label: "Statement", align: "right", render: (r) => householdUser && r.access_level !== "use"
      ? <Badge tone="gray">View only</Badge>
      : <button type="button" aria-label={`${r.reconciliation_status === "NOT_RECONCILED" ? "Reconcile" : "Compare statement"} for ${r.name}`} onClick={() => openReconciliation(r)} className="min-h-11 px-3 py-2 rounded-lg text-xs font-bold text-brand hover:bg-brand-light">{r.reconciliation_status === "NOT_RECONCILED" ? "Reconcile" : "Compare statement"}</button> },
    ...(!householdUser ? [{ key: "sharing", label: "Sharing", align: "right", render: (r) => <button type="button" aria-label={`Manage access for ${r.name}`} onClick={() => openSharing(r)} className="min-h-11 px-3 py-2 rounded-lg text-xs font-bold text-brand hover:bg-brand-light">Manage access</button> }] : []),
  ];

  const reloadAccess = async (account) => {
    const response = await api.get(`/accounts/${account.id}/access`);
    setAccessGrants(response.data);
  };

  const openSharing = async (account) => {
    setShareAccount(account);
    setAccessError("");
    setAccessLoading(true);
    setSelectedUserId("");
    try {
      const [usersResponse, grantsResponse] = await Promise.all([
        api.get("/users"),
        api.get(`/accounts/${account.id}/access`),
      ]);
      const collaborators = (usersResponse.data || []).filter((item) => item.role === "HOUSEHOLD_USER" && item.active !== false);
      setHouseholdUsers(collaborators);
      setSelectedUserId(collaborators[0]?.id || "");
      setAccessGrants(grantsResponse.data);
    } catch (requestError) {
      setAccessError(apiError(requestError));
    } finally {
      setAccessLoading(false);
    }
  };

  const grantAccess = async (event) => {
    event.preventDefault();
    if (!shareAccount || !selectedUserId) return;
    setAccessSaving(true);
    setAccessError("");
    try {
      await api.post(`/accounts/${shareAccount.id}/access`, { user_id: selectedUserId, access: accessLevel });
      await reloadAccess(shareAccount);
    } catch (requestError) {
      setAccessError(apiError(requestError));
    } finally {
      setAccessSaving(false);
    }
  };

  const revokeAccess = async (grant) => {
    if (!shareAccount || !window.confirm(`Revoke ${grant.name || grant.email}'s access to ${shareAccount.name}?`)) return;
    setAccessError("");
    try {
      await api.delete(`/accounts/${shareAccount.id}/access/${grant.user_id}`);
      await reloadAccess(shareAccount);
    } catch (requestError) {
      setAccessError(apiError(requestError));
    }
  };

  const openReconciliation = async (account) => {
    setSelected(account);
    setStatementBalance(String(account.current_balance ?? ""));
    setAsOfDate(todayISO());
    setNote("");
    setFormError("");
    setHistory([]);
    setHistoryLoading(true);
    try {
      const response = await api.get(`/accounts/${account.id}/reconciliations`);
      setHistory(response.data);
    } catch (requestError) {
      setFormError(apiError(requestError));
    } finally {
      setHistoryLoading(false);
    }
  };

  const submitReconciliation = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setFormError("");
    try {
      const response = await api.post(`/accounts/${selected.id}/reconcile`, {
        statement_balance: Number(statementBalance),
        as_of_date: asOfDate,
        note: note.trim(),
      });
      setHistory((items) => [response.data, ...items]);
      await refetch();
    } catch (requestError) {
      setFormError(apiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Accounts & Cash" subtitle="Ledger-derived balances, visible data sources, and statement reconciliation." icon={Wallet} />
      <StateBlock loading={loading} error={error} onRetry={refetch}>
        <div className="accounts-summary grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <KpiCard label="Total Balance" raw={total} tone="brand" testid="acc-total" />
          <KpiCard label="Bank Balance" raw={bank} tone="ink" testid="acc-bank" />
          <KpiCard label="Cash in Hand" raw={cash} tone="amber" testid="acc-cash" />
        </div>
      </StateBlock>
      <CrudManager title="Accounts" endpoint="/accounts" addLabel="Add account" fields={fields} columns={columns} onChanged={refetch} deps={[]} canAdd={!householdUser} canEdit={!householdUser} canDelete={!householdUser} />
      <Modal open={Boolean(shareAccount)} onClose={() => setShareAccount(null)} title={shareAccount ? `Manage access · ${shareAccount.name}` : "Manage account access"} size="lg">
        {accessLoading ? <p role="status" className="py-6 text-sm text-subink">Loading collaborators and current access…</p> : <>
          <p className="mb-4 text-sm text-subink">Only explicitly added household collaborators can see this account. Read access is view-only; Use access also permits posting personal transactions and recording reconciliations.</p>
          {householdUsers.length === 0 ? <p className="rounded-lg bg-muted/60 p-3 text-sm text-subink">No active household collaborators yet. Add one from Access Control first.</p> : <form onSubmit={grantAccess} className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
            <Field label="Household collaborator"><Select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} required>{householdUsers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}</Select></Field>
            <Field label="Permission"><Select value={accessLevel} onChange={(event) => setAccessLevel(event.target.value)}><option value="read">Read only</option><option value="use">Use account</option></Select></Field>
            <Button type="submit" disabled={!selectedUserId || accessSaving}>{accessSaving ? "Saving…" : "Grant access"}</Button>
          </form>}
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="font-display font-semibold text-ink">People with access</h3>
            {accessGrants.length ? <ul className="mt-2 divide-y divide-line">{accessGrants.map((grant) => <li key={grant.user_id} className="flex items-center justify-between gap-3 py-3">
              <div><p className="text-sm font-semibold text-ink">{grant.name}</p><p className="text-xs text-subink">{grant.email} · {grant.access === "use" ? "Can use" : "Read only"}</p></div>
              <Button type="button" variant="secondary" size="sm" onClick={() => revokeAccess(grant)}>Revoke</Button>
            </li>)}</ul> : <p className="mt-2 text-sm text-subink">No one has access to this account.</p>}
          </div>
        </>}
        {accessError && <p role="alert" className="mt-3 text-sm text-expense">{accessError}</p>}
        <div className="pt-4"><Button variant="secondary" className="w-full" onClick={() => setShareAccount(null)}>Close</Button></div>
      </Modal>
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `Reconcile ${selected.name}` : "Reconcile account"} size="lg">
        {selected && <form onSubmit={submitReconciliation} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/60 p-3"><p className="overline text-faint">Ledger balance now</p><p className="num mt-1 text-lg font-extrabold text-ink">{inr(selected.current_balance)}</p></div>
            <div className="rounded-xl bg-muted/60 p-3"><p className="overline text-faint">Balance source</p><p className="mt-1 font-semibold text-ink">{(selected.balance_source || "MANUAL").toLowerCase()}</p><p className="text-xs text-subink mt-1">{selected.balance_updated_at ? `Last ledger activity ${fmtDate(selected.balance_updated_at)}` : "No dated ledger activity yet"}</p></div>
          </div>
          <p className="text-xs text-subink">This records a comparison only; it never changes your transactions or silently adjusts the account balance.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Statement balance"><Input type="number" step="0.01" required value={statementBalance} onChange={(event) => setStatementBalance(event.target.value)} /></Field>
            <Field label="Statement date"><Input type="date" required value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} /></Field>
          </div>
          <Field label="Note (optional)"><Textarea maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Statement reference or reason for a difference" /></Field>
          {formError && <p role="alert" className="text-sm text-expense">{formError}</p>}
          <div className="flex gap-2"><Button type="button" variant="secondary" className="flex-1" onClick={() => setSelected(null)}>Close</Button><Button type="submit" className="flex-1" disabled={saving}>{saving ? "Comparing…" : "Save comparison"}</Button></div>
          <section aria-label="Reconciliation history" className="border-t border-line pt-4">
            <h3 className="font-display font-semibold text-ink">Recent comparisons</h3>
            {historyLoading ? <p role="status" className="text-sm text-subink mt-2">Loading history…</p> : history.length ? <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">{history.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3 text-sm"><span className="text-subink">{fmtDate(entry.as_of_date)} · ledger {inr(entry.app_balance)}</span><span className="flex items-center gap-2"><span className={`num font-semibold ${entry.difference ? "text-expense" : "text-income"}`}>{entry.difference > 0 ? "+" : ""}{inr(entry.difference)}</span><Badge tone={entry.status === "MATCHED" ? "green" : "amber"}>{entry.status}</Badge></span></div>)}</div> : <p className="text-xs text-subink mt-2">No previous comparisons for this account.</p>}
          </section>
        </form>}
      </Modal>
    </>
  );
}
