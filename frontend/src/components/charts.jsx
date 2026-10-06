import React from "react";
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { inr, fmtMonth } from "../lib/format";
import { Card } from "./ui";

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);
export const PALETTE = ["#05A66C", "#4B5BE5", "#FFD34D", "#73819A", "#A980E9", "#FF9472", "#31B9E9", "#12B981"];

const grid = { color: "rgba(178, 191, 220, .38)", drawBorder: false };
const axis = { color: "#8591AA", font: { family: "Manrope", size: 10, weight: "600" }, padding: 8 };
const tooltip = { backgroundColor: "rgba(24, 34, 58, .94)", titleColor: "#fff", bodyColor: "#dfe6ff", padding: 11, cornerRadius: 10, displayColors: true, boxPadding: 4, titleFont: { family: "Manrope", weight: "700" }, bodyFont: { family: "Manrope" }, callbacks: { label: (item) => `${item.dataset.label || item.label}: ${inr(item.raw)}` } };
function gradient(context, from, to) { const { chart, chartArea } = context; if (!chartArea) return from; const fill = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom); fill.addColorStop(0, from); fill.addColorStop(1, to); return fill; }
function amountAxis() { return { ticks: { ...axis, callback: (v) => inr(v, { compact: true }), maxTicksLimit: 5 }, grid, border: { display: false } }; }

function AccessibleChartData({ title, labels, series }) {
  return <table className="sr-only">
    <caption>{title} data</caption>
    <thead><tr><th scope="col">Period or category</th>{series.map((item) => <th scope="col" key={item.name}>{item.name}</th>)}</tr></thead>
    <tbody>{labels.map((label, index) => <tr key={`${label}-${index}`}><th scope="row">{label}</th>{series.map((item) => <td key={item.name}>{inr(item.values[index] || 0)}</td>)}</tr>)}</tbody>
  </table>;
}

export function ChartCard({ title, subtitle, children, right, className, height = 260, testid }) {
  return <Card className={`chart-card p-5 sm:p-6 ${className || ""}`} data-testid={testid}><div className="chart-card__heading flex items-start justify-between gap-4 mb-4"><div className="min-w-0"><h3 className="font-display font-semibold text-lg text-ink">{title}</h3>{subtitle && <p className="text-xs text-subink mt-0.5">{subtitle}</p>}</div>{right && <div className="shrink-0">{right}</div>}</div><div className="chart-card__body" style={{ width: "100%", height }}>{children}</div></Card>;
}

function ChartEmptyState({ message = "No data available for this view yet" }) {
  return <div className="chart-empty" role="status"><span className="chart-empty__glyph">∿</span><span>{message}</span></div>;
}

export function CashFlowArea({ data, xKey = "month", monthLabels = true }) {
  if (!data?.length) return <ChartEmptyState message="No cash-flow history recorded yet" />;
  const labels = data.map((d) => monthLabels ? fmtMonth(d[xKey]) : d[xKey]);
  const income = data.map((d) => d.in);
  const expenses = data.map((d) => d.out);
  const summary = `Cash flow chart for ${labels.length} periods. Income and money out are shown for each period. Detailed values are available in the following table.`;
  return <><Line role="img" aria-label={summary} data={{ labels, datasets: [{ label: "Money in", data: income, borderColor: "#05A66C", backgroundColor: (c) => gradient(c, "rgba(5,166,108,.28)", "rgba(5,166,108,0)"), fill: true, tension: .42, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2.5 }, { label: "Money out", data: expenses, borderColor: "#F08072", backgroundColor: (c) => gradient(c, "rgba(240,128,114,.20)", "rgba(240,128,114,0)"), fill: true, tension: .42, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2.5 }] }} options={{ responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: "index" }, plugins: { legend: { position: "top", align: "end", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, font: { family: "Manrope", size: 11 } } }, tooltip }, scales: { x: { ticks: axis, grid: { display: false }, border: { display: false } }, y: amountAxis() } }} /><AccessibleChartData title="Cash flow" labels={labels} series={[{ name: "Income", values: income }, { name: "Expenses", values: expenses }]} /></>;
}

export function TrendLine({ data, xKey = "month", yKey = "value", name = "Value", color = "#4B5BE5", monthLabels = true }) {
  if (!data?.length) return <ChartEmptyState message="No history recorded for this view yet" />;
  const labels = data.map((d) => monthLabels ? fmtMonth(d[xKey]) : d[xKey]);
  const values = data.map((d) => d[yKey]);
  const summary = `${name} trend with ${labels.length} recorded ${labels.length === 1 ? "period" : "periods"}. Detailed values are available in the following table.`;
  return <><Line role="img" aria-label={summary} data={{ labels, datasets: [{ label: name, data: values, borderColor: color, backgroundColor: (c) => gradient(c, "rgba(75,91,229,.30)", "rgba(75,91,229,.015)"), fill: true, tension: .42, pointRadius: data.length === 1 ? 4 : 0, pointHoverRadius: 5, pointHoverBackgroundColor: "#fff", pointHoverBorderWidth: 3, borderWidth: 3 }] }} options={{ responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: "index" }, plugins: { legend: { display: false }, tooltip }, scales: { x: { ticks: { ...axis, maxTicksLimit: 5 }, grid: { display: false }, border: { display: false } }, y: { ...amountAxis(), display: false } } }} /><AccessibleChartData title={name} labels={labels} series={[{ name, values }]} /></>;
}

export function Bars({ data, xKey = "name", series = [{ key: "value", name: "Value", color: "#4B5BE5" }], monthLabels = false, stacked = false }) {
  if (!data?.length) return <ChartEmptyState message="No records available to chart yet" />;
  const labels = data.map((d) => monthLabels ? fmtMonth(d[xKey]) : d[xKey]);
  const accessibleSeries = series.map((s) => ({ name: s.name, values: data.map((d) => d[s.key]) }));
  const summary = `Bar chart with ${labels.length} categories and ${series.map((item) => item.name).join(" and ")}. Detailed values are available in the following table.`;
  return <><Bar role="img" aria-label={summary} data={{ labels, datasets: series.map((s) => ({ label: s.name, data: data.map((d) => d[s.key]), backgroundColor: s.color, borderRadius: 5, borderSkipped: false, maxBarThickness: 22, barPercentage: .72, categoryPercentage: .72 })) }} options={{ responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: "index" }, plugins: { legend: series.length > 1 ? { position: "top", align: "end", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, font: { family: "Manrope", size: 11 } } } : { display: false }, tooltip }, scales: { x: { stacked, ticks: { ...axis, maxTicksLimit: 6 }, grid: { display: false }, border: { display: false } }, y: { ...amountAxis(), stacked } } }} /><AccessibleChartData title="Bar chart" labels={labels} series={accessibleSeries} /></>;
}

export function Donut({ data, centerLabel, centerValue }) {
  if (!data?.length) return <ChartEmptyState message="No allocation recorded yet" />;
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
  const labels = data.map((d) => d.name);
  const values = data.map((d) => d.value);
  const summary = `Allocation chart with ${data.map((item) => `${item.name}, ${inr(item.value)}`).join("; ")}.`;
  return <><div className="relative h-full w-full"><Doughnut role="img" aria-label={summary} data={{ labels, datasets: [{ data: values, backgroundColor: data.map((_, i) => PALETTE[i % PALETTE.length]), borderColor: "#fff", borderWidth: 3, spacing: 1, hoverOffset: 5 }] }} options={{ responsive: true, maintainAspectRatio: false, cutout: "65%", plugins: { legend: { display: false }, tooltip } }} /><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="overline text-faint text-[9px]">{centerLabel}</span><span className="num font-bold text-lg text-ink">{centerValue != null ? centerValue : inr(total, { compact: true })}</span></div></div><AccessibleChartData title="Allocation" labels={labels} series={[{ name: "Amount", values }]} /></>;
}

export function Legendish({ data }) {
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
  return <div className="allocation-legend">{data.map((d, i) => { const share = total ? Math.round(d.value / total * 100) : 0; return <div className="allocation-legend__item" key={d.name || i}><div className="flex items-center justify-between gap-2 text-xs"><span className="flex min-w-0 items-center gap-2 text-subink font-semibold"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="truncate">{d.name}</span></span><span className="num shrink-0 font-bold text-ink">{inr(d.value, { compact: true })} <span className="font-sans text-[10px] text-subink">{share}%</span></span></div><div className="h-1.5 rounded-full bg-[#e8eef8] mt-1.5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${total ? Math.max(4, d.value / total * 100) : 0}%`, background: PALETTE[i % PALETTE.length] }} /></div></div>; })}</div>;
}
