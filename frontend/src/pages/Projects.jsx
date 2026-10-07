import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Plus, MapPin, ArrowRight, Download } from "lucide-react";
import { useFetch } from "../lib/useFetch";
import { PageHeader, StateBlock, Card, Button, Modal, Field, Input, Select, Textarea, Badge, StatusBadge } from "../components/ui";
import KpiCard from "../components/KpiCard";
import api, { apiError } from "../lib/api";
import { downloadEntity } from "../lib/export";
import { inr, todayISO } from "../lib/format";

export default function Projects() {
  const { data, loading, error, refetch } = useFetch("/projects");
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const projects = data || [];
  const totalBudget = projects.reduce((a, p) => a + (p.budget || 0), 0);
  const totalSpent = projects.reduce((a, p) => a + (p.spent || 0), 0);

  const save = async () => {
    setErr(""); setBusy(true);
    try {
      if (!form.name) throw new Error("Project name is required");
      await api.post("/projects", { ...form, budget: parseFloat(form.budget) || 0, progress: parseInt(form.progress) || 0 });
      setOpen(false); setForm({}); refetch();
    } catch (e) { setErr(e.response ? apiError(e) : e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Projects" subtitle="Construction and other managed initiatives." icon={FolderKanban}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => downloadEntity("projects", {}, "projects")}><Download size={15} /> Export Excel</Button>
            <Button size="sm" onClick={() => { setForm({ status: "PLANNING", type: "Construction", start_date: todayISO() }); setErr(""); setOpen(true); }} data-testid="add-project"><Plus size={15} /> New project</Button>
          </>
        } />

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <KpiCard label="Projects" value={String(projects.length)} tone="brand" testid="proj-count" />
        <KpiCard label="Total Budget" raw={totalBudget} tone="ink" testid="proj-budget" />
        <KpiCard label="Total Spent" raw={totalSpent} tone="expense" testid="proj-spent" />
      </div>

      <StateBlock loading={loading} error={error} empty={projects.length === 0} emptyText="No projects yet — create your first one." onRetry={refetch}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {projects.map((p) => {
            const pct = p.budget ? Math.min(100, Math.round((p.spent / p.budget) * 100)) : 0;
            return (
              <Card key={p.id} className="overflow-hidden hover:shadow-card transition-all cursor-pointer group" onClick={() => nav(`/projects/${p.id}`)} data-testid={`project-card-${p.id}`}>
                <div className="relative h-24 overflow-hidden bg-gradient-to-br from-indigo-50 via-slate-50 to-cyan-50 sm:h-36">
                  {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                  {!p.image_url && <FolderKanban aria-hidden="true" className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-brand/25" />}
                  <div className="absolute top-3 left-3"><Badge tone="brand">{p.type}</Badge></div>
                  <div className="absolute top-3 right-3"><StatusBadge status={p.status} /></div>
                </div>
                <div className="p-4">
                  <h3 className="font-display font-semibold text-ink group-hover:text-brand transition-colors">{p.name}</h3>
                  {p.location && <div className="flex items-center gap-1 text-xs text-faint mt-1"><MapPin size={12} /> {p.location}</div>}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-subink"><span>Spent {inr(p.spent, { compact: true })}</span><span>Budget {inr(p.budget, { compact: true })}</span></div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} /></div>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-sm">
                    <span className="text-subink">Remaining <span className="num font-semibold text-ink">{inr(p.remaining, { compact: true })}</span></span>
                    <ArrowRight size={16} className="text-faint group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </StateBlock>

      <Modal open={open} onClose={() => setOpen(false)} title="New Project" size="lg">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Project Name *" className="sm:col-span-2"><Input autoFocus value={form.name || ""} onChange={(e) => set("name", e.target.value)} data-testid="proj-name" /></Field>
          <Field label="Type"><Select value={form.type || "Construction"} onChange={(e) => set("type", e.target.value)}>{["Construction", "Renovation", "Commercial", "Warehouse", "Business", "Personal", "Other"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Status"><Select value={form.status || "PLANNING"} onChange={(e) => set("status", e.target.value)}>{["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Location"><Input value={form.location || ""} onChange={(e) => set("location", e.target.value)} /></Field>
          <Field label="Budget (₹)"><Input type="number" value={form.budget || ""} onChange={(e) => set("budget", e.target.value)} data-testid="proj-budget-input" /></Field>
          <Field label="Start Date"><Input type="date" value={form.start_date || ""} onChange={(e) => set("start_date", e.target.value)} /></Field>
          <Field label="Target Completion"><Input type="date" value={form.target_completion_date || ""} onChange={(e) => set("target_completion_date", e.target.value)} /></Field>
          <Field label="Progress %"><Input type="number" value={form.progress || ""} onChange={(e) => set("progress", e.target.value)} /></Field>
          <Field label="Image URL"><Input value={form.image_url || ""} onChange={(e) => set("image_url", e.target.value)} /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} /></Field>
        </div>
        {err && <div className="text-sm text-expense bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-3">{err}</div>}
        <div className="flex gap-2 pt-4"><Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button><Button className="flex-1" onClick={save} disabled={busy} data-testid="proj-save">{busy ? "Saving…" : "Create"}</Button></div>
      </Modal>
    </>
  );
}
