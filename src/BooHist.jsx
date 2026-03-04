/**
 * BOOHist — © 2026 Mabaso · For Joyce
 * https://boohist.com
 *
 * QUICK CONFIG — edit these objects to update the site without touching any other code.
 */

// ─── SPONSOR BLOCK ────────────────────────────────────────────────────────────
// Set active:true and fill fields to replace the rotating quote with a sponsor message.
// The quote block will be replaced entirely. URL is optional.
const SPONSOR = {
  active: false,
  text: "",
  attribution: "",
  url: "",
};

// ─── SUPPORT / DONATE BLOCK ───────────────────────────────────────────────────
// Update handle, url, and suggestedAmount to change the donation target.
const SUPPORT = {
  label: "Donate to support free users",
  platform: "Venmo",
  handle: "@fiddyfiddy",
  url: "https://venmo.com/fiddyfiddy",
  suggestedAmount: "$25",
};

// ─── PREMIUM CONFIG ───────────────────────────────────────────────────────────
// ADMIN_TAP_COUNT: number of times user taps copyright footer to open admin panel.
const ADMIN_TAP_COUNT = 5;

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import SEED_WORDS from './SEED_WORDS_BAKED.js';
// ─────────────────────────────────────────────────────────────────────────────
// DUAL STORAGE — tries window.storage (Claude artifact), falls back to
// localStorage (Vercel deployment). Same API either way.
// On boohist.com, all data persists on the user's device via localStorage.
// When you add Supabase later, replace these three functions only.
// ─────────────────────────────────────────────────────────────────────────────
const store = {
  async get(key) {
    try {
      if (typeof window.storage !== "undefined") {
        const r = await window.storage.get(key);
        return r ? r.value : null;
      }
    } catch {}
    try { return localStorage.getItem(key); } catch { return null; }
  },
  async set(key, value) {
    try {
      if (typeof window.storage !== "undefined") {
        await window.storage.set(key, value); return;
      }
    } catch {}
    try { localStorage.setItem(key, value); } catch {}
  },
  async delete(key) {
    try {
      if (typeof window.storage !== "undefined") {
        await window.storage.delete(key); return;
      }
    } catch {}
    try { localStorage.removeItem(key); } catch {}
  },
  async keys(prefix) {
    try {
      if (typeof window.storage !== "undefined") {
        const r = await window.storage.list(prefix);
        return r ? r.keys : [];
      }
    } catch {}
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      return keys;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BROWSER FINGERPRINT ENGINE
// Combines stable browser signals into a single hash. Not cryptographic —
// designed as a friction layer, not a lock. Supabase validation hooks in later
// by checking this fingerprint against the premium_requests table.
// ─────────────────────────────────────────────────────────────────────────────
async function generateFingerprint() {
  try {
    const signals = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      navigator.platform || "",
    ];

    // Canvas fingerprint
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("BOOHist🎯", 2, 15);
      ctx.fillStyle = "rgba(102,204,0,0.7)";
      ctx.fillText("BOOHist🎯", 4, 17);
      signals.push(canvas.toDataURL());
    } catch {}

    // WebGL renderer
    try {
      const gl = document.createElement("canvas").getContext("webgl");
      if (gl) {
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        if (ext) signals.push(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
      }
    } catch {}

    const raw = signals.join("|");
    // Simple djb2-style hash → hex string
    let h = 5381;
    for (let i = 0; i < raw.length; i++) {
      h = ((h << 5) + h) ^ raw.charCodeAt(i);
      h = h >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  } catch {
    return "fallback-" + Math.random().toString(36).slice(2, 10);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function checkPremiumStatus(fingerprint) {
  try {
    const raw = await store.get("premium_request:" + fingerprint);
    if (!raw) return false;
    const record = JSON.parse(raw);
    return record.status === "premium";
  } catch { return false; }
}

async function submitPremiumRequest(fingerprint, email, phone) {
  const record = {
    email: email.trim(),
    phone: phone.trim(),
    fingerprint,
    timestamp: new Date().toISOString(),
    status: "pending",  // flip to "premium" in admin panel to grant access
  };
  await store.set("premium_request:" + fingerprint, JSON.stringify(record));
  return record;
}

async function getAllPremiumRequests() {
  const keys = await store.keys("premium_request:");
  const records = [];
  for (const key of keys) {
    try {
      const raw = await store.get(key);
      if (raw) records.push(JSON.parse(raw));
    } catch {}
  }
  return records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

async function updatePremiumStatus(fingerprint, status) {
  const raw = await store.get("premium_request:" + fingerprint);
  if (!raw) return;
  const record = JSON.parse(raw);
  record.status = status;
  await store.set("premium_request:" + fingerprint, JSON.stringify(record));
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const ERAS = [
  "All Time","Prehistoric","Ancient Civilizations","Classical Antiquity",
  "Late Antiquity","Medieval Period","The Renaissance","Age of Exploration",
  "The Enlightenment","Industrial Revolution","Modern Era","Postwar Era","Digital Age",
];
const CATEGORIES = [
  "History","Science","Art","Music","Sports","Politics",
  "Literature","Finance","Technology","Film & TV","Geography",
  "Philosophy","Architecture","Fashion","Math",
];
const DIFFICULTIES = ["Easy","Medium","Hard","Expert"];
const TIMER_OPTIONS = [30,45,60,90,120];
const CARD_COUNTS = [3,5,8,10,15];
const PREMIUM_DIFFICULTIES = ["Hard","Expert"];

const ERA_COLORS = {
  "Prehistoric":"#9C7A4A","Ancient Civilizations":"#C17D3C","Classical Antiquity":"#8B7BAA",
  "Late Antiquity":"#6B8E76","Medieval Period":"#7A6B8A","The Renaissance":"#B5734A",
  "Age of Exploration":"#4A7B8A","The Enlightenment":"#8A8A4A","Industrial Revolution":"#6B7A8A",
  "Modern Era":"#8A4A4A","Postwar Era":"#4A6B8A","Digital Age":"#4A8A7A","All Time":"#C9A84C",
};

const QUOTES = [
  {text:"Man only plays when he is in the full sense of the word a man, and he is only completely a man when he plays.",author:"Friedrich Schiller",source:"Letters on the Aesthetic Education of Man (1795)"},
  {text:"The creation of something new is not accomplished by the intellect but by the play instinct acting from inner necessity.",author:"Carl Jung",source:"Psychological Types (1921)"},
  {text:"The opposite of play is not work—it is depression.",author:"Brian Sutton-Smith",source:"The Ambiguity of Play (1997)"},
  {text:"Play gives children a chance to practice what they are learning.",author:"Fred Rogers",source:"The World According to Mister Rogers (2003)"},
  {text:"Play is the work of the child.",author:"Maria Montessori",source:"Various lectures and writings"},
  {text:"In play, children learn how to learn.",author:"O. Fred Donaldson",source:"Playing by Heart (1978)"},
  {text:"The playing adult steps sideward into another reality.",author:"Johan Huizinga",source:"Homo Ludens (1938)"},
  {text:"Those who cannot remember the past are condemned to repeat it.",author:"George Santayana",source:"The Life of Reason (1905)"},
  {text:"We are not makers of history. We are made by history.",author:"Martin Luther King Jr.",source:"Sermon at Ebenezer Baptist Church (1963)"},
  {text:"History never looks like history when you are living through it.",author:"John W. Gardner",source:"No Easy Victories (1968)"},
  {text:"The farther backward you can look, the farther forward you are likely to see.",author:"Winston Churchill",source:"Speech to the Royal College of Physicians (1944)"},
  {text:"The very ink with which all history is written is merely fluid prejudice.",author:"Mark Twain",source:"Following the Equator (1897)"},
  {text:"A generation which ignores history has no past and no future.",author:"Robert A. Heinlein",source:"Time Enough for Love (1973)"},
  {text:"History is a vast early warning system.",author:"Norman Cousins",source:"Saturday Review (1967)"},
  {text:"Study the past if you would define the future.",author:"Confucius",source:"Traditional attribution"},
  {text:"Literacy is a bridge from misery to hope.",author:"Kofi Annan",source:"UN Literacy Day Message (1997)"},
  {text:"A reader lives a thousand lives before he dies. The man who never reads lives only one.",author:"George R. R. Martin",source:"A Dance with Dragons (2011)"},
  {text:"Once you learn to read, you will be forever free.",author:"Frederick Douglass",source:"Attributed in later collections"},
  {text:"Reading is to the mind what exercise is to the body.",author:"Joseph Addison",source:"The Spectator (1711)"},
  {text:"The ability to read awoke inside of me some long dormant craving to be mentally alive.",author:"Malcolm X",source:"The Autobiography of Malcolm X (1965)"},
];

function getDailyDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function seededRng(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  return () => { h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b); h ^= h >>> 16; return (h >>> 0) / 0xffffffff; };
}
function getDailyPool() {
  const rng = seededRng(getDailyDateStr());
  return [...SEED_WORDS].sort(() => rng() - 0.5).slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// DECOY SELECTION
// Tier 1: same era AND same category  (closest — lower 1/3 of BOOword distance)
// Tier 2: same category, different era
// Tier 3: full bank fallback
// ─────────────────────────────────────────────────────────────────────────────
function pickDecoys(target, allWords) {
  const others = allWords.filter(w => w.word !== target.word);
  const tier1 = others.filter(w =>
    w.eras.some(e => target.eras.includes(e)) &&
    w.categories.some(c => target.categories.includes(c))
  );
  const tier2 = others.filter(w =>
    !w.eras.some(e => target.eras.includes(e)) &&
    w.categories.some(c => target.categories.includes(c))
  );
  const tier3 = others.filter(w =>
    !w.categories.some(c => target.categories.includes(c))
  );
  const pool = [
    ...tier1.sort(() => Math.random() - 0.5),
    ...tier2.sort(() => Math.random() - 0.5),
    ...tier3.sort(() => Math.random() - 0.5),
  ];
  const picks = [];
  for (const w of pool) {
    if (!picks.find(p => p.word === w.word)) picks.push(w);
    if (picks.length === 2) break;
  }
  return picks.map(w => w.word);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAFF — Daily mode only. Invisible zero-width characters injected around
// BOOwords to confuse AI clipboard scraping. Visually transparent to humans.
// ─────────────────────────────────────────────────────────────────────────────
const ZW = ["\u200B","\u200C","\u200D","\u2060","\uFEFF"];
function zw() { return ZW[Math.floor(Math.random() * ZW.length)]; }
function injectChaff(text) {
  return text.split("").map((c, i) => i % 3 === 2 ? c + zw() : c).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOword CACHE
// ─────────────────────────────────────────────────────────────────────────────
async function getCachedBooWords(word) {
  try {
    const raw = await store.get("boo:" + word.toLowerCase().replace(/[^a-z0-9]/g, "-"));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
async function cacheBooWords(word, booWords) {
  try {
    await store.set("boo:" + word.toLowerCase().replace(/[^a-z0-9]/g, "-"), JSON.stringify(booWords));
  } catch {}
}

function fetchBooWords(word) {
  const entry = SEED_WORDS.find(s => s.word === word);
  return entry?.booWords || ["related","connected","associated","linked","known","famous"];
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:"#0D0C13", surface:"#161422", border:"#252236", surfaceHigh:"#1C1A2C",
  gold:"#D4AE52", goldLight:"#F0D46E", goldDim:"#D4AE5218",
  cream:"#F7EDDA", muted:"#B8B4CC", dim:"#3D3858", white:"#FAFAFA",
  red:"#C0392B", green:"#1E8449", greenLight:"#6EE5A0",
  blue:"#4AAEE0", footerText:"#B0ADBE",
};

// ─────────────────────────────────────────────────────────────────────────────
// UI PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
function SponsorOrQuote({ quote }) {
  if (SPONSOR.active) {
    return (
      <div style={{ width:"100%", padding:"18px 22px", background:C.goldDim, border:"1px solid "+C.gold+"2A", borderLeft:"3px solid "+C.gold+"88", borderRadius:10, margin:"20px 0" }}>
        <div style={{ fontSize:13, color:C.cream, fontFamily:"Georgia,serif", fontStyle:"italic", lineHeight:1.75, marginBottom:10 }}>&ldquo;{SPONSOR.text}&rdquo;</div>
        {SPONSOR.url
          ? <a href={SPONSOR.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:C.gold, fontFamily:"Georgia,serif", textDecoration:"none" }}>{SPONSOR.attribution}</a>
          : <div style={{ fontSize:10, color:C.gold, fontFamily:"Georgia,serif" }}>{SPONSOR.attribution}</div>}
      </div>
    );
  }
  if (!quote) return null;
  return (
    <div style={{ width:"100%", padding:"18px 22px", background:C.goldDim, border:"1px solid "+C.gold+"2A", borderLeft:"3px solid "+C.gold+"66", borderRadius:10, margin:"20px 0" }}>
      <div style={{ fontSize:12, color:C.cream, fontFamily:"Georgia,serif", fontStyle:"italic", lineHeight:1.75, marginBottom:10 }}>&ldquo;{quote.text}&rdquo;</div>
      <div style={{ fontSize:10, color:C.gold, fontFamily:"Georgia,serif" }}>— {quote.author}</div>
      <div style={{ fontSize:9, color:C.muted, fontFamily:"Georgia,serif", marginTop:2 }}>{quote.source}</div>
    </div>
  );
}

function SupportBlock() {
  return (
    <div style={{ width:"100%", padding:"22px 24px", textAlign:"center", background:C.surface, border:"1px solid "+C.border, borderRadius:10, margin:"12px 0" }}>
      <div style={{ fontSize:9, letterSpacing:4, color:C.muted, textTransform:"uppercase", fontFamily:"Georgia,serif", marginBottom:8 }}>{SUPPORT.label}</div>
      <div style={{ fontSize:11, color:C.muted, fontFamily:"Georgia,serif", lineHeight:1.7, marginBottom:16 }}>
        Suggested donation {SUPPORT.suggestedAmount}
      </div>
      <a href={SUPPORT.url} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"10px 22px", background:C.blue+"18", border:"1px solid "+C.blue+"77", borderRadius:8, color:"#6BC5F0", fontSize:12, fontWeight:600, fontFamily:"Georgia,serif", letterSpacing:0.5, textDecoration:"none" }}>
        {SUPPORT.platform} · {SUPPORT.handle}
      </a>
    </div>
  );
}

function PremiumBlock({ onUpgrade }) {
  return (
    <div style={{ width:"100%", padding:"22px 24px", textAlign:"center", background:C.goldDim, border:"1px solid "+C.gold+"33", borderRadius:10, margin:"20px 0" }}>
      <div style={{ fontSize:10, color:C.gold, letterSpacing:3, fontFamily:"Georgia,serif", marginBottom:10 }}>★ PREMIUM</div>
      <div style={{ fontSize:11, color:C.muted, fontFamily:"Georgia,serif", lineHeight:1.8, marginBottom:16 }}>
        Unlock Hard &amp; Expert cards.<br />Remove ads. Get printable game sheets.
      </div>
      <button onClick={onUpgrade} style={{ padding:"10px 28px", background:C.gold+"22", border:"1px solid "+C.gold, borderRadius:8, color:C.goldLight, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"Georgia,serif", letterSpacing:1 }}>
        Upgrade to Premium
      </button>
    </div>
  );
}

function Pill({ label, selected, onClick, color, locked }) {
  const col = color || C.gold;
  return (
    <button onClick={onClick} style={{ padding:"6px 13px", borderRadius:6, border:"1px solid "+(selected?col:C.dim), background:selected?col+"18":"transparent", color:selected?col:locked?C.dim:C.muted, fontSize:11, cursor:locked?"not-allowed":"pointer", fontFamily:"Georgia,serif", letterSpacing:0.3, whiteSpace:"nowrap", opacity:locked?0.45:1, display:"inline-flex", alignItems:"center", gap:5, transition:"all 0.15s" }}>
      {locked && <span style={{fontSize:9}}>🔒</span>}{label}
    </button>
  );
}

function Divider({ label }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, margin:"4px 0 12px" }}>
      <div style={{ height:1, flex:1, background:C.border }} />
      <span style={{ fontSize:9, letterSpacing:3, color:C.muted, fontFamily:"Georgia,serif", textTransform:"uppercase" }}>{label}</span>
      <div style={{ height:1, flex:1, background:C.border }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER — tap copyright ADMIN_TAP_COUNT times to open admin panel
// ─────────────────────────────────────────────────────────────────────────────
function Footer({ onHowToPlay, onAdminTap }) {
  const [taps, setTaps] = useState(0);
  const tapTimeout = useRef(null);
  const handleTap = () => {
    const next = taps + 1;
    setTaps(next);
    clearTimeout(tapTimeout.current);
    if (next >= ADMIN_TAP_COUNT) { setTaps(0); onAdminTap(); }
    else tapTimeout.current = setTimeout(() => setTaps(0), 2000);
  };
  return (
    <div style={{ width:"100%", borderTop:"1px solid "+C.dim, marginTop:24, paddingTop:20, textAlign:"center", display:"flex", flexDirection:"column", gap:10 }}>
      <button onClick={onHowToPlay} style={{ background:"transparent", border:"none", color:C.footerText, fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif", letterSpacing:1, textDecoration:"underline" }}>
        How to Play
      </button>
      <div onClick={handleTap} style={{ fontSize:10, color:C.footerText, fontFamily:"Georgia,serif", letterSpacing:0.8, cursor:"default", userSelect:"none" }}>
        © 2026 Mabaso · For Joyce
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCTIONS MODAL
// ─────────────────────────────────────────────────────────────────────────────
function InstructionsModal({ onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.surface, border:"1px solid "+C.border, borderRadius:16, padding:"32px 28px", maxWidth:480, width:"100%", boxShadow:"0 24px 80px rgba(0,0,0,0.8)", animation:"fadeUp 0.25s ease", maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ height:2, background:"linear-gradient(90deg,transparent,"+C.gold+",transparent)", marginBottom:24, borderRadius:1 }} />
        <div style={{ fontSize:10, letterSpacing:4, color:C.gold, textAlign:"center", marginBottom:20, fontFamily:"Georgia,serif", textTransform:"uppercase" }}>How to Play</div>

        <div style={{ fontSize:11, color:C.gold, fontFamily:"Georgia,serif", letterSpacing:2, marginBottom:10, textTransform:"uppercase" }}>Daily Challenge · Solo</div>
        {[
          ["📋","Six BOOwords are shown — they describe a hidden target word"],
          ["🔤","Three word choices appear — tap the one being described"],
          ["✓","Correct scores 1 point and advances to the next card"],
          ["🟥","Wrong scores 0 and advances immediately"],
          ["💡","Hint eliminates one wrong choice — costs 0.5 points"],
          ["⏱","60 second timer — score as many cards as you can"],
          ["📊","Share your result grid after the round"],
        ].map(([i,t])=>(
          <div key={t} style={{ display:"flex", gap:12, marginBottom:10, alignItems:"flex-start" }}>
            <span style={{ fontSize:15, flexShrink:0 }}>{i}</span>
            <span style={{ fontSize:11, color:C.muted, fontFamily:"Georgia,serif", lineHeight:1.6 }}>{t}</span>
          </div>
        ))}

        <div style={{ height:1, background:C.border, margin:"20px 0" }} />

        <div style={{ fontSize:11, color:C.gold, fontFamily:"Georgia,serif", letterSpacing:2, marginBottom:10, textTransform:"uppercase" }}>Custom Game · Pairs</div>
        {[
          ["👥","One reader, one guesser — optional proctor watches for violations"],
          ["📋","Reader sees the target word and six BOOwords"],
          ["🗣️","Give clues to get your partner to say the target word"],
          ["⛔","You cannot say any of the six BOOwords — proctor watches!"],
          ["💡","Tap any BOOword to highlight it gold — that word may then be spoken as a hint (costs 0.5 pts)"],
          ["↩","Press Skip to pass — no penalty, but no points gained"],
          ["✓","Press Got It when your partner guesses correctly"],
          ["🏆","Tiebreakers: fewest hints first, then fastest time"],
          ["👻","Proctors shout BOO! when a reader says a BOOword without tapping it first"],
        ].map(([i,t])=>(
          <div key={t} style={{ display:"flex", gap:12, marginBottom:10, alignItems:"flex-start" }}>
            <span style={{ fontSize:15, flexShrink:0 }}>{i}</span>
            <span style={{ fontSize:11, color:C.muted, fontFamily:"Georgia,serif", lineHeight:1.6 }}>{t}</span>
          </div>
        ))}

        <button onClick={onClose} style={{ width:"100%", marginTop:16, padding:"13px", background:C.gold+"18", border:"1px solid "+C.gold+"66", borderRadius:9, color:C.goldLight, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"Georgia,serif", letterSpacing:1 }}>
          Got It — Let's Play
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM REQUEST MODAL
// ─────────────────────────────────────────────────────────────────────────────
function PremiumModal({ fingerprint, onClose, onSuccess }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("idle"); // idle | submitting | done | error
  const inputStyle = { width:"100%", padding:"11px 14px", background:C.surfaceHigh, border:"1px solid "+C.dim, borderRadius:8, color:C.cream, fontSize:13, fontFamily:"Georgia,serif", outline:"none", marginBottom:12 };

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setStatus("submitting");
    try {
      await submitPremiumRequest(fingerprint, email, phone);
      setStatus("done");
      setTimeout(onSuccess, 1800);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.surface, border:"1px solid "+C.gold+"44", borderRadius:16, padding:"32px 28px", maxWidth:400, width:"100%", boxShadow:"0 24px 80px rgba(0,0,0,0.8)", animation:"fadeUp 0.25s ease" }}>
        <div style={{ height:2, background:"linear-gradient(90deg,transparent,"+C.gold+",transparent)", marginBottom:24, borderRadius:1 }} />
        <div style={{ fontSize:10, letterSpacing:4, color:C.gold, textAlign:"center", marginBottom:8, fontFamily:"Georgia,serif", textTransform:"uppercase" }}>★ Upgrade to Premium</div>
        <div style={{ fontSize:11, color:C.muted, textAlign:"center", fontFamily:"Georgia,serif", lineHeight:1.7, marginBottom:24 }}>
          Unlock Hard &amp; Expert cards, remove ads, and get printable game sheets.<br />
          Leave your details and we'll be in touch.
        </div>

        {status === "done" ? (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:28, marginBottom:12 }}>✓</div>
            <div style={{ fontSize:13, color:C.greenLight, fontFamily:"Georgia,serif" }}>Request received!</div>
            <div style={{ fontSize:11, color:C.muted, fontFamily:"Georgia,serif", marginTop:8 }}>We'll reach out to complete your upgrade.</div>
          </div>
        ) : (
          <>
            <input
              type="email" placeholder="Email address *" value={email}
              onChange={e=>setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              type="tel" placeholder="Phone (optional)" value={phone}
              onChange={e=>setPhone(e.target.value)}
              style={{...inputStyle, marginBottom:20}}
            />
            <button onClick={handleSubmit} disabled={!email.trim() || status==="submitting"} style={{ width:"100%", padding:"13px", background:C.gold+"22", border:"1px solid "+C.gold, borderRadius:9, color:C.goldLight, fontSize:12, fontWeight:600, cursor:email.trim()?"pointer":"not-allowed", fontFamily:"Georgia,serif", letterSpacing:1, opacity:email.trim()?1:0.5, marginBottom:10 }}>
              {status==="submitting" ? "Submitting…" : "Request Premium Access"}
            </button>
            {status==="error" && <div style={{ fontSize:10, color:C.red, textAlign:"center", fontFamily:"Georgia,serif" }}>Something went wrong. Please try again.</div>}
            <button onClick={onClose} style={{ width:"100%", padding:"10px", background:"transparent", border:"1px solid "+C.dim, borderRadius:9, color:C.muted, fontSize:11, cursor:"pointer", fontFamily:"Georgia,serif" }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PANEL MODAL
// Hidden behind ADMIN_TAP_COUNT taps on the footer copyright line.
// Shows all premium requests with status toggle buttons.
// Fingerprint serves as the device key — flip status to "premium" to grant access.
// ─────────────────────────────────────────────────────────────────────────────
function AdminPanel({ onClose }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllPremiumRequests().then(r => { setRecords(r); setLoading(false); });
  }, []);

  const flip = async (fingerprint, current) => {
    const next = current === "premium" ? "pending" : current === "pending" ? "premium" : "pending";
    await updatePremiumStatus(fingerprint, next);
    setRecords(r => r.map(rec => rec.fingerprint===fingerprint ? {...rec, status:next} : rec));
  };

  const statusColor = s => s==="premium"?C.greenLight:s==="revoked"?C.red:C.gold;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:20 }}>
      <div style={{ background:C.surface, border:"1px solid "+C.border, borderRadius:16, padding:"28px 24px", maxWidth:560, width:"100%", maxHeight:"85vh", display:"flex", flexDirection:"column", boxShadow:"0 24px 80px rgba(0,0,0,0.9)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:10, letterSpacing:4, color:C.gold, fontFamily:"Georgia,serif", textTransform:"uppercase" }}>Admin · Premium Requests</div>
          <button onClick={onClose} style={{ background:"transparent", border:"1px solid "+C.dim, borderRadius:6, color:C.muted, fontSize:11, padding:"4px 10px", cursor:"pointer", fontFamily:"Georgia,serif" }}>Close</button>
        </div>
        <div style={{ overflowY:"auto", flex:1 }}>
          {loading && <div style={{ textAlign:"center", color:C.muted, fontFamily:"Georgia,serif", padding:"20px 0" }}>Loading…</div>}
          {!loading && records.length===0 && <div style={{ textAlign:"center", color:C.muted, fontFamily:"Georgia,serif", padding:"20px 0", fontSize:12 }}>No requests yet.</div>}
          {records.map(r => (
            <div key={r.fingerprint} style={{ padding:"14px 16px", background:C.surfaceHigh, border:"1px solid "+C.border, borderRadius:10, marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, color:C.cream, fontFamily:"Georgia,serif", marginBottom:3 }}>{r.email}</div>
                  {r.phone && <div style={{ fontSize:11, color:C.muted, fontFamily:"Georgia,serif", marginBottom:3 }}>{r.phone}</div>}
                  <div style={{ fontSize:9, color:C.dim, fontFamily:"monospace", marginBottom:4 }}>FP: {r.fingerprint}</div>
                  <div style={{ fontSize:9, color:C.dim, fontFamily:"Georgia,serif" }}>{new Date(r.timestamp).toLocaleString()}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                  <div style={{ fontSize:10, color:statusColor(r.status), fontFamily:"Georgia,serif", letterSpacing:1, textTransform:"uppercase" }}>{r.status}</div>
                  <button onClick={()=>flip(r.fingerprint, r.status)} style={{ padding:"5px 12px", background:r.status==="premium"?C.red+"22":C.green+"22", border:"1px solid "+(r.status==="premium"?C.red+"66":C.greenLight+"66"), borderRadius:6, color:r.status==="premium"?C.red:C.greenLight, fontSize:10, cursor:"pointer", fontFamily:"Georgia,serif", whiteSpace:"nowrap" }}>
                    {r.status==="premium" ? "Revoke" : "Grant Premium"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:9, color:C.dim, fontFamily:"Georgia,serif", marginTop:16, textAlign:"center", lineHeight:1.6 }}>
          Granting premium sets status to "premium" on this device's storage.<br />
          When Supabase is added, this table migrates directly.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARE MODAL
// ─────────────────────────────────────────────────────────────────────────────
function ShareModal({ result, mode, onClose }) {
  const [status, setStatus] = useState("idle");
  const dateStr = new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  const scoreDisplay = result.score%1===0?String(result.score):result.score.toFixed(1);
  const totalSecs = result.timeUsed>0?Math.round(result.timeUsed/1000):0;
  const timeStr = totalSecs>=60?`${Math.floor(totalSecs/60)}m ${totalSecs%60}s`:`${totalSecs}s`;
  const grid = result.cards.map(c=>{
    if(c.result==="got"&&c.hintUsed) return "🟨";
    if(c.result==="got") return "🟩";
    return "🟥";
  }).join("");
  const shareText = ["BOOHist",mode==="daily"?`Daily Challenge — ${dateStr}`:`Custom Game — ${dateStr}`,"",grid,"",`Score: ${scoreDisplay}/${result.cards.length}`,result.hintsUsed>0?`Hints: ${result.hintsUsed}`:"No hints","Time: "+timeStr,"","boohist.com"].join("\n");

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({title:"BOOHist",text:shareText}); setStatus("shared"); } catch {}
    } else {
      await navigator.clipboard.writeText(shareText);
      setStatus("copied"); setTimeout(()=>setStatus("idle"),2000);
    }
  };
  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText);
    setStatus("copied"); setTimeout(()=>setStatus("idle"),2000);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.surface, border:"1px solid "+C.border, borderRadius:16, padding:"32px 28px", maxWidth:400, width:"100%", boxShadow:"0 24px 80px rgba(0,0,0,0.8)", animation:"fadeUp 0.25s ease", textAlign:"center" }}>
        <div style={{ height:2, background:"linear-gradient(90deg,transparent,"+C.gold+",transparent)", marginBottom:24, borderRadius:1 }} />
        <div style={{ fontSize:9, letterSpacing:4, color:C.gold, marginBottom:6, fontFamily:"Georgia,serif", textTransform:"uppercase" }}>{mode==="daily"?"Daily Challenge":"Custom Game"} — {dateStr}</div>
        <div style={{ fontSize:28, letterSpacing:3, margin:"18px 0", lineHeight:1.4 }}>{grid}</div>
        <div style={{ display:"flex", gap:16, justifyContent:"center", marginBottom:20 }}>
          {[["🟩","Correct"],["🟨","Hint used"],["🟥","Missed"]].map(([e,l])=>(
            <div key={l} style={{ fontSize:10, color:C.muted, fontFamily:"Georgia,serif" }}>{e} {l}</div>
          ))}
        </div>
        <div style={{ display:"flex", border:"1px solid "+C.border, borderRadius:10, overflow:"hidden", marginBottom:24 }}>
          {[
            {label:"Score",val:`${scoreDisplay}/${result.cards.length}`,color:C.goldLight},
            {label:"Hints",val:String(result.hintsUsed),color:result.hintsUsed===0?C.greenLight:C.gold},
            {label:"Time",val:timeStr,color:"#8FB4CC"},
          ].map((s,i,arr)=>(
            <div key={s.label} style={{ flex:1, padding:"14px 8px", textAlign:"center", borderRight:i<arr.length-1?"1px solid "+C.border:"none", background:C.surfaceHigh }}>
              <div style={{ fontSize:20, fontWeight:700, color:s.color, fontFamily:"Georgia,serif" }}>{s.val}</div>
              <div style={{ fontSize:8, letterSpacing:2, color:C.muted, marginTop:4, textTransform:"uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:10, marginBottom:10 }}>
          {typeof navigator!=="undefined"&&navigator.share && (
            <button onClick={handleShare} style={{ flex:1, padding:"12px", background:C.gold+"18", border:"1px solid "+C.gold+"66", borderRadius:9, color:C.goldLight, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"Georgia,serif" }}>Share</button>
          )}
          <button onClick={handleCopy} style={{ flex:1, padding:"12px", background:status==="copied"?C.green+"22":C.surface, border:"1px solid "+(status==="copied"?C.greenLight+"66":C.border), borderRadius:9, color:status==="copied"?C.greenLight:C.muted, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"Georgia,serif", transition:"all 0.2s" }}>
            {status==="copied"?"✓ Copied":"Copy"}
          </button>
        </div>
        <button onClick={onClose} style={{ width:"100%", padding:"10px", background:"transparent", border:"1px solid "+C.dim, borderRadius:9, color:C.muted, fontSize:11, cursor:"pointer", fontFamily:"Georgia,serif" }}>Close</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY CARD
// ─────────────────────────────────────────────────────────────────────────────
function DailyCard({ card, choices, onPick, onHint, timerPct, urgent, cardNum, total, hintEliminatedIdx, flashWrong }) {
  return (
    <div style={{ width:"100%", maxWidth:420, animation:"cardIn 0.3s cubic-bezier(0.34,1.4,0.64,1)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ fontSize:11, color:C.muted, fontFamily:"Georgia,serif" }}>{cardNum} / {total}</span>
        <div style={{ flex:1, height:2, background:C.dim, margin:"0 14px", borderRadius:1, overflow:"hidden" }}>
          <div style={{ height:"100%", width:timerPct+"%", background:urgent?"#E74C3C":"linear-gradient(90deg,#D4AE52,#F5D76E)", borderRadius:1, transition:"width 1s linear", animation:urgent?"pulse 0.7s infinite":"none" }} />
        </div>
        <span style={{ fontSize:11, color:urgent?C.red:C.muted, fontFamily:"monospace" }}>{Math.ceil(timerPct*0.01*60)}s</span>
      </div>
      <div style={{ background:C.surface, border:"1px solid "+(flashWrong?C.red:C.border), borderRadius:14, overflow:"hidden", boxShadow:"0 16px 48px rgba(0,0,0,0.7)", transition:"border-color 0.1s" }}>
        <div style={{ height:2, background:"linear-gradient(90deg,transparent,"+C.gold+",transparent)" }} />
        <div style={{ padding:"20px 20px 16px" }}>
          <div style={{ fontSize:8, letterSpacing:3, color:C.red, opacity:0.7, fontFamily:"Georgia,serif", marginBottom:10, textTransform:"uppercase" }}>BOOwords — what is being described?</div>
          {card.booWords ? (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {card.booWords.map((w,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", background:C.red+"14", border:"1px solid "+C.red+"30", borderRadius:7, fontFamily:"Georgia,serif", fontSize:19, color:"#DDB8B0", letterSpacing:0.3 }}>
                  <span style={{ color:C.red+"55", fontSize:9 }}>⬥</span>
                  <span aria-label={w}>
                    <span aria-hidden="true" style={{ fontSize:0, userSelect:"none", position:"absolute", opacity:0 }}>{injectChaff(w)}</span>
                    {w}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign:"center", padding:"14px 0" }}>
              <div style={{ width:18, height:18, border:"2px solid "+C.dim, borderTop:"2px solid "+C.gold, borderRadius:"50%", margin:"0 auto 8px", animation:"spin 0.8s linear infinite" }} />
              <div style={{ fontSize:10, color:C.muted, fontFamily:"Georgia,serif" }}>Loading…</div>
            </div>
          )}
        </div>
        {card.booWords && (
          <div style={{ padding:"0 20px 24px" }}>
            <div style={{ fontSize:8, letterSpacing:3, color:C.gold, opacity:0.6, fontFamily:"Georgia,serif", marginBottom:10, textTransform:"uppercase" }}>Which word is being described?</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {choices.map((choice,i)=>{
                const eliminated = hintEliminatedIdx===i;
                return (
                  <button key={card.word+'-'+i} onClick={()=>!eliminated&&onPick(choice)} disabled={eliminated}
                    style={{ padding:"13px 16px", background:eliminated?C.dim+"33":"transparent", border:"1px solid "+(eliminated?C.dim:C.gold+"44"), borderRadius:10, color:eliminated?C.dim:C.cream, fontFamily:"Georgia,serif", fontSize:20, fontWeight:700, cursor:eliminated?"not-allowed":"pointer", textAlign:"center", letterSpacing:0.5, transition:"all 0.15s", opacity:eliminated?0.3:1, textDecoration:eliminated?"line-through":"none", WebkitTapHighlightColor:"transparent" }}
                    onMouseEnter={e=>{ if(!eliminated){e.currentTarget.style.background=C.gold+"18";e.currentTarget.style.borderColor=C.gold+"88";}}}
                    onMouseLeave={e=>{ if(!eliminated){e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor=C.gold+"44";}}}
                    onTouchEnd={e=>{ const el=e.currentTarget; setTimeout(()=>{ if(el&&!eliminated){el.style.background="transparent";el.style.borderColor=C.gold+"44";}},50); }}
                  >{choice}</button>
                );
              })}
            </div>
            {hintEliminatedIdx===null && (
              <button onClick={onHint} style={{ width:"100%", marginTop:12, padding:"9px", background:C.gold+"0F", border:"1px solid "+C.gold+"33", borderRadius:8, color:C.gold, fontSize:11, cursor:"pointer", fontFamily:"Georgia,serif", letterSpacing:0.5 }}>
                💡 Hint — eliminate a wrong answer (−0.5 pts)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM CARD
// ─────────────────────────────────────────────────────────────────────────────
function CustomCard({ card, onGot, onSkip, timerPct, urgent, cardNum, total, highlightedBooIdx, onHighlightBoo }) {
  return (
    <div style={{ width:"100%", maxWidth:420, animation:"cardIn 0.3s cubic-bezier(0.34,1.4,0.64,1)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ fontSize:11, color:C.muted, fontFamily:"Georgia,serif" }}>{cardNum} / {total}</span>
        <div style={{ flex:1, height:2, background:C.dim, margin:"0 14px", borderRadius:1, overflow:"hidden" }}>
          <div style={{ height:"100%", width:timerPct+"%", background:urgent?"#E74C3C":"linear-gradient(90deg,#D4AE52,#F5D76E)", borderRadius:1, transition:"width 1s linear", animation:urgent?"pulse 0.7s infinite":"none" }} />
        </div>
        <span style={{ fontSize:11, color:urgent?C.red:C.muted, fontFamily:"monospace" }}>{Math.ceil(timerPct*0.01*60)}s</span>
      </div>
      <div style={{ background:C.surface, border:"1px solid "+C.border, borderRadius:14, overflow:"hidden", boxShadow:"0 16px 48px rgba(0,0,0,0.7)" }}>
        <div style={{ height:2, background:"linear-gradient(90deg,transparent,"+C.gold+",transparent)" }} />
        <div style={{ background:"linear-gradient(160deg,#171427,#0F0D1A)", padding:"28px 24px 20px", borderBottom:"1px solid "+C.dim, textAlign:"center" }}>
          <div style={{ fontSize:9, letterSpacing:4, color:C.gold, opacity:0.55, fontFamily:"Georgia,serif", marginBottom:10, textTransform:"uppercase" }}>Describe This</div>
          <div style={{ fontSize:card.word.length>22?26:card.word.length>14?34:42, fontWeight:700, color:C.cream, fontFamily:"Georgia,'Times New Roman',serif", letterSpacing:1, lineHeight:1.15 }}>{card.word}</div>
          <div style={{ marginTop:10, display:"flex", gap:5, justifyContent:"center", flexWrap:"wrap" }}>
            {card.eras.filter(e=>e!=="All Time").slice(0,2).map(e=>(
              <span key={e} style={{ fontSize:8, padding:"2px 8px", borderRadius:3, background:(ERA_COLORS[e]||C.gold)+"22", border:"1px solid "+(ERA_COLORS[e]||C.gold)+"44", color:ERA_COLORS[e]||C.gold, fontFamily:"Georgia,serif", letterSpacing:1 }}>{e}</span>
            ))}
          </div>
        </div>
        <div style={{ padding:"16px 20px 22px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <div style={{ fontSize:8, letterSpacing:3, color:C.red, opacity:0.7, fontFamily:"Georgia,serif", textTransform:"uppercase" }}>BOOwords</div>
            <div style={{ fontSize:9, color:C.gold, fontFamily:"Georgia,serif", fontStyle:"italic" }}>💡 Tap to use as hint</div>
          </div>
          {card.booWords ? (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {card.booWords.map((w,i)=>{
                const isHighlighted = highlightedBooIdx===i;
                return (
                  <button key={i} onClick={()=>onHighlightBoo(i)} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 13px", background:isHighlighted?C.gold+"22":C.red+"0A", border:"1px solid "+(isHighlighted?C.gold+"88":C.red+"1E"), borderRadius:7, fontFamily:"Georgia,serif", fontSize:16, color:isHighlighted?C.goldLight:"#C9A8A0", letterSpacing:0.3, cursor:"pointer", textAlign:"left", transition:"all 0.15s", width:"100%", boxShadow:isHighlighted?"0 0 14px "+C.gold+"33":"none" }}>
                    <span style={{ color:isHighlighted?C.gold:C.red+"55", fontSize:10 }}>{isHighlighted?"★":"⬥"}</span>
                    {w}
                    {isHighlighted && <span style={{ marginLeft:"auto", fontSize:9, color:C.gold, fontStyle:"italic" }}>hint · −0.5 pts</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign:"center", padding:"14px 0" }}>
              <div style={{ width:18, height:18, border:"2px solid "+C.dim, borderTop:"2px solid "+C.gold, borderRadius:"50%", margin:"0 auto 8px", animation:"spin 0.8s linear infinite" }} />
              <div style={{ fontSize:10, color:C.muted, fontFamily:"Georgia,serif" }}>Loading…</div>
            </div>
          )}
        </div>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:14 }}>
        <button onClick={onSkip} style={{ flex:1, padding:"13px 8px", background:"transparent", border:"1px solid "+C.dim, borderRadius:9, color:C.muted, fontSize:11, cursor:"pointer", fontFamily:"Georgia,serif", transition:"all 0.15s" }}>Skip</button>
        <button onClick={onGot} style={{ flex:2, padding:"13px 8px", background:C.green+"18", border:"1px solid "+C.green+"55", borderRadius:9, color:C.greenLight, fontSize:11, cursor:"pointer", fontFamily:"Georgia,serif", boxShadow:"0 0 16px "+C.green+"1A" }}>✓ Got It</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function BooHist() {
  const [screen, setScreen] = useState("home");
  const [mode, setMode] = useState(null);
  const [fingerprint, setFingerprint] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const [config, setConfig] = useState({
    categories:["History","Science"], eras:["All Time","Classical Antiquity"],
    difficulty:"Medium", cardCount:5, timerSeconds:60,
  });

  const [deck, setDeck] = useState([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [choices, setChoices] = useState([]);
  const [hintEliminatedIdx, setHintEliminatedIdx] = useState(null);
  const [highlightedBooIdx, setHighlightedBooIdx] = useState(null);
  const [cardResults, setCardResults] = useState([]);
  const [score, setScore] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [timer, setTimer] = useState(60);
  const [started, setStarted] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [flashWrong, setFlashWrong] = useState(false);
  const [loadingState, setLoadingState] = useState({done:0,total:0});

  const timerRef = useRef(null);
  const diffRank = {Easy:0,Medium:1,Hard:2,Expert:3};
  const [quote] = useState(()=>QUOTES[Math.floor(Math.random()*QUOTES.length)]);

  // Init fingerprint and check premium on mount
  useEffect(()=>{
    generateFingerprint().then(async fp => {
      setFingerprint(fp);
      const premium = await checkPremiumStatus(fp);
      setIsPremium(premium);
    });
  },[]);

  const filteredPool = SEED_WORDS.filter(w=>{
    const catOk = config.categories.includes("All") || w.categories.some(c=>config.categories.includes(c));
    const eraOk = w.eras.some(e=>config.eras.includes(e));
    const diffOk = (diffRank[w.difficulty]||0)<=(diffRank[config.difficulty]||0);
    const premOk = isPremium || !PREMIUM_DIFFICULTIES.includes(w.difficulty);
    return catOk&&eraOk&&diffOk&&premOk;
  });

  // ── BUILD DECK ──────────────────────────────────────────────────
  const buildDeck = useCallback(async (seedWords, gameMode) => {
    setScreen("loading");
    setLoadingState({done:0,total:seedWords.length});
    const timerSecs = gameMode==="daily"?60:config.timerSeconds;
    const built = [];
    for(let i=0;i<seedWords.length;i++){
      const w = seedWords[i];
      setLoadingState({done:i,total:seedWords.length});
      try { const booWords = fetchBooWords(w.word); built.push({...w,booWords}); }
      catch { built.push({...w,booWords:null}); }
    }
    setDeck(built); setCardIdx(0); setCardResults([]); setScore(0); setHintsUsed(0);
    setHintEliminatedIdx(null); setHighlightedBooIdx(null);
    setTimer(timerSecs); setStarted(false); setStartTime(null); setEndTime(null);
    if(gameMode==="daily"&&built.length>0){
      const decoys = pickDecoys(built[0],SEED_WORDS);
      setChoices([built[0].word,...decoys].sort(()=>Math.random()-0.5));
    }
    setScreen("game");
  },[config]);

  const startDaily = () => { setMode("daily"); buildDeck(getDailyPool(),"daily"); };
  const startCustom = useCallback(() => {
    setMode("custom");
    const pool = [...filteredPool].sort(()=>Math.random()-0.5).slice(0,config.cardCount);
    if(!pool.length) return;
    buildDeck(pool,"custom");
  },[filteredPool,config,buildDeck]);

  // ── TIMER ──────────────────────────────────────────────────────
  useEffect(()=>{
    if(screen==="game"&&started){
      const timerSecs = mode==="daily"?60:config.timerSeconds;
      timerRef.current = setInterval(()=>{
        setTimer(t=>{ if(t<=1){clearInterval(timerRef.current);setEndTime(Date.now());setScreen("results");return 0;} return t-1; });
      },1000);
    }
    return ()=>clearInterval(timerRef.current);
  },[screen,started]);

  const handleStart = ()=>{ setStarted(true); setStartTime(Date.now()); };

  const handlePick = (picked)=>{
    const correct = deck[cardIdx].word;
    if(picked===correct){
      setScore(s=>s+(hintEliminatedIdx!==null?0.5:1));
      setCardResults(r=>[...r,{result:"got",hintUsed:hintEliminatedIdx!==null}]);
      advanceCard();
    } else {
      setFlashWrong(true);
      setTimeout(()=>{ setFlashWrong(false); setCardResults(r=>[...r,{result:"miss",hintUsed:false}]); advanceCard(); },180);
    }
  };
  const handleDailyHint = ()=>{
    if(hintEliminatedIdx!==null) return;
    const correct = deck[cardIdx].word;
    const wrongIdxs = choices.map((_,i)=>i).filter(i=>choices[i]!==correct);
    setHintEliminatedIdx(wrongIdxs[Math.floor(Math.random()*wrongIdxs.length)]);
    setHintsUsed(h=>h+1);
  };
  const handleGot = ()=>{
    setScore(s=>s+(highlightedBooIdx!==null?0.5:1));
    setCardResults(r=>[...r,{result:"got",hintUsed:highlightedBooIdx!==null}]);
    advanceCard();
  };
  const handleSkip = ()=>{ setCardResults(r=>[...r,{result:"skip",hintUsed:false}]); advanceCard(); };
  const handleHighlightBoo = (idx)=>{ if(highlightedBooIdx!==null) return; setHighlightedBooIdx(idx); setHintsUsed(h=>h+1); };

  const advanceCard = ()=>{
    const next = cardIdx+1;
    if(next>=deck.length){ clearInterval(timerRef.current); setEndTime(Date.now()); setScreen("results"); }
    else {
      setCardIdx(next); setHintEliminatedIdx(null); setHighlightedBooIdx(null);
      if(mode==="daily"){
        const decoys = pickDecoys(deck[next],SEED_WORDS);
        setChoices([deck[next].word,...decoys].sort(()=>Math.random()-0.5));
      }
    }
  };

  const toggle=(arr,val)=>arr.includes(val)?arr.filter(x=>x!==val):[...arr,val];
  const ensure=(arr,val,next)=>next.length?next:arr;
  const timerSecs = mode==="daily"?60:config.timerSeconds;
  const timerPct = (timer/timerSecs)*100;
  const urgent = timer<=8;
  const card = deck[cardIdx];
  const shareResult = { score, cards:cardResults, hintsUsed, timeUsed:(endTime&&startTime)?(endTime-startTime):0 };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.white, fontFamily:"Georgia,serif" }}>
      <style>{`
        *{box-sizing:border-box;} body{margin:0;background:${C.bg};}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes cardIn{from{opacity:0;transform:translateY(20px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
        input::placeholder{color:#3E3B50;}
        ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-thumb{background:${C.dim};border-radius:2px;}
      `}</style>

      {showInstructions && <InstructionsModal onClose={()=>setShowInstructions(false)} />}
      {showShare && <ShareModal result={shareResult} mode={mode} onClose={()=>setShowShare(false)} />}
      {showPremiumModal && fingerprint && <PremiumModal fingerprint={fingerprint} onClose={()=>setShowPremiumModal(false)} onSuccess={()=>{ setShowPremiumModal(false); }} />}
      {showAdmin && <AdminPanel onClose={()=>setShowAdmin(false)} />}

      <div style={{ maxWidth:560, margin:"0 auto", padding:"16px 20px 20px", display:"flex", flexDirection:"column", alignItems:"center" }}>

        {/* MASTHEAD */}
        <div style={{ textAlign:"center", marginBottom:16, width:"100%", animation:"fadeUp 0.5s ease" }}>
          <div style={{ fontSize:46, fontWeight:700, lineHeight:1, letterSpacing:4 }}>
            <span style={{ color:C.gold }}>BOO</span><span style={{ color:C.cream }}>Hist</span>
          </div>
          {isPremium && <div style={{ fontSize:9, color:C.greenLight, letterSpacing:3, marginTop:8, fontFamily:"Georgia,serif" }}>★ PREMIUM</div>}
        </div>

        {/* HOME */}
        {screen==="home" && (
          <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:12, animation:"fadeUp 0.4s ease" }}>
            <SponsorOrQuote quote={quote} />
            <button onClick={startDaily} style={{ width:"100%", padding:"22px 24px", background:C.gold+"0F", border:"1px solid "+C.gold+"55", borderRadius:12, cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background=C.gold+"18";e.currentTarget.style.borderColor=C.gold+"88";}}
              onMouseLeave={e=>{e.currentTarget.style.background=C.gold+"0F";e.currentTarget.style.borderColor=C.gold+"55";}}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:9, letterSpacing:4, color:C.gold, textTransform:"uppercase", marginBottom:8 }}>📅 Today's Challenge</div>
                  <div style={{ fontSize:20, fontWeight:700, color:C.cream }}>Today's 10</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:6, lineHeight:1.6 }}>Guess the hidden word from its BOOwords.<br />Same cards for everyone. Resets at midnight.</div>
                </div>
                <div style={{ fontSize:22, opacity:0.5, marginLeft:12 }}>→</div>
              </div>
            </button>
            <button onClick={()=>setScreen("config")} style={{ width:"100%", padding:"22px 24px", background:C.surface, border:"1px solid "+C.border, borderRadius:12, cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.muted;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;}}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:20, fontWeight:700, color:C.cream }}>Multi-Player</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:6, lineHeight:1.6 }}>Reader gives clues, partner guesses.<br />Choose eras, categories &amp; difficulty.</div>
                </div>
                <div style={{ fontSize:22, opacity:0.3, marginLeft:12 }}>→</div>
              </div>
            </button>
            <SupportBlock />
            {!isPremium && <PremiumBlock onUpgrade={()=>setShowPremiumModal(true)} />}
            <Footer onHowToPlay={()=>setShowInstructions(true)} onAdminTap={()=>setShowAdmin(true)} />
          </div>
        )}

        {/* CONFIG */}
        {screen==="config" && (
          <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:22, animation:"fadeUp 0.4s ease" }}>
            <button onClick={()=>setScreen("home")} style={{ alignSelf:"flex-start", padding:"4px 12px", background:"transparent", border:"1px solid "+C.dim, borderRadius:20, color:C.muted, fontSize:10, cursor:"pointer", fontFamily:"Georgia,serif" }}>← Back</button>
            <div>
              <Divider label="Historical Era" />
              <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                {ERAS.map(era=><Pill key={era} label={era} color={ERA_COLORS[era]||C.gold} selected={config.eras.includes(era)} onClick={()=>setConfig(c=>({...c,eras:ensure(c.eras,era,toggle(c.eras,era))}))} />)}
              </div>
            </div>
            <div>
              <Divider label="Category" />
              <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                <Pill label="All" color="#A0C4D8" selected={config.categories.includes("All")} onClick={()=>setConfig(c=>({...c,categories:c.categories.includes("All")?["History"]:["All"]}))} />
                {CATEGORIES.map(cat=><Pill key={cat} label={cat} color="#7B91A0" selected={config.categories.includes("All")||config.categories.includes(cat)}
                  onClick={()=>{ if(config.categories.includes("All")) setConfig(c=>({...c,categories:[cat]})); else setConfig(c=>({...c,categories:ensure(c.categories,cat,toggle(c.categories,cat))})); }} />)}
              </div>
            </div>
            <div>
              <Divider label="Difficulty" />
              <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                {DIFFICULTIES.map(d=>{ const locked=!isPremium&&PREMIUM_DIFFICULTIES.includes(d); return <Pill key={d} label={d} color={C.gold} selected={config.difficulty===d} locked={locked} onClick={()=>{ if(!locked) setConfig(c=>({...c,difficulty:d})); }} />; })}
              </div>
              {!isPremium && <div style={{ fontSize:10, color:C.muted, marginTop:8 }}>🔒 Hard &amp; Expert requires <span style={{ color:C.gold, cursor:"pointer" }} onClick={()=>setShowPremiumModal(true)}>Premium</span></div>}
            </div>
            <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:180 }}>
                <Divider label="Cards" />
                <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                  {CARD_COUNTS.map(n=><Pill key={n} label={String(n)} color={C.gold} selected={config.cardCount===n} onClick={()=>setConfig(c=>({...c,cardCount:n}))} />)}
                </div>
              </div>
              <div style={{ flex:1, minWidth:180 }}>
                <Divider label="Timer" />
                <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                  {TIMER_OPTIONS.map(t=><Pill key={t} label={t+"s"} color={C.gold} selected={config.timerSeconds===t} onClick={()=>setConfig(c=>({...c,timerSeconds:t}))} />)}
                </div>
              </div>
            </div>
            <div style={{ padding:"10px 14px", background:C.gold+"08", border:"1px solid "+C.gold+"18", borderRadius:7, fontSize:11, color:C.muted, textAlign:"center" }}>
              {filteredPool.length} words available · {Math.min(filteredPool.length,config.cardCount)} will be dealt
            </div>
            <button onClick={startCustom} disabled={filteredPool.length===0} style={{ padding:"16px", background:C.gold+"18", border:"1px solid "+C.gold+"77", borderRadius:9, color:C.goldLight, fontSize:13, fontWeight:600, cursor:filteredPool.length?"pointer":"not-allowed", fontFamily:"Georgia,serif", letterSpacing:2, opacity:filteredPool.length?1:0.4 }}>Deal the Cards</button>
            <Footer onHowToPlay={()=>setShowInstructions(true)} onAdminTap={()=>setShowAdmin(true)} />
          </div>
        )}

        {/* LOADING */}
        {screen==="loading" && (
          <div style={{ textAlign:"center", padding:"60px 0", animation:"fadeUp 0.4s ease" }}>
            <div style={{ width:44, height:44, border:"2px solid "+C.dim, borderTop:"2px solid "+C.gold, borderRadius:"50%", margin:"0 auto 24px", animation:"spin 0.9s linear infinite" }} />
            <div style={{ fontSize:13, color:C.muted, letterSpacing:2, fontFamily:"Georgia,serif" }}>Loading…</div>
          </div>
        )}

        {/* GAME */}
        {screen==="game" && card && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"100%", animation:"fadeUp 0.3s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", width:"100%", maxWidth:420, marginBottom:14 }}>
              <span style={{ fontSize:11, color:C.greenLight }}>{score%1===0?score:score.toFixed(1)} pts</span>
              <span style={{ fontSize:10, color:C.muted }}>{mode==="daily"?"📅 Daily":"👥 Custom"}</span>
              <span style={{ fontSize:11, color:hintsUsed>0?C.gold:C.muted }}>💡 {hintsUsed}</span>
            </div>
            {!started ? (
              <div style={{ textAlign:"center", maxWidth:420, width:"100%" }}>
                <div style={{ padding:"28px 22px", background:C.surface, border:"1px solid "+C.border, borderRadius:14, marginBottom:20 }}>
                  <div style={{ fontSize:12, color:C.muted, lineHeight:1.9, marginBottom:12 }}>
                    {deck.length} cards ready.<br />
                    {mode==="daily"?"Guess the word from its BOOwords.":"One reader, one guesser — optional proctor."}<br />
                    Timer starts when you press Start.
                  </div>
                </div>
                <button onClick={handleStart} style={{ width:"100%", padding:"17px", background:C.gold+"18", border:"1px solid "+C.gold+"77", borderRadius:9, color:C.goldLight, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"Georgia,serif", letterSpacing:2 }}>Start the Clock</button>
              </div>
            ) : mode==="daily" ? (
              <DailyCard key={cardIdx} card={card} choices={choices} onPick={handlePick} onHint={handleDailyHint} timerPct={timerPct} urgent={urgent} cardNum={cardIdx+1} total={deck.length} hintEliminatedIdx={hintEliminatedIdx} flashWrong={flashWrong} />
            ) : (
              <CustomCard card={card} onGot={handleGot} onSkip={handleSkip} timerPct={timerPct} urgent={urgent} cardNum={cardIdx+1} total={deck.length} highlightedBooIdx={highlightedBooIdx} onHighlightBoo={handleHighlightBoo} />
            )}
          </div>
        )}

        {/* RESULTS */}
        {screen==="results" && (
          <div style={{ textAlign:"center", animation:"fadeUp 0.5s ease", width:"100%" }}>
            <div style={{ fontSize:9, letterSpacing:5, color:C.gold, marginBottom:16, textTransform:"uppercase" }}>{mode==="daily"?"Daily Challenge Complete":"Round Complete"}</div>
            <div style={{ padding:"36px 28px", background:C.surface, border:"1px solid "+C.border, borderRadius:14, marginBottom:20, boxShadow:"0 20px 60px rgba(0,0,0,0.5)" }}>
              <div style={{ fontSize:68, color:C.cream, fontWeight:700, lineHeight:1, marginBottom:4 }}>{score%1===0?score:score.toFixed(1)}</div>
              <div style={{ fontSize:10, letterSpacing:3, color:C.muted, marginBottom:22 }}>OUT OF {deck.length}</div>
              <div style={{ fontSize:24, letterSpacing:3, marginBottom:20 }}>
                {cardResults.map((c,i)=>{ if(c.result==="got"&&c.hintUsed) return <span key={i}>🟨</span>; if(c.result==="got") return <span key={i}>🟩</span>; return <span key={i}>🟥</span>; })}
              </div>
              <div style={{ display:"flex", borderTop:"1px solid "+C.border, paddingTop:20 }}>
                {[{label:"Correct",val:cardResults.filter(c=>c.result==="got").length,color:C.greenLight},{label:"Hints",val:hintsUsed,color:hintsUsed===0?C.greenLight:C.gold},{label:"Missed",val:cardResults.filter(c=>c.result!=="got").length,color:C.muted}].map((s,i,arr)=>(
                  <div key={s.label} style={{ flex:1, textAlign:"center", borderRight:i<arr.length-1?"1px solid "+C.border:"none" }}>
                    <div style={{ fontSize:24, color:s.color, fontWeight:700 }}>{s.val}</div>
                    <div style={{ fontSize:8, letterSpacing:2, color:C.muted, marginTop:4, textTransform:"uppercase" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {hintsUsed>0&&endTime&&startTime&&<div style={{ fontSize:10, color:C.muted, marginTop:14, fontStyle:"italic" }}>Tiebreaker: {hintsUsed} hint{hintsUsed!==1?"s":""} · {Math.round((endTime-startTime)/1000)}s</div>}
            </div>
            <div style={{ display:"flex", gap:10, marginBottom:12 }}>
              <button onClick={()=>setShowShare(true)} style={{ flex:1, padding:"13px", background:C.gold+"18", border:"1px solid "+C.gold+"66", borderRadius:9, color:C.goldLight, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"Georgia,serif" }}>Share Result</button>
              <button onClick={()=>setScreen("home")} style={{ flex:1, padding:"13px", background:"transparent", border:"1px solid "+C.dim, borderRadius:9, color:C.muted, fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif" }}>Home</button>
            </div>
            {mode==="daily"&&<button onClick={startDaily} style={{ width:"100%", padding:"11px", background:"transparent", border:"1px solid "+C.dim, borderRadius:9, color:C.muted, fontSize:11, cursor:"pointer", fontFamily:"Georgia,serif", marginBottom:8 }}>Replay Today's Challenge</button>}
            {mode==="custom"&&<button onClick={startCustom} style={{ width:"100%", padding:"11px", background:"transparent", border:"1px solid "+C.dim, borderRadius:9, color:C.muted, fontSize:11, cursor:"pointer", fontFamily:"Georgia,serif", marginBottom:8 }}>Play Again</button>}
            <SponsorOrQuote quote={QUOTES[Math.floor(Math.random()*QUOTES.length)]} />
            <SupportBlock />
            {!isPremium&&<PremiumBlock onUpgrade={()=>setShowPremiumModal(true)} />}
            <Footer onHowToPlay={()=>setShowInstructions(true)} onAdminTap={()=>setShowAdmin(true)} />
          </div>
        )}

      </div>
    </div>
  );
}
