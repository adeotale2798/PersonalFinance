export function inr(n, opts = {}) {
  const v = Number(n || 0);
  const { compact = false, decimals = 0 } = opts;
  const currency = localStorage.getItem("nivara_currency") || "INR";
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency} `;
  if (compact) {
    const abs = Math.abs(v);
    if (currency === "INR" && abs >= 1e7) return `${symbol}${(v / 1e7).toFixed(2)}Cr`;
    if (currency === "INR" && abs >= 1e5) return `${symbol}${(v / 1e5).toFixed(2)}L`;
    if (abs >= 1e3) return `${symbol}${(v / 1e3).toFixed(1)}K`;
  }
  return `${symbol}${v.toLocaleString(currency === "INR" ? "en-IN" : "en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d.length <= 10 ? d + "T00:00:00" : d);
  if (isNaN(dt)) return d;
  const format = localStorage.getItem("nivara_date_format") || "DD-MM-YYYY";
  const timezone = localStorage.getItem("nivara_timezone") || "Asia/Kolkata";
  const parts = d.length <= 10 ? { day: String(dt.getDate()).padStart(2, "0"), month: String(dt.getMonth() + 1).padStart(2, "0"), year: dt.getFullYear() } : Object.fromEntries(new Intl.DateTimeFormat("en", { timeZone: timezone, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(dt).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return format === "MM-DD-YYYY" ? `${parts.month}-${parts.day}-${parts.year}` : format === "YYYY-MM-DD" ? `${parts.year}-${parts.month}-${parts.day}` : `${parts.day}-${parts.month}-${parts.year}`;
}

export function fmtMonth(m) {
  if (!m) return "";
  if (/^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-");
    return new Date(y, mo - 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  }
  return m;
}

export function todayISO() {
  const timezone = localStorage.getItem("nivara_timezone") || "Asia/Kolkata";
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

export function isoDateInTimezone(date = new Date()) {
  const timezone = localStorage.getItem("nivara_timezone") || "Asia/Kolkata";
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch (_) {
    return date.toISOString().slice(0, 10);
  }
}

export function fmtDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  const timezone = localStorage.getItem("nivara_timezone") || "Asia/Kolkata";
  return `${fmtDate(d)} · ${new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  }).format(dt)}`;
}

export function indianNumber(value) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw || raw === "-" || raw === ".") return raw;
  const [whole, decimal] = raw.split(".");
  const parsed = Number(whole);
  if (!Number.isFinite(parsed)) return raw;
  const formatted = Math.abs(parsed).toLocaleString("en-IN");
  return `${whole.startsWith("-") ? "-" : ""}${formatted}${decimal !== undefined ? `.${decimal}` : ""}`;
}

export function moneyValue(value) {
  return String(value ?? "").replace(/,/g, "");
}

export function dateInputValue(value) {
  return value ? fmtDate(value) : "";
}

export function dateToISO(value) {
  const text = String(value || "").trim();
  if (!text) return text;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parts = text.split(/[-/]/).map((x) => x.trim());
  if (parts.length !== 3 || parts.some((x) => !/^\d+$/.test(x))) return text;
  const format = localStorage.getItem("nivara_date_format") || "DD-MM-YYYY";
  const [a, b, c] = parts;
  const [year, month, day] = format === "YYYY-MM-DD" ? [a, b, c] : format === "MM-DD-YYYY" ? [c, a, b] : [c, b, a];
  const iso = `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(iso) ? iso : text;
}
