import React, { useRef, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, FileUp, ShieldCheck, Undo2 } from "lucide-react";
import { Badge, Button, Card, Field, PageHeader, Select } from "../components/ui";
import api, { apiError } from "../lib/api";
import { inr } from "../lib/format";

export default function SmartImport() {
  const input = useRef();
  const [review, setReview] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [owner, setOwner] = useState("Self"), [selected, setSelected] = useState(new Set()), [undoResult, setUndoResult] = useState(null);
  const analyze = async (file) => {
    if (!file) return;
    setBusy(true); setError(""); setUndoResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const { data } = await api.post("/imports/analyze", body, { headers: { "Content-Type": "multipart/form-data" } });
      if (data.status === "ALREADY_IMPORTED") { setReview(null); setError(data.message); return; }
      setReview(data);
      setSelected(new Set(data.candidates.filter((row) => row.can_apply !== false && row.kind !== "NEEDS_GUIDANCE" && !row.duplicate).map((row) => row.row_number)));
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };
  const commit = async () => {
    setBusy(true); setError("");
    try {
      const { data } = await api.post(`/imports/${review.run_id}/commit`, { row_numbers: [...selected], owner });
      setReview({ ...review, committed: { ...data.summary, status: data.status || "COMMITTED" } });
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };
  const undo = async () => {
    if (!window.confirm("Undo this import batch? Records changed since import will be left untouched and reported.")) return;
    setBusy(true); setError(""); setUndoResult(null);
    try {
      const { data } = await api.post(`/imports/${review.run_id}/undo`);
      setUndoResult(data);
      setReview({ ...review, committed: { ...review.committed, status: data.status } });
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };
  const toggle = (row) => setSelected((current) => { const next = new Set(current); next.has(row) ? next.delete(row) : next.add(row); return next; });
  const canUndo = review?.committed && ["COMMITTED", "UNDO_PARTIAL"].includes(review.committed.status);
  return <>
    <PageHeader title="Import Center" subtitle="Analyze, review, reconcile and approve financial documents without silently changing your records." icon={Bot}/>
    <Card className="p-6 mb-6 bg-gradient-to-br from-teal-50 to-white">
      <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
        <div><h2 className="font-display font-bold text-ink">Bring a broker export into Nivara</h2><p className="text-sm text-subink mt-1">Every approved row retains its source document, row number, classifier confidence and duplicate fingerprint.</p></div>
        <Button onClick={() => input.current?.click()} disabled={busy}><FileUp size={16}/>{busy ? "Working…" : "Choose CSV or Excel"}</Button>
        <input ref={input} className="hidden" type="file" accept=".csv,.xlsx,.xlsm" onChange={(event) => analyze(event.target.files?.[0])}/>
      </div>
      {error && <p role="alert" className="text-sm text-expense mt-4">{error}</p>}
    </Card>
    {review && <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card className="p-4"><p className="text-xs text-subink">Ready to apply</p><p className="text-xl font-semibold text-ink">{review.preview?.ready ?? selected.size}</p></Card>
        <Card className="p-4"><p className="text-xs text-subink">Likely duplicates</p><p className="text-xl font-semibold text-amber-700">{review.preview?.duplicates ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-subink">Preview errors</p><p className="text-xl font-semibold text-expense">{review.preview?.errors ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-subink">Need guidance</p><p className="text-xl font-semibold text-ink">{review.preview?.needs_guidance ?? 0}</p></Card>
      </div>
      {!!review.preview?.not_previewed && <Card className="p-4 mb-4 border border-amber-300 text-sm text-amber-800" role="alert">
        {review.preview.not_previewed} row(s) exceed the 3,000-row preview limit and will not be imported in this batch.
      </Card>}
      {undoResult?.failures?.length > 0 && <Card className="p-4 mb-4 border border-expense/30" role="alert">
        <p className="font-semibold text-expense">Undo incomplete — {undoResult.failures.length} row(s) were left untouched.</p>
        {undoResult.failures.map((item) => <p key={item.row_number} className="text-sm text-subink mt-1">Row {item.row_number}: {item.error}</p>)}
      </Card>}
      <Card className="overflow-hidden">
        <div className="p-5 border-b border-line flex flex-wrap gap-4 justify-between">
          <div>
            <div className="flex gap-2 items-center"><h2 className="font-display font-semibold text-ink">{review.provider} · {review.document_type}</h2><Badge tone="blue">{Math.round(review.document_confidence * 100)}% detected</Badge></div>
            <p className="text-xs text-subink mt-1">{review.total_rows} rows · {review.filename} · duplicates and invalid rows are excluded by default.</p>
          </div>
          {review.committed
            ? <div className="flex flex-wrap items-center gap-2">
                <Badge tone={review.committed.status === "UNDONE" ? "blue" : review.committed.status === "UNDO_PARTIAL" ? "amber" : "green"}>
                  <CheckCircle2 size={13}/> {review.committed.status === "UNDONE" ? "Batch undone" : `${review.committed.created + review.committed.consolidated} applied`}
                </Badge>
                {canUndo && <Button variant="secondary" onClick={undo} disabled={busy}><Undo2 size={15}/>{busy ? "Undoing…" : "Undo batch"}</Button>}
              </div>
            : <div className="flex gap-2 items-end">
                <Field label="Owner"><Select value={owner} onChange={(event) => setOwner(event.target.value)}><option>Self</option><option>Family</option><option>Farm / business</option></Select></Field>
                <Button onClick={commit} disabled={busy || !selected.size}><ShieldCheck size={15}/> Apply {selected.size} approved rows</Button>
              </div>}
        </div>
        {review.notice && <p className="px-5 py-3 text-xs text-subink bg-muted/30">{review.notice}</p>}
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-muted/60 overline text-faint"><tr><th className="p-3 text-left">Apply</th><th className="p-3 text-left">Detected</th><th className="p-3 text-left">Record</th><th className="p-3 text-right">Value / P&L</th><th className="p-3 text-left">Preview change / issues</th></tr></thead>
          <tbody>{review.candidates.map((row) => {
            const disabled = !!review.committed || !row.can_apply || row.kind === "NEEDS_GUIDANCE" || row.duplicate;
            return <tr key={row.row_number} className="border-t border-line">
              <td className="p-3"><input aria-label={`Apply row ${row.row_number}`} type="checkbox" disabled={disabled} checked={selected.has(row.row_number)} onChange={() => toggle(row.row_number)}/></td>
              <td className="p-3"><Badge tone={row.duplicate || row.kind === "NEEDS_GUIDANCE" || row.errors?.length ? "amber" : row.kind === "HISTORICAL_PNL" ? "blue" : "green"}>{row.duplicate ? "Likely duplicate" : row.errors?.length ? "Has errors" : row.kind.replace("_", " ")}</Badge></td>
              <td className="p-3 font-medium text-ink">{row.name}</td>
              <td className="p-3 text-right num">{inr(row.amount ?? row.current_value)}</td>
              <td className="p-3 text-xs text-subink">
                <span>{row.planned_change || row.reason} · {Math.round(row.confidence * 100)}% confidence</span>
                {row.duplicate_reason && <p className="mt-1 text-amber-700"><AlertTriangle size={12} className="inline mr-1"/>{row.duplicate_reason}</p>}
                {row.errors?.map((message) => <p key={message} className="mt-1 text-expense">{message}</p>)}
              </td>
            </tr>;
          })}</tbody>
        </table></div>
      </Card>
    </>}
  </>;
}
