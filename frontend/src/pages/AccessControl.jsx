import React, { useState } from "react";
import { KeyRound, Plus, Pencil, Trash2, ShieldCheck, Compass } from "lucide-react";
import { useFetch } from "../lib/useFetch";
import { PageHeader, StateBlock, Card, Button, Modal, Field, Input, Select, Badge, cx } from "../components/ui";
import api, { apiError } from "../lib/api";
import { useAuth } from "../lib/auth";

const LEVEL_CYCLE = ["none", "view", "edit", "approve"];
const LEVEL_TONE = { none: "gray", view: "blue", edit: "green", approve: "amber" };
const LABELS = { overview: "Overview", finance: "Finance", budget: "Budget", costs: "Costs", payments: "Payments", parties: "Parties", contracts: "Contracts", work: "Work", documents: "Documents", requests: "Requests", reports: "Reports" };

export default function AccessControl() {
  const { user: currentUser } = useAuth();
  const users = useFetch("/users");
  const projects = useFetch("/projects");
  const meta = useFetch("/access-meta");
  const [modal, setModal] = useState(null); // {mode, user}
  const [form, setForm] = useState({});
  const [grants, setGrants] = useState({}); // projectId -> {project_name, modules:{}}
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [walkthroughEnabled, setWalkthroughEnabled] = useState(null);
  const [walkthroughBusy, setWalkthroughBusy] = useState(false);
  const [walkthroughError, setWalkthroughError] = useState("");

  const modules = meta.data?.modules || [];
  React.useEffect(() => {
    if (!currentUser?.is_platform_admin) return;
    api.get("/sitewalkthrough/status")
      .then(({ data }) => setWalkthroughEnabled(data.enabled))
      .catch((error) => setWalkthroughError(apiError(error)));
  }, [currentUser?.is_platform_admin]);

  const setWalkthrough = async (enabled) => {
    setWalkthroughBusy(true);
    setWalkthroughError("");
    try {
      const { data } = await api.put("/sitewalkthrough/status", { enabled });
      setWalkthroughEnabled(data.enabled);
    } catch (error) {
      setWalkthroughError(apiError(error));
    } finally {
      setWalkthroughBusy(false);
    }
  };

  const suggestedLogin = (name) => {
    const last = String(name || "").trim().split(/\s+/).pop();
    return last ? `${last.replace(/[^a-z0-9]/gi, "").toLowerCase()}@nivara.com` : "";
  };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v, ...(k === "name" && modal?.mode === "add" ? { email: suggestedLogin(v), password: `${String(v || "").trim().split(/\s+/).pop() || ""}@123` } : {}) }));

  const openAdd = () => {
    setForm({ role: "PARTY_USER", party_type: "Contractor A", active: true });
    setGrants({}); setErr(""); setModal({ mode: "add" });
  };
  const openEdit = (u) => {
    setForm({ name: u.name, email: u.email, role: u.role, party_type: u.party_type, active: u.active });
    const g = {};
    (u.permissions || []).forEach((p) => { g[p.project_id] = { project_name: p.project_name, modules: { ...(p.modules || {}) } }; });
    setGrants(g); setErr(""); setModal({ mode: "edit", user: u });
  };

  const cycle = (projectId, projectName, module) => {
    setGrants((g) => {
      const cur = g[projectId] || { project_name: projectName, modules: {} };
      const level = cur.modules[module] || "none";
      const next = LEVEL_CYCLE[(LEVEL_CYCLE.indexOf(level) + 1) % LEVEL_CYCLE.length];
      const modulesN = { ...cur.modules, [module]: next };
      return { ...g, [projectId]: { project_name: projectName, modules: modulesN } };
    });
  };

  const save = async () => {
    setErr(""); setBusy(true);
    try {
      if (!form.name) throw new Error("Name is required");
      const permissions = form.role === "HOUSEHOLD_USER" ? [] : Object.entries(grants)
        .map(([pid, v]) => ({ project_id: pid, project_name: v.project_name, modules: Object.fromEntries(Object.entries(v.modules).filter(([, lvl]) => lvl && lvl !== "none")) }))
        .filter((p) => Object.keys(p.modules).length > 0);
      const body = { name: form.name || form.email, role: form.role, party_type: form.party_type, active: form.active, permissions };
      if (form.password) body.password = form.password;
      if (modal.mode === "edit") await api.put(`/users/${modal.user.id}`, body);
      else await api.post("/users", { ...body, email: form.email, password: form.password || "changeme123" });
      setModal(null); users.refetch();
    } catch (e) { setErr(e.response ? apiError(e) : e.message); } finally { setBusy(false); }
  };

  const del = async (u) => { if (window.confirm(`Delete user ${u.email}?`)) { try { await api.delete(`/users/${u.id}`); users.refetch(); } catch (e) { alert(apiError(e)); } } };

  const rows = (users.data || []);
  const defaultPassword = (name) => `${String(name || "Party").trim().split(/\s+/).pop()}@123`;

  return (
    <>
      <PageHeader title={currentUser?.is_platform_admin ? "Platform access control" : "Access Control"} subtitle={currentUser?.is_platform_admin ? "Manage every finance owner and their workspace users." : "Grant granular project access or explicitly share individual household accounts."} icon={KeyRound}
        actions={<Button size="sm" onClick={openAdd} data-testid="add-user"><Plus size={15} /> Add user</Button>} />

      {currentUser?.is_platform_admin && <Card className="mb-5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Compass size={19} className="mt-0.5 shrink-0 text-brand" />
            <div>
              <h2 className="font-display font-semibold text-ink">Public site walkthrough</h2>
              <p className="mt-1 text-sm text-subink">Allow visitors to view the public product tour and enter the sample demo.</p>
            </div>
          </div>
          <label className="inline-flex items-center gap-3 text-sm font-semibold text-ink">
            <span>{walkthroughEnabled === null ? "Loading…" : walkthroughEnabled ? "On" : "Off"}</span>
            <input
              aria-label="Enable public site walkthrough"
              type="checkbox"
              checked={walkthroughEnabled === true}
              disabled={walkthroughEnabled === null || walkthroughBusy}
              onChange={(event) => setWalkthrough(event.target.checked)}
              className="h-5 w-5 accent-indigo-600 disabled:cursor-not-allowed"
              data-testid="sitewalkthrough-toggle"
            />
          </label>
        </div>
        {walkthroughError && <p role="alert" className="mt-3 text-sm text-expense">{walkthroughError}</p>}
      </Card>}

      <Card className="overflow-hidden">
        <StateBlock loading={users.loading} error={users.error} empty={rows.length === 0} onRetry={users.refetch}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-faint overline border-b border-line">
                <tr><th className="px-4 py-2.5">User</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">Access</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-line/70 hover:bg-muted/40">
                    <td className="px-4 py-3"><div className="font-medium text-ink">{u.name}</div><div className="text-xs text-faint">{u.email}</div>{currentUser?.is_platform_admin && <div className="mt-1 text-xs text-subink">Workspace: {u.workspace_name}</div>}{currentUser?.role === "SUPER_ADMIN" && u.role === "PARTY_USER" && !u.initial_password_replaced && <div className="mt-1 text-xs text-brand">Initial password: {defaultPassword(u.name)}</div>}</td>
                    <td className="px-4 py-3"><Badge tone={u.role === "SUPER_ADMIN" ? "brand" : u.role === "PROJECT_ADMIN" ? "blue" : "gray"}>{u.is_platform_admin ? "PLATFORM ADMIN" : (u.role || "").replace(/_/g, " ")}</Badge>{u.party_type && <div className="text-xs text-faint mt-1">{u.party_type}</div>}</td>
                    <td className="px-4 py-3">
                      {u.role === "SUPER_ADMIN" ? <span className="text-xs text-brand flex items-center gap-1"><ShieldCheck size={13} /> Full access</span>
                        : u.role === "HOUSEHOLD_USER" ? <span className="text-xs text-subink">Account grants managed per account</span>
                          : <span className="text-xs text-subink">{(u.permissions || []).length} project{(u.permissions || []).length !== 1 ? "s" : ""}</span>}
                    </td>
                    <td className="px-4 py-3"><Badge tone={u.active === false ? "gray" : "green"}>{u.active === false ? "inactive" : "active"}</Badge></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {(u.role !== "SUPER_ADMIN" || currentUser?.is_platform_admin) && <>
                        <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-subink hover:bg-white hover:text-brand" data-testid={`edit-user-${u.id}`}><Pencil size={15} /></button>
                        <button onClick={() => del(u)} className="p-1.5 rounded-lg text-subink hover:bg-white hover:text-expense"><Trash2 size={15} /></button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateBlock>
      </Card>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === "edit" ? "Edit user & access" : "Add user"} size="xl">
        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          <Field label="Name"><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} data-testid="user-name" /></Field>
          <Field label="Login ID"><Input type="email" value={form.email || ""} disabled={modal?.mode === "edit"} onChange={(e) => set("email", e.target.value)} placeholder="Generated from last name" data-testid="user-email" /></Field>
          <Field label="Role"><Select value={form.role || "PARTY_USER"} onChange={(e) => set("role", e.target.value)}><option value="PARTY_USER">Party User</option><option value="HOUSEHOLD_USER">Household collaborator</option><option value="PROJECT_ADMIN">Project Admin</option>{currentUser?.is_platform_admin && <option value="SUPER_ADMIN">Finance owner — separate workspace</option>}</Select></Field>
          <Field label="Party Type"><Select value={form.party_type || ""} onChange={(e) => set("party_type", e.target.value)}><option value="">—</option>{(meta.data?.party_types || []).map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label={modal?.mode === "edit" ? "Reset Password (optional)" : "Default Password"}><Input type="text" value={form.password || ""} onChange={(e) => set("password", e.target.value)} placeholder={modal?.mode === "edit" ? "Leave blank to keep" : "LastName@123"} /></Field>
          <Field label="Status"><Select value={form.active === false ? "false" : "true"} onChange={(e) => set("active", e.target.value === "true")}><option value="true">Active</option><option value="false">Inactive</option></Select></Field>
        </div>

        {form.role === "SUPER_ADMIN" && <p className="mb-4 text-sm text-brand bg-brand-light rounded-lg p-3">This creates a separate, blank finance workspace for this person. They will sign in with the credentials above and add their own accounts, projects, vendors and records.</p>}
        {form.role === "HOUSEHOLD_USER" && <p className="mb-4 text-sm text-brand bg-brand-light rounded-lg p-3">Household collaborators start with no account access. After saving, grant read-only or use access separately from each account in Accounts &amp; Cash. They cannot access projects, documents, or unrelated finance modules.</p>}
        {form.role !== "SUPER_ADMIN" && form.role !== "HOUSEHOLD_USER" && <><div className="mb-2 flex items-center justify-between">
          <h4 className="font-display font-semibold text-ink">Project Access</h4>
          <span className="text-xs text-faint">Click a module to cycle: none → view → edit → approve</span>
        </div>
        <div className="space-y-3 max-h-[38vh] overflow-y-auto pr-1">
          {(projects.data || []).length === 0 && <p className="text-sm text-subink py-4">No projects yet. Create a project first to grant access.</p>}
          {(projects.data || []).map((p) => (
            <Card key={p.id} className="p-3">
              <div className="text-sm font-semibold text-ink mb-2">{p.name}</div>
              <div className="flex flex-wrap gap-1.5">
                {modules.map((m) => {
                  const level = grants[p.id]?.modules?.[m] || "none";
                  return (
                    <button key={m} onClick={() => cycle(p.id, p.name, m)} data-testid={`perm-${p.id}-${m}`}
                      className={cx("px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors",
                        level === "none" ? "border-line text-faint bg-white" :
                        level === "view" ? "border-sky-200 text-sky-700 bg-sky-50" :
                        level === "edit" ? "border-emerald-200 text-emerald-700 bg-emerald-50" :
                        "border-amber-200 text-amber-700 bg-amber-50")}>
                      {LABELS[m] || m}{level !== "none" && <span className="ml-1 opacity-70">· {level}</span>}
                    </button>
                  );
                })}
              </div>
            </Card>
          ))}
        </div></>}

        {err && <div className="text-sm text-expense bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-3">{err}</div>}
        <div className="flex gap-2 pt-4"><Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancel</Button><Button className="flex-1" onClick={save} disabled={busy} data-testid="user-save">{busy ? "Saving…" : "Save user"}</Button></div>
      </Modal>
    </>
  );
}
