import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Line, Legend } from "recharts";

const FONT_URL = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Cormorant+Garamond:wght@500;600;700&display=swap";
const ACCESS_PASSWORD = "libertypointefinancial";

const P = {
  bg:"#07080f",card:"#0f1219",card2:"#0c0e17",border:"#1a2236",borderL:"#242a3d",
  em:"#10b981",emD:"rgba(16,185,129,0.07)",go:"#f59e0b",goD:"rgba(245,158,11,0.07)",
  cy:"#06b6d4",cyD:"rgba(6,182,212,0.07)",vi:"#8b5cf6",viD:"rgba(139,92,246,0.07)",
  ro:"#f43f5e",roD:"rgba(244,63,94,0.05)",sk:"#38bdf8",wh:"#fff",
  tx:"#e2e8f0",dm:"#8492a6",mt:"#4a5568",
};
const SC = [P.em, P.cy, P.go, P.vi];
const SPREADS = [1, 2, 3, 4];
const fmt = n => "$" + Math.round(n || 0).toLocaleString("en-US");
const fmtK = v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v}`;

function PasswordGate({ onAuth }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [shake, setShake] = useState(false);
  const go = e => { e?.preventDefault(); if (pw.toLowerCase().trim() === ACCESS_PASSWORD) { sessionStorage.setItem("lpf_auth", "1"); onAuth() } else { setErr(true); setShake(true); setTimeout(() => setShake(false), 500) } };
  return (
    <div style={{ minHeight: "100vh", background: P.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 20, padding: "48px 40px", width: 380, textAlign: "center", animation: shake ? "shake 0.3s" : "none" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: P.em, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 8 }}>Liberty Pointe Financial</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color: P.tx, margin: "0 0 6px" }}>IUL Strategy Tool</h1>
        <p style={{ fontSize: 12, color: P.mt, marginBottom: 28 }}>Authorized access only</p>
        <input type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(false) }} onKeyDown={e => e.key === "Enter" && go(e)} placeholder="Enter access code" autoFocus
          style={{ width: "100%", background: P.bg, border: `1px solid ${err ? P.ro : P.border}`, borderRadius: 10, padding: "12px 16px", color: P.tx, fontSize: 14, fontWeight: 600, fontFamily: "'Plus Jakarta Sans'", outline: "none", textAlign: "center", letterSpacing: "0.1em", marginBottom: 12 }} />
        {err && <div style={{ fontSize: 12, color: P.ro, marginBottom: 8 }}>Invalid access code</div>}
        <button onClick={go} style={{ width: "100%", background: P.em, color: P.bg, border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "'Plus Jakarta Sans'" }}>Enter</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, prefix, suffix, type = "number", placeholder, half, step }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: half ? "0 0 calc(50% - 6px)" : "0 0 calc(33.33% - 8px)", minWidth: half ? 160 : 120 }}>
      <label style={{ fontSize: 9, fontWeight: 700, color: P.mt, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", background: P.bg, border: `1px solid ${P.border}`, borderRadius: 8, padding: "7px 10px", gap: 4 }}>
        {prefix && <span style={{ color: P.mt, fontSize: 12 }}>{prefix}</span>}
        <input type={type} value={value} onChange={e => onChange(type === "number" ? Number(e.target.value) : e.target.value)} placeholder={placeholder} step={step}
          style={{ background: "none", border: "none", outline: "none", color: P.tx, fontSize: 14, fontWeight: 700, width: "100%", textAlign: type === "text" ? "left" : "right", fontFamily: "'Plus Jakarta Sans'" }} />
        {suffix && <span style={{ color: P.mt, fontSize: 10, whiteSpace: "nowrap" }}>{suffix}</span>}
      </div>
    </div>
  );
}

function SetupScreen({ config, setConfig, onStart }) {
  const [showAdv, setShowAdv] = useState(false);
  const set = (k, v) => setConfig(c => ({ ...c, [k]: v }));
  const multiplier = config.grossMonthly && config.monthlyBudget ? Math.round(config.grossMonthly / config.monthlyBudget) : 5;
  const borrowBack = config.grossMonthly - config.monthlyBudget;

  return (
    <div style={{ minHeight: "100vh", background: P.bg, fontFamily: "'Plus Jakarta Sans',sans-serif", color: P.tx }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: P.em, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 6 }}>Liberty Pointe Financial</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700, margin: 0 }}>Presentation Setup</h1>
          <p style={{ fontSize: 12, color: P.dm, marginTop: 6 }}>Enter key numbers from your client's illustration</p>
        </div>

        <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: "22px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: P.em }} />
            <div style={{ fontSize: 11, fontWeight: 800, color: P.dm, textTransform: "uppercase", letterSpacing: "0.08em" }}>Client & Premium</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Field label="Client Name" value={config.clientName} onChange={v => set("clientName", v)} type="text" placeholder="First Last" half />
            <Field label="Age" value={config.age} onChange={v => set("age", v)} suffix="yrs" />
            <Field label="Monthly Budget (Net)" value={config.monthlyBudget} onChange={v => set("monthlyBudget", v)} prefix="$" suffix="/mo" />
            <Field label="Gross Premium (Yr 2+)" value={config.grossMonthly} onChange={v => set("grossMonthly", v)} prefix="$" suffix="/mo" />
            <Field label="Death Benefit / Face Amount" value={config.faceAmount} onChange={v => set("faceAmount", v)} prefix="$" half />
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, padding: "8px 12px", background: P.emD, borderRadius: 8, fontSize: 11, color: P.dm }}>
            <span>Leverage: <strong style={{ color: P.em }}>{multiplier}x</strong></span>
            <span>Borrow Back: <strong style={{ color: P.go }}>{fmt(borrowBack)}/mo</strong></span>
            <span>Annual Gross: <strong style={{ color: P.tx }}>{fmt(config.grossMonthly * 12)}</strong></span>
          </div>
        </div>

        <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: "22px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: P.go }} />
            <div style={{ fontSize: 11, fontWeight: 800, color: P.dm, textTransform: "uppercase", letterSpacing: "0.08em" }}>Rates & Projection</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Field label="Loan Rate (Fixed)" value={config.loanRate} onChange={v => set("loanRate", v)} suffix="%" step={0.25} />
            <Field label="Illustrated Credit Rate" value={config.illustratedRate} onChange={v => set("illustratedRate", v)} suffix="%" step={0.01} />
            <Field label="Projection Years" value={config.projYears} onChange={v => set("projYears", v)} suffix="yrs" />
          </div>
        </div>

        <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: "22px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: P.vi }} />
            <div style={{ fontSize: 11, fontWeight: 800, color: P.dm, textTransform: "uppercase", letterSpacing: "0.08em" }}>Living Benefits (from illustration)</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Field label="Terminal Illness" value={config.terminalAmt} onChange={v => set("terminalAmt", v)} prefix="$" />
            <Field label="Chronic Illness" value={config.chronicAmt} onChange={v => set("chronicAmt", v)} prefix="$" suffix="/mo" />
            <Field label="Critical Illness" value={config.criticalAmt} onChange={v => set("criticalAmt", v)} prefix="$" />
            <Field label="Critical Injury" value={config.injuryAmt} onChange={v => set("injuryAmt", v)} prefix="$" />
            <Field label="Alzheimer's" value={config.alzAmt} onChange={v => set("alzAmt", v)} prefix="$" />
          </div>
        </div>

        <button onClick={() => setShowAdv(!showAdv)} style={{ width: "100%", background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "12px", cursor: "pointer", color: P.dm, fontSize: 12, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'", marginBottom: 14, textAlign: "left" }}>
          {showAdv ? "▼" : "▶"} Advanced Details {!showAdv && <span style={{ color: P.mt, fontWeight: 400 }}>— optional</span>}
        </button>
        {showAdv && (
          <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: "22px", marginBottom: 14 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Field label="Carrier" value={config.carrier} onChange={v => set("carrier", v)} type="text" half />
              <Field label="Product" value={config.product} onChange={v => set("product", v)} type="text" half />
              <Field label="Gender" value={config.gender} onChange={v => set("gender", v)} type="text" />
              <Field label="Rate Class" value={config.rateClass} onChange={v => set("rateClass", v)} type="text" half />
              <Field label="DB Option" value={config.dbOption} onChange={v => set("dbOption", v)} type="text" />
              <Field label="Index Strategy" value={config.indexStrategy} onChange={v => set("indexStrategy", v)} type="text" half />
              <Field label="Index Cap" value={config.indexCap} onChange={v => set("indexCap", v)} suffix="%" step={0.25} />
              <Field label="Target Premium" value={config.targetPrem} onChange={v => set("targetPrem", v)} prefix="$" />
              <Field label="Max Non-MEC" value={config.maxNonMEC} onChange={v => set("maxNonMEC", v)} prefix="$" />
              <Field label="Income Jump Year" value={config.incomeJumpYear} onChange={v => set("incomeJumpYear", v)} suffix="yr" />
              <Field label="Cumulative Income" value={config.cumulativeIncome} onChange={v => set("cumulativeIncome", v)} prefix="$" />
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:10 }}>
   <button onClick={()=>{
     const p=new URLSearchParams({
       name:config.clientName||"Client", age:config.age, gender:config.gender,
       rateClass:config.rateClass, carrier:config.carrier, product:config.product,
       budget:config.monthlyBudget, gross:config.grossMonthly, face:config.faceAmount,
       loanRate:config.loanRate, creditRate:config.illustratedRate,
       terminal:config.terminalAmt, chronic:config.chronicAmt, critical:config.criticalAmt,
       injury:config.injuryAmt, alz:config.alzAmt
     });
     window.open("/iul-summary.html?"+p.toString(),"_blank");
   }} style={{ flex:1, background:P.card2, color:P.tx, border:"1px solid "+P.border, borderRadius:12, padding:"16px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Plus Jakarta Sans'" }}>📄 Generate Summary PDF</button>
   <button onClick={onStart} style={{ flex:2, background:P.em, color:P.bg, border:"none", borderRadius:12, padding:"16px", fontSize:16, fontWeight:800, cursor:"pointer", fontFamily:"'Plus Jakarta Sans'" }}>Start Presentation →</button>
 </div>
      </div>
    </div>
  );
}

/* ═══════ SIMULATION ═══════ */
function simulate(cfg) {
  const rows = [];
  const lr = cfg.loanRate / 100;
  const cr = cfg.illustratedRate / 100;
  const net1 = cfg.monthlyBudget * 12;
  const gross = cfg.grossMonthly * 12;
  const borrow = (cfg.grossMonthly - cfg.monthlyBudget) * 12;
  const jump = cfg.incomeJumpYear || 11;
  const clcr = (cfg.loanRate + 0.5) / 100;
  const chg = yr => yr === 1 ? 0.53 : yr <= 10 ? 0.19 + yr * 0.003 : 0.13 + yr * 0.002;
  let av = 0, lb = 0;
  for (let yr = 1; yr <= cfg.projYears; yr++) {
    const prem = yr === 1 ? net1 : gross;
    const inc = yr === 1 ? 0 : yr < jump ? borrow : gross;
    const np = prem * (1 - chg(yr));
    const nla = Math.max(0, av - lb);
    const la = Math.min(av, lb);
    av = av + np + nla * cr + la * clcr;
    if (yr >= 2) lb = lb * (1 + lr) + inc;
    const sc = yr <= 10 ? av * Math.max(0, (10 - yr) / 10 * 0.04) : 0;
    const csv = Math.max(0, av - lb - sc);
    const db = Math.max(cfg.faceAmount, cfg.faceAmount + av - lb);
    rows.push({ yr, age: cfg.age + yr - 1, prem, inc, aLoan: lb, av, csv, db, w: cfg.illustratedRate });
  }
  return rows;
}

/* ═══════ SHARED ═══════ */
function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (<div style={{ background: P.card, border: `1px solid ${P.borderL}`, borderRadius: 10, padding: "10px 14px", boxShadow: "0 12px 40px rgba(0,0,0,0.8)", fontSize: 11, fontFamily: "'Plus Jakarta Sans'" }}>
    <div style={{ fontWeight: 800, color: P.tx, marginBottom: 6 }}>Year {label}</div>
    {payload.filter(p => p.value != null && Math.abs(p.value) > 0).map((p, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 20, color: p.color, marginBottom: 2 }}><span>{p.name}</span><span style={{ fontWeight: 700 }}>{fmt(p.value)}</span></div>))}
  </div>);
}
function Pillar({ icon, title, desc, color }) { return (<div style={{ background: `${color}08`, border: `1px solid ${color}20`, borderRadius: 14, padding: "20px 18px", textAlign: "center", flex: 1, minWidth: 150 }}><div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div><div style={{ fontSize: 15, fontWeight: 800, color, marginBottom: 6 }}>{title}</div><div style={{ fontSize: 12, color: P.dm, lineHeight: 1.6 }}>{desc}</div></div>) }
function BenefitCard({ icon, title, value, sub, color }) { return (<div style={{ background: `${color}06`, border: `1px solid ${color}18`, borderRadius: 12, padding: "16px", position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", top: -10, right: -10, fontSize: 50, opacity: 0.06 }}>{icon}</div><div style={{ fontSize: 11, color: P.dm, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{title}</div><div style={{ fontSize: 22, fontWeight: 800, color, marginBottom: 4 }}>{value}</div><div style={{ fontSize: 11, color: P.mt }}>{sub}</div></div>) }
function CompareRow({ label, standard, hyper, highlight }) { return (<div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 8, padding: "10px 0", borderBottom: `1px solid ${P.border}` }}><div style={{ fontSize: 13, color: P.dm, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 14, color: P.ro, fontWeight: 700, textAlign: "center" }}>{standard}</div><div style={{ fontSize: 14, color: highlight || P.em, fontWeight: 800, textAlign: "center" }}>{hyper}</div></div>) }

/* ═══════ PITCH DECK ═══════ */
function PitchDeck({ config: c, onSetup }) {
  const [slide, setSlide] = useState(0);
  const [wr, setWr] = useState(5.0);
  const SL = ["The Foundation", "Living Benefits", "Why Banks Do It", "Be Your Own Bank", "5x for 1/5th", "The Spread", "Your Policy", "The Close"];
  const ledger = useMemo(() => simulate(c), [c]);
  const mult = Math.round(c.grossMonthly / c.monthlyBudget);
  const bb = c.grossMonthly - c.monthlyBudget;
  const sf = 1 / mult;

  const sd = useMemo(() => {
    let g = [0, 0, 0, 0];
    return ledger.map(d => {
      const ng = SPREADS.map((sp, i) => { const a = (sp - 0.5) / 100; return g[i] * (1 + c.illustratedRate / 100) + (d.aLoan || 0) * a });
      g = ng;
      const r = { year: d.yr, age: d.age, carrierCSV: d.csv, carrierAV: d.av, carrierLoan: d.aLoan, carrierDB: d.db };
      SPREADS.forEach((sp, i) => { r[`csv${i}`] = d.csv + ng[i]; r[`gain${i}`] = ng[i]; r[`inc${i}`] = ng[i] * (wr / 100) });
      return r;
    });
  }, [ledger, c, wr]);

  const f = sd[sd.length - 1] || {};
  const prev = () => setSlide(s => Math.max(0, s - 1));
  const next = () => setSlide(s => Math.min(SL.length - 1, s + 1));

  return (
    <div style={{ minHeight: "100vh", background: P.bg, color: P.tx, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, padding: "8px 0", borderBottom: `1px solid ${P.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: P.em, letterSpacing: "0.15em", textTransform: "uppercase" }}>Liberty Pointe</div>
            <div style={{ fontSize: 10, color: P.mt }}>|</div>
            <div style={{ fontSize: 10, color: P.cy, fontWeight: 700 }}>{c.clientName}</div>
            <button onClick={onSetup} style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 5, padding: "2px 8px", cursor: "pointer", fontSize: 9, color: P.dm, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'" }}>✎ Edit</button>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {SL.map((s, i) => (<button key={i} onClick={() => setSlide(i)} style={{ width: i === slide ? "auto" : 7, height: 7, borderRadius: i === slide ? 8 : 4, background: i === slide ? P.em : i < slide ? `${P.em}60` : P.border, border: "none", cursor: "pointer", padding: i === slide ? "0 8px" : 0, color: P.wh, fontSize: 8, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'", transition: "all 0.3s" }}>{i === slide ? s : ""}</button>))}
          </div>
          <div style={{ fontSize: 10, color: P.mt }}>{slide + 1}/{SL.length}</div>
        </div>

        <div className="slide-content" key={slide}>

        {slide === 0 && (<div><div style={{ textAlign: "center", marginBottom: 30 }}><h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 34, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>What if your life insurance<br />could do <span style={{ color: P.em }}>everything?</span></h1><p style={{ fontSize: 14, color: P.dm, marginTop: 10 }}>Indexed Universal Life — four powerful pillars in one product.</p></div><div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><Pillar icon="📈" title="Tax-Deferred Growth" desc="Cash value linked to index performance with a 0% floor — no market losses." color={P.em} /><Pillar icon="💧" title="Liquidity" desc="Access cash value anytime — no penalties, no 59½ restriction." color={P.cy} /><Pillar icon="🛡️" title="Living Benefits" desc="Access death benefit while alive for terminal, chronic, or critical illness." color={P.go} /><Pillar icon="💰" title="Tax-Free Income" desc="Distributions via policy loans are tax-free — not deferred, FREE." color={P.vi} /></div></div>)}

        {slide === 1 && (<div><div style={{ textAlign: "center", marginBottom: 24 }}><h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700 }}>Life Insurance <span style={{ color: P.em }}>You Don't Have to Die</span> to Use</h1><p style={{ fontSize: 13, color: P.dm, marginTop: 6 }}>{c.clientName}'s projected accelerated benefits</p></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}><BenefitCard icon="🏥" title="Terminal Illness" value={fmt(c.terminalAmt)} sub="Lump sum — 24 months or less" color={P.ro} /><BenefitCard icon="🩺" title="Chronic Illness" value={`${fmt(c.chronicAmt)}/mo`} sub="Unable to perform 2+ ADLs" color={P.go} /><BenefitCard icon="❤️" title="Critical Illness" value={`Up to ${fmt(c.criticalAmt)}`} sub="Heart attack, stroke, cancer, ALS" color={P.vi} /><BenefitCard icon="⚡" title="Critical Injury" value={`Up to ${fmt(c.injuryAmt)}`} sub="Coma, paralysis, severe burns, TBI" color={P.cy} /><BenefitCard icon="🧠" title="Alzheimer's" value={fmt(c.alzAmt)} sub="Qualifying dementia diagnosis" color={P.em} /></div><div style={{ background: P.emD, border: `1px solid ${P.em}20`, borderRadius: 12, padding: "14px 18px", marginTop: 16, textAlign: "center" }}><div style={{ fontSize: 13, color: P.dm, lineHeight: 1.7 }}>All at <strong style={{ color: P.em }}>no additional premium</strong>. With our strategy, benefits are <strong style={{ color: P.go }}>{mult}x larger</strong> than standard.</div></div></div>)}

        {slide === 2 && (<div><div style={{ textAlign: "center", marginBottom: 24 }}><h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700 }}>Why do <span style={{ color: P.go }}>banks</span> buy billions in life insurance?</h1></div><div style={{ background: P.goD, border: `1px solid ${P.go}20`, borderRadius: 14, padding: "20px 24px", marginBottom: 16 }}><div style={{ fontSize: 14, color: P.dm, lineHeight: 1.8 }}>U.S. banks hold over <strong style={{ color: P.go }}>$204.8 billion</strong> in BOLI. They borrow at one rate, fund contracts that credit higher, and pocket the spread.</div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>{[["Bank of America", "$24.3B"], ["Wells Fargo", "$18.4B"], ["JPMorgan Chase", "$12.6B"]].map(([n, a], i) => (<div key={i} style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px", textAlign: "center" }}><div style={{ fontSize: 11, color: P.mt, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{n}</div><div style={{ fontSize: 24, fontWeight: 800, color: P.go }}>{a}</div></div>))}</div><div style={{ textAlign: "center", fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: P.em }}>Why can't you do the same thing?</div></div>)}

        {slide === 3 && (<div><div style={{ textAlign: "center", marginBottom: 24 }}><h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700 }}><span style={{ color: P.em }}>Be Your Own Bank</span></h1></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}><div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: "20px", textAlign: "center" }}><div style={{ fontSize: 12, color: P.mt, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Step 1 — Year 1</div><div style={{ fontSize: 36, fontWeight: 800, color: P.em }}>{fmt(c.monthlyBudget)}</div><div style={{ fontSize: 12, color: P.dm, marginTop: 4 }}>per month</div></div><div style={{ background: P.card, border: `1px solid ${P.cy}20`, borderRadius: 14, padding: "20px", textAlign: "center" }}><div style={{ fontSize: 12, color: P.mt, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Step 2 — Year 2+</div><div style={{ fontSize: 36, fontWeight: 800, color: P.cy }}>{fmt(c.grossMonthly)}</div><div style={{ fontSize: 12, color: P.dm, marginTop: 4 }}>contribute monthly</div><div style={{ fontSize: 20, marginTop: 6 }}>↓</div><div style={{ fontSize: 12, color: P.dm }}>borrow back <strong style={{ color: P.go }}>{fmt(bb)}</strong></div></div><div style={{ background: P.card, border: `1px solid ${P.go}20`, borderRadius: 14, padding: "20px", textAlign: "center" }}><div style={{ fontSize: 12, color: P.mt, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Result</div><div style={{ fontSize: 36, fontWeight: 800, color: P.go }}>{mult}x</div><div style={{ fontSize: 12, color: P.dm, marginTop: 4 }}>Net: <strong style={{ color: P.em }}>{fmt(c.monthlyBudget)}/mo</strong></div></div></div><div style={{ background: P.emD, border: `1px solid ${P.em}18`, borderRadius: 14, padding: "16px 20px" }}><div style={{ fontSize: 13, color: P.dm, lineHeight: 1.8 }}><strong style={{ color: P.em }}>The key:</strong> Index crediting on the full <strong style={{ color: P.tx }}>{fmt(c.grossMonthly)}</strong>. Loan: <strong style={{ color: P.tx }}>{c.loanRate}%</strong> fixed. <strong style={{ color: P.tx }}>No payments, no default.</strong></div></div></div>)}

        {slide === 4 && (<div><div style={{ textAlign: "center", marginBottom: 24 }}><h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700 }}><span style={{ color: P.go }}>{mult}x the Benefits.</span> Same Budget.</h1></div><div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: "20px 24px" }}><div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 8, padding: "10px 0", borderBottom: `2px solid ${P.border}` }}><div /><div style={{ fontSize: 12, color: P.ro, fontWeight: 800, textAlign: "center", textTransform: "uppercase" }}>Standard {fmt(c.monthlyBudget)}/mo</div><div style={{ fontSize: 12, color: P.em, fontWeight: 800, textAlign: "center", textTransform: "uppercase" }}>Hyper-Funded {fmt(c.monthlyBudget)}/mo</div></div><CompareRow label="Monthly Out-of-Pocket" standard={fmt(c.monthlyBudget)} hyper={fmt(c.monthlyBudget)} /><CompareRow label="Gross Contribution" standard={fmt(c.monthlyBudget)} hyper={fmt(c.grossMonthly)} highlight={P.go} /><CompareRow label="Death Benefit" standard={`~${fmt(c.faceAmount * sf)}`} hyper={fmt(c.faceAmount)} highlight={P.go} /><CompareRow label="Terminal Illness" standard={`~${fmt(c.terminalAmt * sf)}`} hyper={fmt(c.terminalAmt)} /><CompareRow label="Critical Illness / Injury" standard={`~${fmt(c.criticalAmt * sf)}`} hyper={`Up to ${fmt(c.criticalAmt)}`} /><CompareRow label="Chronic Illness" standard={`~${fmt(c.chronicAmt * sf)}/mo`} hyper={`${fmt(c.chronicAmt)}/mo`} /><CompareRow label="Alzheimer's" standard={`~${fmt(c.alzAmt * sf)}`} hyper={fmt(c.alzAmt)} /><CompareRow label="Leverage" standard="1x" hyper={`${mult}x`} highlight={P.go} /><CompareRow label="Spread Opportunity" standard="None" hyper="1-4%+" highlight={P.go} /></div></div>)}

        {slide === 5 && (<div><div style={{ textAlign: "center", marginBottom: 16 }}><h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700 }}>The <span style={{ color: P.go }}>Spread</span></h1><p style={{ fontSize: 12, color: P.dm, marginTop: 4 }}>AG49-A restricts carriers to 0.5%. Here's 1-4%.</p></div><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>{SPREADS.map((sp, i) => (<div key={i} style={{ background: `${SC[i]}08`, border: `1px solid ${SC[i]}20`, borderRadius: 10, padding: "12px", textAlign: "center" }}><div style={{ fontSize: 10, color: P.dm, fontWeight: 700, textTransform: "uppercase" }}>{sp}% Spread</div><div style={{ fontSize: 22, fontWeight: 800, color: SC[i] }}>{fmt(f[`csv${i}`])}</div><div style={{ fontSize: 10, color: P.mt }}>+{fmt(f[`gain${i}`])}</div><div style={{ fontSize: 10, color: SC[i], fontWeight: 700, marginTop: 2 }}>{fmt(f[`inc${i}`])}/yr</div></div>))}</div><div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: "14px" }}><ResponsiveContainer width="100%" height={300}><AreaChart data={sd} margin={{ top: 5, right: 8, left: 8, bottom: 5 }}><defs>{SC.map((col, i) => <linearGradient key={i} id={`sg${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity={0.2} /><stop offset="100%" stopColor={col} stopOpacity={0} /></linearGradient>)}</defs><CartesianGrid strokeDasharray="3 3" stroke={P.border} /><XAxis dataKey="year" tick={{ fill: P.mt, fontSize: 10 }} axisLine={{ stroke: P.border }} tickLine={false} /><YAxis tick={{ fill: P.mt, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtK} /><Tooltip content={<Tip />} />{SPREADS.map((sp, i) => (<Area key={i} type="monotone" dataKey={`csv${i}`} name={`${sp}%`} stroke={SC[i]} fill={`url(#sg${i})`} strokeWidth={i === 2 ? 3 : 2} dot={false} />))}<Area type="monotone" dataKey="carrierCSV" name="Carrier (0.5%)" stroke={P.ro} fill="none" strokeWidth={2} strokeDasharray="6 3" dot={false} /><Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} /></AreaChart></ResponsiveContainer></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}><div style={{ display: "flex", flexDirection: "column", gap: 3 }}><label style={{ fontSize: 10, fontWeight: 700, color: P.mt, textTransform: "uppercase" }}>Withdrawal Rate</label><input type="number" value={wr} onChange={e => setWr(Number(e.target.value))} step={0.5} style={{ background: P.bg, border: `1px solid ${P.border}`, borderRadius: 7, padding: "5px 8px", color: P.tx, fontSize: 14, fontWeight: 700, textAlign: "right", fontFamily: "'Plus Jakarta Sans'", outline: "none" }} /></div><div style={{ display: "flex", flexDirection: "column", gap: 3 }}><label style={{ fontSize: 10, fontWeight: 700, color: P.mt, textTransform: "uppercase" }}>Carrier Spread (AG49-A)</label><div style={{ background: P.bg, border: `1px solid ${P.border}`, borderRadius: 7, padding: "5px 8px", color: P.ro, fontSize: 14, fontWeight: 700, textAlign: "right" }}>0.50%</div></div></div></div>)}

        {slide === 6 && (<div><div style={{ textAlign: "center", marginBottom: 20 }}><h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700 }}>{c.clientName}'s <span style={{ color: P.em }}>Policy</span></h1></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: "18px 20px" }}><div style={{ fontSize: 11, color: P.mt, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Details</div>{[["Carrier", c.carrier], ["Product", c.product], ["Insured", `${c.age} ${c.gender} ${c.rateClass}`], ["Face Amount", fmt(c.faceAmount)], ["DB Option", c.dbOption], ["Net Monthly", fmt(c.monthlyBudget) + "/mo"], ["Gross (Yr 2+)", fmt(c.grossMonthly) + "/mo"], ["Loan", `${c.loanType} @ ${c.loanRate}%`], ["Index", `${c.indexStrategy} @ ${c.illustratedRate}%`], ["Target Premium", fmt(c.targetPrem)]].map(([k, v], i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${P.border}` }}><span style={{ fontSize: 12, color: P.dm }}>{k}</span><span style={{ fontSize: 12, color: P.tx, fontWeight: 700 }}>{v}</span></div>))}</div><div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: "18px 20px" }}><div style={{ fontSize: 11, color: P.mt, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Projected Values</div><ResponsiveContainer width="100%" height={220}><ComposedChart data={sd} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke={P.border} /><XAxis dataKey="year" tick={{ fill: P.mt, fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: P.mt, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtK} /><Area type="monotone" dataKey="carrierAV" name="AV" stroke={P.cy} fill={P.cyD} strokeWidth={1.5} dot={false} /><Area type="monotone" dataKey="carrierLoan" name="Loan" stroke={P.go} fill={P.goD} strokeWidth={1.5} strokeDasharray="3 3" dot={false} /><Line type="monotone" dataKey="carrierCSV" name="CSV" stroke={P.em} strokeWidth={2} dot={false} /><Tooltip content={<Tip />} /></ComposedChart></ResponsiveContainer>{c.cumulativeIncome > 0 && <div style={{ textAlign: "center", fontSize: 11, color: P.dm, marginTop: 6 }}>Cumulative income: <strong style={{ color: P.em }}>{fmt(c.cumulativeIncome)}</strong> tax-free</div>}</div></div></div>)}

        {slide === 7 && (<div><div style={{ textAlign: "center", marginBottom: 30 }}><h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 700 }}><span style={{ color: P.em }}>The Bottom Line</span></h1></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}><div style={{ background: P.roD, border: `1px solid ${P.ro}20`, borderRadius: 14, padding: "24px", textAlign: "center" }}><div style={{ fontSize: 12, color: P.mt, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Without This Strategy</div><div style={{ fontSize: 11, color: P.dm, marginBottom: 10 }}>Standard IUL at {fmt(c.monthlyBudget)}/mo</div><div style={{ fontSize: 13, color: P.dm, marginBottom: 2 }}>Death Benefit</div><div style={{ fontSize: 28, fontWeight: 800, color: P.ro, marginBottom: 8 }}>~{fmt(c.faceAmount * sf)}</div><div style={{ fontSize: 13, color: P.dm, marginBottom: 2 }}>Living Benefits</div><div style={{ fontSize: 20, fontWeight: 800, color: P.ro, marginBottom: 8 }}>~{fmt(c.terminalAmt * sf)}</div><div style={{ fontSize: 13, color: P.dm, marginBottom: 2 }}>Spread</div><div style={{ fontSize: 20, fontWeight: 800, color: P.ro }}>None</div></div><div style={{ background: P.emD, border: `1px solid ${P.em}20`, borderRadius: 14, padding: "24px", textAlign: "center" }}><div style={{ fontSize: 12, color: P.mt, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>With Hyper-Funding</div><div style={{ fontSize: 11, color: P.dm, marginBottom: 10 }}>Same {fmt(c.monthlyBudget)}/mo</div><div style={{ fontSize: 13, color: P.dm, marginBottom: 2 }}>Death Benefit</div><div style={{ fontSize: 28, fontWeight: 800, color: P.em, marginBottom: 8 }}>{fmt(c.faceAmount)}</div><div style={{ fontSize: 13, color: P.dm, marginBottom: 2 }}>Living Benefits</div><div style={{ fontSize: 20, fontWeight: 800, color: P.em, marginBottom: 8 }}>{fmt(c.terminalAmt)}</div><div style={{ fontSize: 13, color: P.dm, marginBottom: 2 }}>Spread @ 3% (Yr {f.year})</div><div style={{ fontSize: 20, fontWeight: 800, color: P.go }}>+{fmt(f.gain2)}</div></div></div><div style={{ background: `linear-gradient(135deg,${P.em}10,${P.go}08)`, border: `1px solid ${P.em}25`, borderRadius: 14, padding: "24px 28px", textAlign: "center" }}><div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: P.tx, marginBottom: 12, lineHeight: 1.3 }}>Same wallet. {mult}x the protection.<br />Plus a compounding spread the carrier can't show you.</div><div style={{ fontSize: 14, color: P.dm, lineHeight: 1.8, maxWidth: 600, margin: "0 auto" }}>Banks have done this for decades. This gives you the same advantage — inside your own policy.</div></div></div>)}

        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, padding: "12px 0", borderTop: `1px solid ${P.border}` }}>
          <button onClick={prev} disabled={slide === 0} style={{ background: slide === 0 ? "transparent" : P.card, color: slide === 0 ? P.mt : P.tx, border: `1px solid ${P.border}`, borderRadius: 8, padding: "8px 20px", cursor: slide === 0 ? "default" : "pointer", fontWeight: 700, fontSize: 13, fontFamily: "'Plus Jakarta Sans'" }}>← Back</button>
          <div style={{ fontSize: 11, color: P.mt }}>{SL[slide]}</div>
          <button onClick={next} disabled={slide === SL.length - 1} style={{ background: slide === SL.length - 1 ? P.emD : P.em, color: slide === SL.length - 1 ? P.em : P.bg, border: "none", borderRadius: 8, padding: "8px 20px", cursor: slide === SL.length - 1 ? "default" : "pointer", fontWeight: 800, fontSize: 13, fontFamily: "'Plus Jakarta Sans'" }}>{slide === SL.length - 1 ? "✓ End" : "Next →"}</button>
        </div>
        <div style={{ fontSize: 8, color: P.mt, textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>For education and illustration purposes only. Not legal or tax advice. Spread scenarios are hypothetical. © {new Date().getFullYear()} Liberty Pointe Financial LLC</div>
      </div>
    </div>
  );
}

/* ═══════ ROOT ═══════ */
export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("lpf_auth") === "1");
  const [started, setStarted] = useState(false);
  const [config, setConfig] = useState({
    clientName: "", age: 45, gender: "Male", rateClass: "Preferred Non-Tobacco",
    monthlyBudget: 500, grossMonthly: 2500, faceAmount: 467000,
    loanRate: 5.0, illustratedRate: 6.84, projYears: 30,
    terminalAmt: 0, chronicAmt: 0, criticalAmt: 0, injuryAmt: 0, alzAmt: 0,
    carrier: "National Life Group / LSW", product: "FlexLife IUL", dbOption: "B (Increasing)",
    indexStrategy: "S&P 500 Cap Focus", indexCap: 11.0, loanType: "Participating Fixed",
    targetPrem: 0, maxNonMEC: 0, incomeJumpYear: 11, cumulativeIncome: 0,
  });

  return (
    <>
      <link href={FONT_URL} rel="stylesheet" />
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}.slide-content{animation:fadeIn 0.4s ease-out}@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}input[type=number]::-webkit-inner-spin-button{opacity:1}`}</style>
      {!authed ? <PasswordGate onAuth={() => setAuthed(true)} /> :
        !started ? <SetupScreen config={config} setConfig={setConfig} onStart={() => setStarted(true)} /> :
          <PitchDeck config={config} onSetup={() => setStarted(false)} />}
    </>
  );
}
