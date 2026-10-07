import React, { useState } from "react";
import { KeyRound, Plus, Pencil, Trash2, ShieldCheck, Compass, Search, Users, UserCheck, FolderKanban, Copy, Check, UserRoundX } from "lucide-react";
import { useFetch } from "../lib/useFetch";
import { PageHeader, StateBlock, Card, Button, Modal, Field, Input, Select, Badge, cx } from "../components/ui";
import api, { apiError } from "../lib/api";
import { useAuth } from "../lib/auth";

const LEVEL_CYCLE = ["none", "view", "edit", "approve"];
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
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyUserId, setBusyUserId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copiedField, setCopiedField] = useState("");

  const modules = meta.data?.modules || [];
  React.useEffect(() => {
    if (!currentUser?.is_platform_admin) return;
    const load = () => api.get("/sitewalkthrough/status")
      .then(({ data }) => { setWalkthroughEnabled(data.enabled); setWalkthroughError(""); })
      .catch((error) => setWalkthroughError(apiError(error)));
    load();
    window.addEventListener("nivara:data-changed", load);
    return () => window.removeEventListener("nivara:data-changed", load);
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
      if (modal.mode === "edit") {
        await api.put(`/users/${modal.user.id}`, body);
        setActionMessage(`${form.name} was updated.`);
        setCreatedCredentials(null);
      } else {
        const { data: created } = await api.post("/users", { ...body, email: form.email, password: form.password || "changeme123" });
        setCreatedCredentials(created.initial_login || { email: created.email || form.email, password: form.password || "changeme123" });
        setActionMessage(`${form.name} was added.`);
      }
      setActionError("");
      setModal(null);
      await users.refetch(true);
    } catch (e) { setErr(e.response ? apiError(e) : e.message); } finally { setBusy(false); }
  };

  const setUserActive = async (user) => {
    setBusyUserId(user.id);
    setActionMessage("");
    setActionError("");
    try {
      await api.put(`/users/${user.id}`, { active: user.active === false });
      setActionMessage(`${user.name} is now ${user.active === false ? "active" : "inactive"}.`);
      await users.refetch(true);
    } catch (error) {
      setActionError(apiError(error));
    } finally {
      setBusyUserId("");
    }
  };

  const del = async (user) => {
    if (!window.confirm(`Delete user ${user.email}? This cannot be undone.`)) return;
    setActionMessage("");
    setActionError("");
    try {
      await api.delete(`/users/${user.id}`);
      setActionMessage(`${user.name} was deleted.`);
      await users.refetch(true);
    } catch (error) {
      setActionError(apiError(error));
    }
  };

  const rows = (users.data || []);
  const activeCount = rows.filter((user) => user.active !== false).length;
  const projectGrantCount = rows.reduce((sum, user) => sum + (user.permissions || []).length, 0);
  const filteredRows = rows.filter((user) => {
    const search = query.trim().toLocaleLowerCase();
    const matchesQuery = !search || [user.name, user.email, user.workspace_name, user.party_type]
      .some((value) => String(value || "").toLocaleLowerCase().includes(search));
    return matchesQuery
      && (roleFilter === "all" || user.role === roleFilter)
      && (statusFilter === "all" || (statusFilter === "active" ? user.active !== false : user.active === false));
  });
  const defaultPassword = (name) => `${String(name || "Party").trim().split(/\s+/).pop()}@123`;
  const canManageUser = (user) => (user.role !== "SUPER_ADMIN" || currentUser?.is_platform_admin)
    && user.id !== currentUser?.id && user.email !== currentUser?.email;
  const copyCredential = async (field, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setActionError("");
      window.setTimeout(() => setCopiedField(""), 1800);
    } catch {
      setActionError("Could not copy to clipboard. Select the credential and copy it manually.");
    }
  };

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

      {createdCredentials && <Card className="mb-5 border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 sm:p-5" role="status" data-testid="created-user-credentials">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Check size={18} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="font-display font-bold text-ink">User created — share sign-in details</h2><p className="mt-1 text-xs text-subink">This password is shown once. Ask them to change it after their first sign-in.</p></div>
              <button type="button" onClick={() => setCreatedCredentials(null)} className="rounded-lg p-1 text-faint hover:bg-white" aria-label="Dismiss sign-in details">×</button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[["email", "Login ID", createdCredentials.email], ["password", "Temporary password", createdCredentials.password]].map(([field, label, value]) => (
                <div key={field} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-white/90 px-3 py-2">
                  <div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-wide text-faint">{label}</div><div className="truncate text-sm font-semibold text-ink">{value}</div></div>
                  <button type="button" onClick={() => copyCredential(field, value)} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-brand hover:bg-brand-light" aria-label={`Copy ${label}`}><Copy size={13} />{copiedField === field ? "Copied" : "Copy"}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>}

      {(actionMessage || actionError) && <div role={actionError ? "alert" : "status"} className={cx("mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm", actionError ? "border-rose-200 bg-rose-50 text-expense" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
        <span>{actionError || actionMessage}</span>
        <button type="button" onClick={() => { setActionMessage(""); setActionError(""); }} className="shrink-0 rounded-lg px-2 py-1 font-bold hover:bg-white/70" aria-label="Dismiss message">×</button>
      </div>}

      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Access management summary" data-testid="access-summary">
        <Card className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-brand"><Users size={19} /></span><div><p className="overline text-faint">People</p><p className="num text-xl font-extrabold text-ink">{rows.length}</p></div></Card>
        <Card className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><UserCheck size={19} /></span><div><p className="overline text-faint">Active access</p><p className="num text-xl font-extrabold text-ink">{activeCount}<span className="ml-1 font-sans text-xs font-semibold text-faint">of {rows.length}</span></p></div></Card>
        <Card className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-700"><FolderKanban size={19} /></span><div><p className="overline text-faint">Project assignments</p><p className="num text-xl font-extrabold text-ink">{projectGrantCount}</p></div></Card>
      </section>

      <Card className="mb-4 p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_12rem_10rem]">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, login or workspace" aria-label="Search users" className="pl-9" data-testid="user-search" />
          </label>
          <Select aria-label="Filter users by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} data-testid="user-role-filter">
            <option value="all">All roles</option>
            {[...new Set(rows.map((user) => user.role).filter(Boolean))].map((role) => <option key={role} value={role}>{role.replace(/_/g, " ")}</option>)}
          </Select>
          <Select aria-label="Filter users by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} data-testid="user-status-filter">
            <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </Select>
        </div>
        <p className="mt-2 px-1 text-xs text-faint" aria-live="polite">Showing {filteredRows.length} of {rows.length} {rows.length === 1 ? "person" : "people"}</p>
      </Card>

      <Card className="overflow-hidden">
        <StateBlock loading={users.loading} error={users.error} empty={rows.length === 0} onRetry={users.refetch}>
          {filteredRows.length === 0 ? <div className="px-5 py-12 text-center"><Users size={24} className="mx-auto text-faint" /><p className="mt-2 text-sm font-semibold text-ink">No people match these filters</p><button type="button" className="mt-2 text-xs font-bold text-brand" onClick={() => { setQuery(""); setRoleFilter("all"); setStatusFilter("all"); }}>Clear filters</button></div> : <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-faint overline border-b border-line">
                <tr><th className="px-4 py-2.5">User</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">Access</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {filteredRows.map((u) => (
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
                      {canManageUser(u) && <>
                        <button onClick={() => openEdit(u)} aria-label={`Edit ${u.name}`} title="Edit access" className="p-1.5 rounded-lg text-subink hover:bg-white hover:text-brand" data-testid={`edit-user-${u.id}`}><Pencil size={15} /></button>
                        <button onClick={() => setUserActive(u)} aria-label={`${u.active === false ? "Activate" : "Deactivate"} ${u.name}`} title={u.active === false ? "Activate user" : "Deactivate user"} disabled={busyUserId === u.id} className="p-1.5 rounded-lg text-subink hover:bg-white hover:text-amber-700 disabled:opacity-50" data-testid={`toggle-user-active-${u.id}`}><UserRoundX size={15} /></button>
                        <button onClick={() => del(u)} aria-label={`Delete ${u.name}`} title="Delete user" className="p-1.5 rounded-lg text-subink hover:bg-white hover:text-expense" data-testid={`delete-user-${u.id}`}><Trash2 size={15} /></button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-line md:hidden">
            {filteredRows.map((u) => <article key={u.id} className="p-4" data-testid={`user-card-${u.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h2 className="truncate font-bold text-ink">{u.name}</h2><p className="truncate text-xs text-subink">{u.email}</p>{currentUser?.is_platform_admin && <p className="mt-1 truncate text-[11px] text-faint">{u.workspace_name || "Platform"}</p>}</div>
                <Badge tone={u.active === false ? "gray" : "green"}>{u.active === false ? "inactive" : "active"}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={u.role === "SUPER_ADMIN" ? "brand" : u.role === "PROJECT_ADMIN" ? "blue" : "gray"}>{u.is_platform_admin ? "PLATFORM ADMIN" : (u.role || "").replace(/_/g, " ")}</Badge>
                {u.party_type && <span className="text-xs text-faint">{u.party_type}</span>}
              </div>
              <p className="mt-2 text-xs text-subink">{u.role === "SUPER_ADMIN" ? "Full workspace access" : u.role === "HOUSEHOLD_USER" ? "Account grants managed per account" : `${(u.permissions || []).length} project${(u.permissions || []).length !== 1 ? "s" : ""} assigned`}</p>
              {currentUser?.is_platform_admin && <p className="mt-1 text-xs text-faint">Workspace: {u.workspace_name || "Platform"}</p>}
              {canManageUser(u) && <div className="mt-3 flex gap-2 border-t border-line pt-3">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(u)} data-testid={`edit-user-${u.id}`}><Pencil size={14} /> Edit access</Button>
                <Button variant="secondary" size="sm" onClick={() => setUserActive(u)} disabled={busyUserId === u.id} data-testid={`toggle-user-active-${u.id}`}>{u.active === false ? "Activate" : "Deactivate"}</Button>
                <button type="button" onClick={() => del(u)} aria-label={`Delete ${u.name}`} className="grid h-8 w-9 place-items-center rounded-lg border border-line text-expense" data-testid={`delete-user-${u.id}`}><Trash2 size={15} /></button>
              </div>}
            </article>)}
          </div>
          </>}
        </StateBlock>
      </Card>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === "edit" ? "Edit user & access" : "Add a person"} size="xl">
        <p className="mb-4 text-sm text-subink">{modal?.mode === "edit" ? "Update this person's role, sign-in status and project permissions." : "Create a sign-in, choose the right role, then grant only the access they need."}</p>
        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          <Field label="Name"><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} data-testid="user-name" /></Field>
          <Field label="Login ID"><Input type="email" value={form.email || ""} disabled={modal?.mode === "edit"} onChange={(e) => set("email", e.target.value)} placeholder="Suggested from last name" data-testid="user-email" />{modal?.mode !== "edit" && <span className="mt-1 block text-[11px] text-faint">Suggested automatically. You can change it before saving.</span>}</Field>
          <Field label="Role"><Select value={form.role || "PARTY_USER"} onChange={(e) => set("role", e.target.value)}><option value="PARTY_USER">Party User · project access</option><option value="HOUSEHOLD_USER">Household collaborator · selected accounts</option><option value="PROJECT_ADMIN">Project Admin · manage project</option>{currentUser?.is_platform_admin && <option value="SUPER_ADMIN">Finance owner · separate workspace</option>}</Select></Field>
          <Field label="Party Type"><Select value={form.party_type || ""} onChange={(e) => set("party_type", e.target.value)}><option value="">—</option>{(meta.data?.party_types || []).map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label={modal?.mode === "edit" ? "Reset password (optional)" : "Temporary password"}><Input type="password" autoComplete="new-password" value={form.password || ""} onChange={(e) => set("password", e.target.value)} placeholder={modal?.mode === "edit" ? "Leave blank to keep current password" : "Suggested from name"} data-testid="user-password" />{modal?.mode !== "edit" && <span className="mt-1 block text-[11px] text-faint">The login details will be shown after the account is created.</span>}</Field>
          <Field label="Status"><Select value={form.active === false ? "false" : "true"} onChange={(e) => set("active", e.target.value === "true")}><option value="true">Active</option><option value="false">Inactive</option></Select></Field>
        </div>

        {form.role === "SUPER_ADMIN" && <p className="mb-4 text-sm text-brand bg-brand-light rounded-lg p-3">This creates a separate, blank finance workspace for this person. They will sign in with the credentials above and add their own accounts, projects, vendors and records.</p>}
        {form.role === "HOUSEHOLD_USER" && <p className="mb-4 text-sm text-brand bg-brand-light rounded-lg p-3">Household collaborators start with no account access. After saving, grant read-only or use access separately from each account in Accounts &amp; Cash. They cannot access projects, documents, or unrelated finance modules.</p>}
        {form.role !== "SUPER_ADMIN" && form.role !== "HOUSEHOLD_USER" && <><div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="font-display font-semibold text-ink">Project permissions</h4>
          <span className="text-xs text-faint">Tap a permission to cycle: none → view → edit → approve</span>
        </div>
        <p className="mb-3 text-xs text-subink">Set permissions separately for each project. No access is granted until you change a permission.</p>
        <div className="space-y-3 max-h-[38vh] overflow-y-auto pr-1">
          {(projects.data || []).length === 0 && <p className="text-sm text-subink py-4">No projects yet. Create a project first to grant access.</p>}
          {(projects.data || []).map((p) => (
            <Card key={p.id} className="p-3">
              <div className="text-sm font-semibold text-ink mb-2">{p.name}</div>
              <div className="flex flex-wrap gap-1.5">
                {modules.map((m) => {
                  const level = grants[p.id]?.modules?.[m] || "none";
                  return (
                    <button key={m} onClick={() => cycle(p.id, p.name, m)} aria-label={`${LABELS[m] || m}: ${level}. Click to change permission.`} aria-pressed={level !== "none"} data-testid={`perm-${p.id}-${m}`}
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

        {err && <div role="alert" className="text-sm text-expense bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-3">{err}</div>}
        <div className="flex gap-2 border-t border-line pt-4 mt-4"><Button variant="secondary" className="flex-1" onClick={() => setModal(null)} disabled={busy}>Cancel</Button><Button className="flex-1" onClick={save} disabled={busy} data-testid="user-save">{busy ? "Saving…" : modal?.mode === "edit" ? "Save changes" : "Create user"}</Button></div>
      </Modal>
    </>
  );
}
