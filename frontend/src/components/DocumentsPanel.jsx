import React, { useRef, useState } from "react";
import { Upload, FileText, Download, Trash2, File, Pencil, ShieldCheck, ShieldOff } from "lucide-react";
import { Card, Button, StateBlock, Select, Field, Input, Modal, Badge, cx } from "./ui";
import { useFetch } from "../lib/useFetch";
import api, { apiError, docUrl } from "../lib/api";
import { fmtDate } from "../lib/format";

const DEFAULT_CATS = ["Project", "Bank", "Payment", "Contract", "Invoice", "Receipt", "Loan", "Lending", "Goal", "Investment", "Drawing", "Certificate", "ITR", "Income Tax", "Income Proof", "Identity", "Property", "Insurance", "Other"];

export default function DocumentsPanel({ projectId, relatedEntityId, relatedEntityType, title = "Documents", query = "", categories, memberOptions, showOfficial = false, showTaxFields = false, showLinks = false, defaultCategory = "Other", onChanged }) {
  const entityId = relatedEntityId || projectId;
  const entityType = relatedEntityType || (projectId ? "project" : "");
  const base = entityId ? `/documents?related_entity_id=${encodeURIComponent(entityId)}${entityType ? `&related_entity_type=${encodeURIComponent(entityType)}` : ""}` : "/documents";
  const url = query ? `${base}${base.includes("?") ? "&" : "?"}${query}` : base;
  const { data, loading, error, refetch } = useFetch(url, [url]);
  const links = useFetch("/documents/link-options");
  const fileRef = useRef();
  const cats = categories || DEFAULT_CATS;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: defaultCategory, official: "true" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [rename, setRename] = useState(null);
  const [renameVal, setRenameVal] = useState("");

  const docs = data || [];
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const upload = async () => {
    if (!file) { setErr("Choose a file first"); return; }
    setErr(""); setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", form.category || "Other");
      if (form.display_name) fd.append("display_name", form.display_name);
      if (form.notes) fd.append("notes", form.notes);
      if (showOfficial) fd.append("official", form.official || "true");
      if (showTaxFields && form.financial_year) fd.append("financial_year", form.financial_year);
      if (memberOptions && form.family_member_id) fd.append("family_member_id", form.family_member_id);
      if (showLinks && form.related_entity_id) { fd.append("related_entity_id", form.related_entity_id); fd.append("related_entity_type", form.related_entity_type); }
      if (entityId && entityType) { fd.append("related_entity_id", entityId); fd.append("related_entity_type", entityType); }
      if (projectId) fd.append("project_id", projectId);
      await api.post("/documents", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setOpen(false); setFile(null); setForm({ category: defaultCategory, official: "true" });
      refetch(); onChanged && onChanged();
    } catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  };

  const doRename = async () => {
    await api.put(`/documents/${rename.id}`, { filename: renameVal });
    setRename(null); refetch();
  };
  const download = (dc) => window.open(docUrl(dc.id), "_blank");
  const del = async (dc) => { if (window.confirm(`Delete ${dc.filename}?`)) { await api.delete(`/documents/${dc.id}`); refetch(); onChanged && onChanged(); } };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div><h3 className="font-display font-semibold text-ink">{title}</h3>{!projectId && <p className="text-xs text-subink mt-0.5">Keep policy, loan, property and payment records beside your financial plan.</p>}</div>
        <Button size="sm" onClick={() => { setErr(""); setFile(null); setForm({ category: defaultCategory, official: "true" }); setOpen(true); }} data-testid="upload-doc"><Upload size={15} /> Upload</Button>
      </div>
      <StateBlock loading={loading} error={error} empty={docs.length === 0} emptyText="No documents uploaded yet." onRetry={refetch}>
        <div className="divide-y divide-line">
          {docs.map((dc) => (
            <div key={dc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
              <span className="w-9 h-9 rounded-lg bg-brand-light text-brand flex items-center justify-center shrink-0"><FileText size={17} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink truncate">{dc.filename}</div>
                <div className="text-xs text-faint">{fmtDate(dc.created_at)} · {(dc.size / 1024).toFixed(0)} KB {dc.financial_year ? `· FY ${dc.financial_year}` : ""}</div>
              </div>
              {dc.official === true && <Badge tone="blue"><ShieldCheck size={11} /> official</Badge>}
              {dc.official === false && <Badge tone="amber"><ShieldOff size={11} /> unofficial</Badge>}
              <Badge tone="gray">{dc.category}</Badge>
              <button onClick={() => { setRename(dc); setRenameVal((dc.filename || "").replace(/\.[^.]+$/, "")); }} className="p-1.5 rounded-lg text-subink hover:bg-white hover:text-brand" data-testid={`rename-${dc.id}`}><Pencil size={15} /></button>
              <button onClick={() => download(dc)} className="p-1.5 rounded-lg text-subink hover:bg-white hover:text-brand" data-testid={`download-${dc.id}`}><Download size={16} /></button>
              <button onClick={() => del(dc)} className="p-1.5 rounded-lg text-subink hover:bg-white hover:text-expense"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </StateBlock>

      <Modal open={open} onClose={() => setOpen(false)} title="Upload document">
        <div className="space-y-3">
          <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-line rounded-xl p-6 text-center cursor-pointer hover:border-brand/50 hover:bg-muted/40 transition-colors">
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} data-testid="file-input" />
            <File className="w-8 h-8 text-faint mx-auto mb-2" />
            <div className="text-sm text-ink font-medium">{file ? file.name : "Click to choose a file"}</div>
            <div className="text-xs text-faint mt-1">PDF, images, spreadsheets · max 25MB</div>
          </div>
          <Field label="Rename file (optional — format is kept)"><Input value={form.display_name || ""} onChange={(e) => set("display_name", e.target.value)} placeholder="e.g. ICICI Statement Sep 2026" data-testid="doc-name" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><Select value={form.category} onChange={(e) => set("category", e.target.value)} data-testid="doc-category">{cats.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            {showOfficial && <Field label="Paperwork Type"><Select value={form.official} onChange={(e) => set("official", e.target.value)} data-testid="doc-official"><option value="true">Official</option><option value="false">Unofficial</option></Select></Field>}
            {showTaxFields && <Field label="Financial Year"><Input value={form.financial_year || ""} onChange={(e) => set("financial_year", e.target.value)} placeholder="2025-26" /></Field>}
            {memberOptions && <Field label="Belongs To"><Select value={form.family_member_id || ""} onChange={(e) => set("family_member_id", e.target.value)}><option value="">Self</option>{memberOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select></Field>}
            {showLinks && <Field label="Attach to record" className="col-span-2"><Select value={form.related_entity_id || ""} onChange={(e) => { const opt=(links.data||[]).find(x=>x.id===e.target.value); set("related_entity_id", e.target.value); set("related_entity_type", opt?.type || ""); }}><option value="">No linked record</option>{(links.data||[]).map((o)=><option key={`${o.type}-${o.id}`} value={o.id}>{o.type.replace(/_/g," ")} · {o.label}</option>)}</Select></Field>}
          </div>
          <Field label="Notes"><Input value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} /></Field>
          {err && <div className="text-sm text-expense bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</div>}
          <div className="flex gap-2 pt-1"><Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button><Button className="flex-1" onClick={upload} disabled={busy} data-testid="upload-submit">{busy ? "Uploading…" : "Upload"}</Button></div>
        </div>
      </Modal>

      <Modal open={!!rename} onClose={() => setRename(null)} title="Rename document" size="sm">
        <Field label="New name (extension kept automatically)"><Input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)} data-testid="rename-input" /></Field>
        <div className="flex gap-2 pt-4"><Button variant="secondary" className="flex-1" onClick={() => setRename(null)}>Cancel</Button><Button className="flex-1" onClick={doRename} data-testid="rename-save">Save</Button></div>
      </Modal>
    </Card>
  );
}
