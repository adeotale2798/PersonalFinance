import React, { useState } from "react";
import { FileText, FolderOpen, Receipt, Users } from "lucide-react";
import { PageHeader, Segmented } from "../components/ui";
import DocumentsPanel from "../components/DocumentsPanel";
import { useFetch } from "../lib/useFetch";
import { useAuth } from "../lib/auth";

export default function Documents() {
  const [tab, setTab] = useState("all");
  const { user } = useAuth();
  const family = useFetch(user?.role === "HOUSEHOLD_USER" ? "/health" : "/family", [user?.role]);
  const memberOptions = (family.data || []).map((f) => ({ value: f.id, label: f.name }));

  const panels = {
    all: <DocumentsPanel title="All Documents" memberOptions={memberOptions} showTaxFields showLinks defaultCategory="Other" deps={[family.data]} />,
    tax: <DocumentsPanel title="ITR & Income-Tax Documents" query="category=ITR" categories={["ITR", "Income Tax", "Form 16", "Tax Challan", "Other"]} memberOptions={memberOptions} showTaxFields defaultCategory="ITR" />,
    income: <DocumentsPanel title="Income Proofs (per family member)" query="category=Income Proof" categories={["Income Proof", "Salary Slip", "Bank Statement", "Other"]} memberOptions={memberOptions} showTaxFields defaultCategory="Income Proof" />,
    bank: <DocumentsPanel title="Bank & Financial" query="category=Bank" categories={["Bank", "Statement", "Passbook", "Cheque", "Other"]} defaultCategory="Bank" />,
  };

  return (
    <>
      <PageHeader title="Document Vault" subtitle="Upload, rename and organise official & unofficial paperwork, ITR and income proofs." icon={FileText} />
      <div className="mb-6 overflow-x-auto -mx-1 px-1">
        <Segmented testid="doc-tabs" value={tab} onChange={setTab} options={[
          { value: "all", label: "All" },
          { value: "tax", label: "ITR & Tax" },
          { value: "income", label: "Income Proofs" },
          { value: "bank", label: "Bank" },
        ]} />
      </div>
      {panels[tab]}
    </>
  );
}
