import React, { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Camera, Plus } from "lucide-react";
import { useFetch } from "../lib/useFetch";
import { StateBlock, Card, Badge, StatusBadge, Segmented, Spinner, Button, Modal, Field, Input, Select } from "../components/ui";
import KpiCard from "../components/KpiCard";
import { ChartCard, Bars, CashFlowArea, Donut } from "../components/charts";
import CrudManager from "../components/CrudManager";
import DocumentsPanel from "../components/DocumentsPanel";
import ConstructionCgas from "../components/ConstructionCgas";
import api, { docUrl } from "../lib/api";
import { inr, todayISO } from "../lib/format";

export default function ProjectWorkspace() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState("overview");
  const project = useFetch(`/projects/${id}`, [id]);
  const finance = useFetch(`/projects/${id}/finance`, [id]);
  const accounts = useFetch("/accounts");
  const parties = useFetch(`/parties?project_id=${id}`, [id]);
  const settings = useFetch("/settings");
  const photoRef = useRef();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [expenseSignal, setExpenseSignal] = useState(0);
  const [partyModal, setPartyModal] = useState(null); // { resolve } when invoked from expense selector
  const [partyForm, setPartyForm] = useState({});
  const [partySaving, setPartySaving] = useState(false);
  const [partyError, setPartyError] = useState("");
  const [credentials, setCredentials] = useState(null);

  const p = project.data;
  const f = finance.data;
  const heroImg = p ? (p.image_url || (p.image_doc_id ? docUrl(p.image_doc_id) : null)) : null;

  const uploadPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("category", "Project Photo");
      fd.append("related_entity_id", id); fd.append("related_entity_type", "project"); fd.append("project_id", id);
      const { data } = await api.post("/documents", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await api.put(`/projects/${id}`, { image_doc_id: data.id, image_url: "" });
      project.refetch();
    } catch (_) {} finally { setUploadingPhoto(false); }
  };

  const partyFields = [
    { key: "name", label: "Party Name", required: true, full: true },
    { key: "party_type", label: "Type", type: "select", options: ["Architect", "Civil Contractor", "Contractor A", "Contractor B", "Plumber", "Electrician", "Structural Consultant", "Interior Contractor", "Material Supplier", "Consultant", "Other"], default: "Civil Contractor" },
    { key: "scope", label: "Scope of Work" },
    { key: "contact", label: "Contact" },
    { key: "contract_value", label: "Contract Value (₹)", type: "money" },
  ];
  const partyCols = [
    { key: "name", label: "Party", render: (r) => <div><div className="font-medium text-ink">{r.name}</div><div className="text-xs text-faint">{r.scope}</div></div> },
    { key: "party_type", label: "Type", render: (r) => <Badge tone="blue">{r.party_type}</Badge> },
    { key: "contract_value", label: "Contract", align: "right", type: "money" },
    { key: "paid", label: "Paid", align: "right", render: (r) => <span className="num text-income">{inr(r.paid)}</span> },
    { key: "outstanding", label: "Outstanding", align: "right", render: (r) => <span className="num font-semibold">{inr(r.outstanding)}</span> },
  ];

  const openPartyModal = () => { setPartyForm({ party_type: "Civil Contractor", contract_value: "" }); setPartyError(""); setPartyModal({}); };
  const quickCreateParty = () => new Promise((resolve) => { setPartyForm({ party_type: "Civil Contractor", contract_value: "" }); setPartyError(""); setPartyModal({ resolve }); });
  const saveParty = async () => {
    if (!partyForm.name?.trim()) return setPartyError("Party name is required");
    setPartySaving(true); setPartyError("");
    try {
      const { data } = await api.post("/parties", { ...partyForm, name: partyForm.name.trim(), contract_value: Number(String(partyForm.contract_value || 0).replaceAll(",", "")), project_id: id });
      await parties.refetch(); setPartyModal((current) => { current?.resolve?.({ value: data.name, label: data.name }); return null; });
      setCredentials(data.initial_login);
    } catch (e) { setPartyError(e.response?.data?.detail || e.message); } finally { setPartySaving(false); }
  };
  const expFields = settings.data && accounts.data ? [
    { key: "date", label: "Date", type: "date", required: true, default: todayISO() },
    { key: "amount", label: "Amount (₹)", type: "money", required: true },
    { key: "category", label: "Category", type: "select", options: settings.data.project_categories || [], required: true },
    { key: "party", label: "Paid To (party)", type: "select", options: (parties.data || []).map((x) => ({ value: x.name, label: x.name })), onAddOption: quickCreateParty },
    { key: "payment_class", label: "Payment Type", type: "select", options: [{ value: "OFFICIAL", label: "Official (on record)" }, { value: "UNOFFICIAL", label: "Unofficial (cash)" }], default: "OFFICIAL" },
    { key: "account_id", label: "From Account", type: "select", options: [{ value: "CASH", label: "Cash (in hand)" }, ...(accounts.data || []).map((a) => ({ value: a.id, label: a.name }))], required: true },
    { key: "payment_mode", label: "Paid Via", type: "select", options: ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Net Banking"], required: true },
    { key: "utr_number", label: "UTR Number", visible: (form) => form.payment_mode === "UPI" },
    { key: "description", label: "Description", full: true },
  ] : null;
  const expCols = [
    { key: "date", label: "Date", type: "date" },
    { key: "category", label: "Category", render: (r) => <Badge tone="brand">{r.category}</Badge> },
    { key: "party", label: "Paid To" },
    { key: "payment_mode", label: "Via", render: (r) => r.payment_mode || "—" },
    { key: "payment_status", label: "Acknowledgement", render: (r) => r.payment_status ? <Badge tone={r.payment_status === "PARTY_ACKNOWLEDGED" ? "green" : "amber"}>{r.payment_status.replaceAll("_", " ").toLowerCase()}</Badge> : "—" },
    { key: "payment_class", label: "Type", render: (r) => <Badge tone={r.payment_class === "UNOFFICIAL" ? "amber" : "blue"}>{(r.payment_class || "OFFICIAL").toLowerCase()}</Badge> },
    { key: "description", label: "Note", render: (r) => <span className="text-subink">{r.description || "—"}</span> },
    { key: "amount", label: "Amount", align: "right", render: (r) => <span className="num font-semibold text-expense">{inr(r.amount)}</span> },
  ];

  const workFields = [
    { key: "date", label: "Date", type: "date", required: true },
    { key: "title", label: "Work Item", required: true, full: true },
    { key: "party", label: "Done By (party)" },
    { key: "status", label: "Status", type: "select", options: ["PLANNED", "IN_PROGRESS", "COMPLETED", "ON_HOLD"], default: "IN_PROGRESS" },
    { key: "progress", label: "Progress %", type: "number" },
    { key: "description", label: "Details", type: "textarea", full: true },
  ];
  const workCols = [
    { key: "date", label: "Date", type: "date" },
    { key: "title", label: "Work", render: (r) => <div><div className="font-medium text-ink">{r.title}</div><div className="text-xs text-faint">{r.description}</div></div> },
    { key: "party", label: "By" },
    { key: "progress", label: "Progress", render: (r) => <div className="w-24"><div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${r.progress || 0}%` }} /></div><div className="text-[10px] text-faint mt-0.5 num">{r.progress || 0}%</div></div> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <StateBlock loading={project.loading} error={project.error} onRetry={project.refetch}>
      {p && (
        <>
          <button onClick={() => nav("/projects")} className="flex items-center gap-1.5 text-sm text-subink hover:text-ink mb-4" data-testid="back-projects"><ArrowLeft size={16} /> All projects</button>
          <Card className="overflow-hidden mb-6">
            <div className="h-40 sm:h-52 bg-muted relative">
              {heroImg && <img src={heroImg} alt={p.name} className="w-full h-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} data-testid="project-photo-input" />
              <button onClick={() => photoRef.current?.click()} disabled={uploadingPhoto} data-testid="project-photo-btn"
                className="absolute top-3 right-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/90 text-ink text-xs font-semibold hover:bg-white transition-colors">
                <Camera size={14} /> {uploadingPhoto ? "Uploading…" : "Change photo"}
              </button>
              <div className="absolute bottom-4 left-5 right-5 text-white">
                <div className="flex items-center gap-2 mb-1"><Badge tone="brand">{p.type}</Badge><StatusBadge status={p.status} /></div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">{p.name}</h1>
                {p.location && <div className="flex items-center gap-1 text-sm text-white/80 mt-1"><MapPin size={13} /> {p.location}</div>}
              </div>
            </div>
          </Card>

          <div className="mb-6 flex gap-3 items-center justify-between">
            <div className="overflow-x-auto -mx-1 px-1"><Segmented testid="proj-tabs" value={tab} onChange={setTab}
              options={[{ value: "overview", label: "Overview" }, { value: "finance", label: "Finance" }, { value: "work", label: "Work" }, { value: "parties", label: "Parties" }, { value: "documents", label: "Documents" }, ...(["construction", "renovation"].includes((p.type || "").toLowerCase()) ? [{ value: "cgas", label: "CGAS" }] : [])]} /></div>
            <Button size="sm" className="shrink-0" onClick={() => { setTab("finance"); setExpenseSignal((x) => x + 1); }} data-testid="project-quick-expense"><Plus size={15} /> Add Expense</Button>
          </div>

          {!f ? <div className="py-10 flex justify-center"><Spinner className="w-6 h-6 text-brand" /></div> : (
            <>
              {(tab === "overview" || tab === "finance") && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                    <KpiCard label="Budget" raw={f.budget} tone="ink" testid="pf-budget" />
                    <KpiCard label="Received" raw={f.received} tone="income" testid="pf-received" />
                    <KpiCard label="Spent" raw={f.spent} tone="expense" testid="pf-spent" />
                    <KpiCard label="Remaining Budget" raw={f.remaining_budget} tone={f.remaining_budget >= 0 ? "brand" : "expense"} testid="pf-remaining" />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                    <KpiCard label="Committed" raw={f.committed} tone="amber" testid="pf-committed" />
                    <KpiCard label="Outstanding" raw={f.outstanding} tone="ink" />
                    <KpiCard label="Available" raw={f.available} tone="info" />
                    <KpiCard label="Utilization" value={`${f.utilization}%`} tone="brand" />
                  </div>
                  <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
                    <ChartCard title="Monthly In vs Out" className="lg:col-span-2" height={240}>
                      {f.monthly?.length ? <CashFlowArea data={f.monthly} /> : <NoData />}
                    </ChartCard>
                    <ChartCard title="Cost by Category" height={240}>
                      {f.cost_by_category?.length ? <Donut data={f.cost_by_category} centerLabel="Spent" centerValue={inr(f.spent, { compact: true })} /> : <NoData />}
                    </ChartCard>
                  </div>
                  <ChartCard title="Cost by Party" height={240} className="mb-6">
                    {f.cost_by_party?.length ? <Bars data={f.cost_by_party} series={[{ key: "value", name: "Paid", color: "#0D9488" }]} /> : <NoData />}
                  </ChartCard>
                </>
              )}

              {tab === "finance" && expFields && (
                <CrudManager title="Project Expenses" endpoint="/transactions" listEndpoint={`/transactions?type=EXPENSE&project_id=${id}`}
                  addLabel="Add expense" fields={expFields} columns={expCols} onChanged={() => { finance.refetch(); project.refetch(); }}
                  transform={(x) => ({ ...x, type: "EXPENSE", scope: "PROJECT", project_id: id })} deps={[id, parties.data]} openSignal={expenseSignal} />
              )}

              {tab === "work" && (
                <CrudManager title="Work Progress" endpoint="/work-logs" listEndpoint={`/work-logs?project_id=${id}`}
                  addLabel="Log work" fields={workFields} columns={workCols}
                  transform={(x) => ({ ...x, project_id: id })} deps={[id]} />
              )}

              {tab === "parties" && (
                <CrudManager title="Parties & Vendors" endpoint="/parties" listEndpoint={`/parties?project_id=${id}`}
                  addLabel="Add party" fields={partyFields} columns={partyCols} onChanged={() => { finance.refetch(); parties.refetch(); }}
                  transform={(x) => ({ ...x, project_id: id })} deps={[id]} onCreated={(party) => party.initial_login && setCredentials(party.initial_login)} />
              )}

              {tab === "documents" && <DocumentsPanel projectId={id} title="Project Documents (Official & Unofficial)" showOfficial defaultCategory="Project" />}
              {tab === "cgas" && <ConstructionCgas projectId={id} />}
            </>
          )}
          <Modal open={!!partyModal} onClose={() => { partyModal?.resolve?.(null); setPartyModal(null); }} title="Add a project party" size="lg">
            <p className="text-sm text-subink mb-4">Add the party’s details here. A private party login will be created automatically.</p>
            <div className="grid sm:grid-cols-2 gap-3"><Field label="Party name *" className="sm:col-span-2"><Input autoFocus value={partyForm.name || ""} onChange={(e) => setPartyForm((f) => ({ ...f, name: e.target.value }))}/></Field><Field label="Type"><Select value={partyForm.party_type || "Other"} onChange={(e) => setPartyForm((f) => ({ ...f, party_type: e.target.value }))}>{partyFields[1].options.map((type) => <option key={type}>{type}</option>)}</Select></Field><Field label="Contact"><Input value={partyForm.contact || ""} onChange={(e) => setPartyForm((f) => ({ ...f, contact: e.target.value }))}/></Field><Field label="Scope of work"><Input value={partyForm.scope || ""} onChange={(e) => setPartyForm((f) => ({ ...f, scope: e.target.value }))}/></Field><Field label="Contract value (₹)"><Input inputMode="decimal" value={partyForm.contract_value || ""} onChange={(e) => setPartyForm((f) => ({ ...f, contract_value: e.target.value }))}/></Field></div>
            {partyError && <p className="mt-3 text-sm text-expense">{partyError}</p>}<div className="flex gap-2 pt-5"><Button variant="secondary" className="flex-1" onClick={() => { partyModal?.resolve?.(null); setPartyModal(null); }}>Cancel</Button><Button className="flex-1" disabled={partySaving} onClick={saveParty}>{partySaving ? "Creating…" : "Create party"}</Button></div>
          </Modal>
          <Modal open={!!credentials} onClose={() => setCredentials(null)} title="Party login created" size="sm"><p className="text-sm text-subink">Share these temporary credentials securely with the party.</p><div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-2"><div><div className="overline text-faint">Login ID</div><div className="font-semibold text-ink break-all">{credentials?.email}</div></div><div><div className="overline text-faint">Default password</div><div className="font-semibold text-ink">{credentials?.password}</div></div></div><Button className="w-full mt-4" onClick={() => setCredentials(null)}>Done</Button></Modal>
        </>
      )}
    </StateBlock>
  );
}
function NoData() { return <div className="h-full flex items-center justify-center text-sm text-faint">No data yet</div>; }
