import React, { useState } from "react";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Eye, EyeOff, Handshake, LockKeyhole, Mail, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

const features = [
  ["See your whole picture", "Balances, spending and net worth in one view.", TrendingUp],
  ["Move projects forward", "Track construction, bills and supporting documents.", Handshake],
  ["Plan with confidence", "Keep goals, loans and upcoming commitments clear.", Sparkles],
  ["Keep control", "Private access for you and the people you trust.", ShieldCheck],
];

function BrandMark() {
  return <div className="login-brand-lockup" aria-label="Nivara Finance — Build, Manage, Grow">
    <span className="login-brand-mark-wrap"><img src="/brand/nivara-logo-mark.png" alt="" className="login-brand-mark" /></span>
    <span className="login-brand-type"><span className="login-brand-type__name">NIVARA <strong>FINANCE</strong></span><span className="login-brand-type__tagline">BUILD <i /> MANAGE <i /> GROW</span></span>
  </div>;
}

function FinanceVisual() {
  return <div className="login-visual" aria-hidden="true"><div className="login-status"><span /> YOUR FINANCIAL SPACE</div><svg viewBox="0 0 360 210" role="presentation"><defs><linearGradient id="barGlow" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#59e8ff"/><stop offset="1" stopColor="#8a5cff"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g className="visual-grid"><path d="M40 165H318M40 132H318M40 99H318M40 66H318"/><path d="M70 42V174M116 42V174M162 42V174M208 42V174M254 42V174"/></g><g className="visual-bars" filter="url(#glow)"><rect x="68" y="112" width="15" height="52" rx="3"/><rect x="94" y="84" width="15" height="80" rx="3"/><rect x="120" y="101" width="15" height="63" rx="3"/><rect x="146" y="60" width="15" height="104" rx="3"/></g><g className="visual-pie" filter="url(#glow)"><circle cx="244" cy="99" r="39" fill="none" stroke="#5be9ff" strokeWidth="13" strokeDasharray="140 105" transform="rotate(-35 244 99)"/><circle cx="244" cy="99" r="39" fill="none" stroke="#a156ff" strokeWidth="13" strokeDasharray="57 188" strokeDashoffset="-148" transform="rotate(-35 244 99)"/></g><path className="visual-line" d="M51 151 C76 145,88 120,109 126 S144 152,162 111 S198 71,214 101 S242 140,270 99 S302 83,319 70"/><circle className="visual-dot" cx="319" cy="70" r="5"/></svg><div className="visual-floor" /></div>;
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submit = async (event) => { event.preventDefault(); setError(""); setLoading(true); const result = await login(email.trim(), password); setLoading(false); if (!result.ok) setError(result.error); };

  return <div className="login-shell min-h-screen text-white"><div className="login-shell__grid" />
    <div className="login-frame relative z-10 min-h-screen max-w-[1500px] mx-auto px-5 sm:px-8 lg:px-14 py-5 sm:py-7 flex flex-col">
      <header className="login-topbar">
        <BrandMark />
        <div className="login-topbar__meta"><span className="login-live-dot" /> PRIVATE FINANCIAL WORKSPACE</div>
      </header>
      <div className="login-layout flex-1 grid lg:grid-cols-[1.15fr_.85fr] items-center gap-10 lg:gap-20 py-8 lg:py-10">
        <section className="login-story">
          <FinanceVisual />
          <div className="login-story__copy">
            <p className="login-eyebrow"><Sparkles size={13} /> FINANCIAL CLARITY, BUILT AROUND YOU</p>
            <h1>Make confident moves with your money.</h1>
            <p className="login-story__description">One calm, connected space for your household finances, long-term plans and the projects you’re building.</p>
            <div className="login-features">{features.map(([title, detail, Icon]) => <div key={title} className="login-feature"><span className="login-feature-icon"><Icon size={16} /></span><div><h2>{title}</h2><p>{detail}</p></div></div>)}</div>
          </div>
        </section>
        <section className="login-panel w-full max-w-[440px] lg:justify-self-end p-6 sm:p-8">
          <div className="login-panel__topline"><span className="login-panel__spark"><Sparkles size={14} /></span><span>YOUR MONEY, IN GOOD ORDER</span><span className="login-panel__line" /></div>
          <h2>Welcome back<span>.</span></h2>
          <p className="login-panel__intro">Sign in to pick up where you left off.</p>
          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block"><span className="login-label">Email address</span><span className="login-input-wrap"><Mail size={16} aria-hidden="true" /><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" data-testid="login-email" required /></span></label>
            <label className="block"><span className="login-label">Password</span><span className="login-input-wrap"><LockKeyhole size={16} aria-hidden="true" /><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" data-testid="login-password" required /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span><span className="login-help">Can’t sign in? Contact your workspace administrator.</span></label>
            {error && <div className="login-error" role="alert" data-testid="login-error">{error === "Network Error" ? "We couldn’t reach your workspace. Check your connection and try again." : error}</div>}
            <button type="submit" disabled={loading} data-testid="login-submit" className="login-submit">{loading ? <><span className="login-submit__spinner" />Signing in securely…</> : <>Sign in <ArrowRight size={16} /></>}</button>
          </form>
          <p className="login-security"><LockKeyhole size={13} /> Your financial information stays private and protected.</p>
          <div className="login-divider"><span>NEW TO NIVARA?</span></div>
          <button type="button" onClick={() => navigate("/sitewalkthrough")} className="login-demo-link">Explore the interactive demo <ArrowRight size={15} /></button>
          <div className="login-assurance"><Check size={13} /> Sample workspace available without signing in</div>
        </section>
      </div>
      <footer className="login-footer"><span>© {new Date().getFullYear()} Nivara Finance</span><span>Built for clearer decisions, one day at a time.</span></footer>
    </div>
  </div>;
}
