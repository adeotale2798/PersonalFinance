import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { Card, Button, Modal, Field, Input, Select, Textarea, StateBlock, cx } from "./ui";
import api, { apiError } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { inr, fmtDate, indianNumber, moneyValue, dateInputValue, dateToISO } from "../lib/format";

function FieldInput({ f, value, onChange }) {
  const common = { value: value ?? "", onChange: (e) => onChange(f.key, e.target.value), "data-testid": `field-${f.key}` };
  if (f.type === "select")
    return <Select {...common} onChange={async (e) => { if (e.target.value === "__add_option__") { const created = await f.onAddOption?.(); if (created) onChange(f.key, created.value ?? created); return; } onChange(f.key, e.target.value); }}><option value="">Select…</option>{(f.options || []).map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}{f.onAddOption && <option value="__add_option__">+ Add party…</option>}</Select>;
  if (f.type === "textarea") return <Textarea {...common} placeholder={f.placeholder} />;
  if (f.type === "money") return <Input inputMode="decimal" {...common} value={indianNumber(value)} onChange={(e) => onChange(f.key, moneyValue(e.target.value))} placeholder={f.placeholder || "0"} />;
  if (f.type === "number") return <Input type="number" step="any" {...common} placeholder={f.placeholder || "0"} />;
  if (f.type === "date") return <div className="flex gap-2"><Input {...common} value={dateInputValue(value)} placeholder={dateInputValue("2026-09-20")} /><label className="relative w-10 h-10 shrink-0 rounded-lg border border-line bg-white text-subink hover:bg-muted flex items-center justify-center cursor-pointer" title="Open calendar"><CalendarDays size={17}/><input type="date" aria-label={`Choose ${f.label}`} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value={dateToISO(value)} onChange={(e) => onChange(f.key, e.target.value)} /></label></div>;
  return <Input {...common} placeholder={f.placeholder} />;
}

export default function CrudManager({
  title, endpoint, listEndpoint, fields, columns, onChanged, addLabel = "Add", emptyText,
  canAdd = true, canEdit = true, canDelete = true, canEditRow, canDeleteRow, deps = [], transform, rowClassName,
  onRowClick, openSignal, onCreated,
}) {
  const { data, loading, error, refetch } = useFetch(listEndpoint || endpoint, deps);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const rows = (data || []);
  const cols = columns || fields.filter((f) => !f.hideInTable).map((f) => ({ key: f.key, label: f.label, type: f.type }));

  const openAdd = () => { setEditing(null); setForm(fields.reduce((a, f) => (f.default != null ? { ...a, [f.key]: f.default } : a), {})); setFormErr(""); setOpen(true); };
  useEffect(() => { if (openSignal) openAdd(); }, [openSignal]);
  const openEdit = (row) => { setEditing(row); setForm({ ...row }); setFormErr(""); setOpen(true); };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setFormErr(""); setSaving(true);
    try {
      const payload = { ...form };
      fields.forEach((f) => { if ((f.type === "number" || f.type === "money") && payload[f.key] != null && payload[f.key] !== "") payload[f.key] = parseFloat(moneyValue(payload[f.key])); });
      fields.forEach((f) => { if (f.type === "date" && payload[f.key]) payload[f.key] = dateToISO(payload[f.key]); });
      for (const f of fields) if ((!f.visible || f.visible(payload)) && f.required && (payload[f.key] == null || payload[f.key] === "")) throw new Error(`${f.label} is required`);
      const body = transform ? transform(payload) : payload;
      let response;
      if (editing) response = await api.put(`${endpoint}/${editing.id}`, body);
      else response = await api.post(endpoint, body);
      setOpen(false); await refetch(); onChanged && onChanged();
      onCreated && onCreated(response.data);
    } catch (e) { setFormErr(e.response ? apiError(e) : e.message); } finally { setSaving(false); }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete "${row[cols[0].key] || "this record"}"? This cannot be undone.`)) return;
    await api.delete(`${endpoint}/${row.id}`); await refetch(); onChanged && onChanged();
  };

  const renderCell = (row, c) => {
    if (c.render) return c.render(row);
    const v = row[c.key];
    if (c.type === "money") return <span className="num font-semibold">{inr(v)}</span>;
    if (c.type === "date") return fmtDate(v);
    return v ?? "—";
  };
  const primaryCol = cols[0];
  const metricCol = cols.slice(1).find((c) => c.type === "money");

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <h3 className="font-display font-semibold text-ink">{title}</h3>
        {canAdd && <Button size="sm" onClick={openAdd} data-testid={`add-${title.replace(/\s+/g, "-").toLowerCase()}`}><Plus size={15} /> {addLabel}</Button>}
      </div>
      <StateBlock loading={loading} error={error} empty={rows.length === 0} emptyText={emptyText || "No records yet — add your first one."} onRetry={refetch}>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-50/95 backdrop-blur text-faint overline border-b border-line">
              <tr>{cols.map((c) => <th key={c.key} className={cx("px-4 py-2.5 whitespace-nowrap", c.align === "right" && "text-right")}>{c.label}</th>)}
                {(canEdit || canDelete) && <th className="px-4 py-2.5 text-right">Actions</th>}</tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} onClick={() => onRowClick && onRowClick(row)} className={cx("border-b border-line/70 hover:bg-teal-50/40 transition-colors", onRowClick && "cursor-pointer", rowClassName && rowClassName(row))}>
                  {cols.map((c) => <td key={c.key} className={cx("px-4 py-3 text-ink/90", c.align === "right" && "text-right num")}>{renderCell(row, c)}</td>)}
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canEdit && (!canEditRow || canEditRow(row)) && <button aria-label={`Edit ${row[primaryCol.key] || title}`} onClick={(event) => { event.stopPropagation(); openEdit(row); }} className="p-1.5 rounded-lg text-subink hover:bg-white hover:text-brand" data-testid={`edit-${row.id}`}><Pencil size={15} /></button>}
                      {canDelete && (!canDeleteRow || canDeleteRow(row)) && <button aria-label={`Delete ${row[primaryCol.key] || title}`} onClick={(event) => { event.stopPropagation(); remove(row); }} className="p-1.5 rounded-lg text-subink hover:bg-white hover:text-expense" data-testid={`delete-${row.id}`}><Trash2 size={15} /></button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-line/70 md:hidden" data-testid="crud-mobile-list">
          {rows.map((row) => (
            <article key={row.id} className={cx("px-4 py-4", rowClassName && rowClassName(row))} data-testid={`crud-mobile-row-${row.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {onRowClick ? (
                    <button type="button" onClick={() => onRowClick(row)} className="min-h-11 max-w-full text-left font-semibold text-ink break-words">
                      {renderCell(row, primaryCol)}
                    </button>
                  ) : (
                    <div className="font-semibold text-ink break-words">{renderCell(row, primaryCol)}</div>
                  )}
                </div>
                {metricCol && <div className="shrink-0 text-right">{renderCell(row, metricCol)}</div>}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
                {cols.filter((c) => c.key !== primaryCol.key && c.key !== metricCol?.key).map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-faint">{c.label}</dt>
                    <dd className="mt-0.5 break-words text-xs text-ink/90">{renderCell(row, c)}</dd>
                  </div>
                ))}
              </dl>
              {(canEdit || canDelete) && (
                <div className="mt-3 flex justify-end gap-2">
                  {canEdit && (!canEditRow || canEditRow(row)) && <button aria-label={`Edit ${row[primaryCol.key] || title}`} onClick={() => openEdit(row)} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-subink hover:bg-muted hover:text-brand" data-testid={`mobile-edit-${row.id}`}><Pencil size={17} /></button>}
                  {canDelete && (!canDeleteRow || canDeleteRow(row)) && <button aria-label={`Delete ${row[primaryCol.key] || title}`} onClick={() => remove(row)} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-subink hover:bg-rose-50 hover:text-expense" data-testid={`mobile-delete-${row.id}`}><Trash2 size={17} /></button>}
                </div>
              )}
            </article>
          ))}
        </div>
      </StateBlock>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${title}` : `Add ${title}`} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fields.filter((f) => !f.visible || f.visible(form)).map((f) => (
            <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}${f.type === "date" ? ` (${localStorage.getItem("nivara_date_format") || "DD-MM-YYYY"})` : ""}`} className={f.full ? "sm:col-span-2" : ""}>
              <FieldInput f={f} value={form[f.key]} onChange={set} />
            </Field>
          ))}
        </div>
        {formErr && <div className="text-sm text-expense bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-3">{formErr}</div>}
        <div className="flex gap-2 pt-4">
          <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="flex-1" onClick={save} disabled={saving} data-testid="crud-save">{saving ? "Saving…" : "Save"}</Button>
        </div>
      </Modal>
    </Card>
  );
}
