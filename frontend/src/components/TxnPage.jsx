import React from "react";
import { TrendingUp, CreditCard } from "lucide-react";
import { useFetch } from "../lib/useFetch";
import { PageHeader, StateBlock, Badge } from "./ui";
import KpiCard from "./KpiCard";
import { ChartCard, Bars, TrendLine } from "./charts";
import CrudManager from "./CrudManager";
import { inr, todayISO } from "../lib/format";
import { useAuth } from "../lib/auth";

export default function TxnPage({ type }) {
  const { user } = useAuth();
  const householdUser = user?.role === "HOUSEHOLD_USER";
  const isIncome = type === "INCOME";
  const groupField = isIncome ? "source" : "category";
  const color = isIncome ? "#10B981" : "#F43F5E";
  const { data: summary, loading, error, refetch } = useFetch(isIncome ? "/income/summary" : "/expenses/summary");
  const { data: accounts } = useFetch("/accounts");
  const { data: settings } = useFetch("/settings");
  const { data: projectData } = useFetch(householdUser ? "/accounts" : "/projects");
  const projects = householdUser ? [] : projectData;

  const ready = accounts && settings && projects;
  const acctMap = Object.fromEntries((accounts || []).map((a) => [a.id, a.name]));
  const usableAccounts = (accounts || []).filter((account) =>
    (!householdUser || account.access_level === "use") && (isIncome || householdUser || account.type !== "CASH")
  );
  const projMap = Object.fromEntries((projects || []).map((p) => [p.id, p.name]));
  const cats = isIncome ? settings?.income_categories : settings?.expense_categories;

  const fields = [
    { key: "date", label: "Date", type: "date", required: true, default: todayISO() },
    { key: "amount", label: "Amount (₹)", type: "money", required: true },
    { key: groupField, label: isIncome ? "Source" : "Category", type: "select", required: true, options: cats || [] },
    { key: "account_id", label: "Account", type: "select", required: householdUser,
      options: [...(!isIncome && !householdUser ? [{ value: "__cash__", label: "Cash (no account deduction)" }] : []),
        ...usableAccounts.map((account) => ({ value: account.id, label: account.name }))],
      editValue: (row) => !row.account_id && row.payment_mode === "Cash" ? "__cash__" : row.account_id || "",
      onValueChange: (value, form, setField) => {
        if (!isIncome && !householdUser) {
          if (value === "__cash__") setField("payment_mode", "Cash");
          else if (form.payment_mode === "Cash") setField("payment_mode", "");
        }
      } },
    { key: "payment_mode", label: "Payment Mode", type: "select", options: settings?.payment_methods || [],
      onValueChange: (value, form, setField) => {
        if (!isIncome && !householdUser) {
          if (value === "Cash") setField("account_id", "__cash__");
          else if (form.account_id === "__cash__") setField("account_id", "");
        }
      } },
    { key: "transaction_status", label: "Posting Status", type: "select", options: ["POSTED", "PENDING"], default: "POSTED" },
    ...(!householdUser ? [{ key: "project_id", label: "Link to Project (optional)", type: "select", options: (projects || []).map((p) => ({ value: p.id, label: p.name })) }] : []),
    { key: "description", label: "Description", type: "text", full: true },
  ];

  const columns = [
    { key: "date", label: "Date", type: "date" },
    { key: groupField, label: isIncome ? "Source" : "Category", render: (r) => <span className="font-medium text-ink">{r[groupField] || "—"}</span> },
    { key: "account_id", label: "Account", render: (r) => r.account_id ? (acctMap[r.account_id] || "—") : (r.payment_mode === "Cash" ? "Cash (no account)" : "—") },
    ...(!householdUser ? [{ key: "project_id", label: "Project", render: (r) => r.project_id ? <span className="text-brand text-xs font-medium">{projMap[r.project_id] || "Project"}</span> : <span className="text-faint text-xs">Personal</span> }] : []),
    { key: "description", label: "Note", render: (r) => <span className="text-subink">{r.description || "—"}</span> },
    { key: "record_status", label: "Record status", render: (r) => <div className="flex flex-wrap items-center gap-1.5"><Badge tone={r.transaction_status === "PENDING" ? "amber" : r.transaction_status === "VOID" ? "gray" : "green"}>{r.transaction_status === "PENDING" ? "Pending" : r.transaction_status === "VOID" ? "Void" : "Posted"}</Badge><span className="text-[10px] text-faint">{r.record_source || "MANUAL"}</span></div> },
    { key: "amount", label: "Amount", align: "right", render: (r) => <span className="num font-semibold" style={{ color }}>{inr(r.amount)}</span> },
  ];

  return (
    <>
      <PageHeader title={isIncome ? "Income" : "Expenses"} subtitle={isIncome ? "All money coming in, by source." : "All money going out, by category."} icon={isIncome ? TrendingUp : CreditCard} />
      <StateBlock loading={loading} error={error} onRetry={refetch}>
        {summary && (
          <>
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
              <KpiCard label="Total" raw={summary.total} tone={isIncome ? "income" : "expense"} testid="txn-total" />
              <KpiCard label="This Month" raw={summary.this_month} tone="ink" testid="txn-month" />
              <KpiCard label="This Year" raw={summary.this_year} tone="ink" testid="txn-year" />
            </div>
            <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
              <ChartCard title={isIncome ? "By Source" : "By Category"} height={240}>
                <Bars data={summary.by_group.slice(0, 8)} series={[{ key: "value", name: isIncome ? "Income" : "Expense", color }]} />
              </ChartCard>
              <ChartCard title="Monthly Trend" height={240}>
                <TrendLine data={summary.by_month} color={color} name={isIncome ? "Income" : "Expense"} />
              </ChartCard>
            </div>
          </>
        )}
      </StateBlock>
      {ready && (
        <CrudManager
          title={isIncome ? "Income Records" : "Expense Records"}
          endpoint="/transactions"
          listEndpoint={`/transactions?type=${type}`}
          addLabel={isIncome ? "Add income" : "Add expense"}
          fields={fields}
          columns={columns}
          onChanged={refetch}
          canAdd={!householdUser || (accounts || []).some((account) => account.access_level === "use")}
          canDelete={!householdUser}
          canEditRow={(row) => !householdUser || (row.record_source !== "IMPORT" && (accounts || []).some((account) => account.id === row.account_id && account.access_level === "use"))}
          transform={(p) => ({
            ...p,
            account_id: p.account_id === "__cash__" ? null : p.account_id || null,
            ...(p.account_id === "__cash__" ? { payment_mode: "Cash" } : {}),
            type,
            scope: p.project_id ? "PROJECT" : "PERSONAL",
          })}
        />
      )}
    </>
  );
}
