import { db, onUser, signIn, signOutUser, isBootstrapAdmin, getAccess, setAccess, removeAccess, importData } from "./firebase.js";

const HUB_URL = location.origin + location.pathname;
const ACCESS = [
  ["admin","Admin","Everything, including who can sign in and at what level."],
  ["content","Content manager","Edits the content calendar, plus everything a team member can do."],
  ["member","Team member","Views the calendar; manages their own tasks, chat, events, SOPs and roles."]
];
const accessLabel = a => (ACCESS.find(([k])=>k===a)||[0,"Team member"])[1];
const canContent = () => S.access === "admin" || S.access === "content";

const BRANDS = {
  FIESTA:{label:"FIESTA", c:"var(--fiesta)"},
  FoundHERs:{label:"FoundHERs", c:"var(--foundhers)"},
  Newsletter:{label:"Newsletter", c:"var(--news)"},
  Regional:{label:"Austin / Round Rock", c:"var(--regional)"}
};
const TYPES = ["Founder Spotlight","Founder WINs","Interview reel","Promotion","Event recap","Newsletter","Testimonial","Gathering carousel","Other post","Shoot","Doc / report","Task"];
const FORMATS = ["","Carousel","Reel","Story","Poster","Post"];
const hourOf = t => { if (!t) return 99; if (/evening/i.test(t)) return 19.5; const m = String(t).match(/(\d+)(?::(\d+))?\s*(AM|PM)/i); return m ? (+m[1])%12 + (/pm/i.test(m[3])?12:0) + (m[2] ? +m[2]/60 : 0) : 99; };
const addDays = (d,n) => new Date(d.getFullYear(), d.getMonth(), d.getDate()+n);
const monthName = s => parse(s).toLocaleDateString("en-US",{month:"long"});
const STATUSES = ["Idea","Drafting","In review","Scheduled","Published","Done"];
const DONE = new Set(["Published","Done"]);
const FLOW = ["Idea","Drafting","In review","Scheduled","Published"];
const slug = s => String(s||"").toLowerCase().replace(/\s+/g,"-");
const isLate = it => it.publishDate && it.publishDate < today() && !DONE.has(it.status) && it.type!=="Shoot";
const SOP_CATS = ["Event media","Video","Social","Newsletter","Reporting","Drive & files"];
const lines = s => String(s||"").split("\n").map(x=>x.trim()).filter(Boolean);
const plainName = s => String(s||"").replace(/\s*\(new\)\s*$/i,"");
function newify(text){ const isNew = /\(new\)\s*$/i.test(text||""); return [plainName(text), isNew ? h("span",{class:"pill warn", style:"margin-left:6px"},"New") : null]; }
function parseDeliv(line){
  const m = line.match(/^\s*(\d+)\s*(\/\s*pitcher)?\s*\|\s*(.+)$/i);
  return {count: m ? +m[1] : null, per: !!(m && m[2]), text: m ? m[3] : line};
}
const keyOf = s => plainName(s).toLowerCase().replace(/[^a-z0-9]+/g,"-");
const SOP_STATUS = ["Planned","Drafting","Published"];
const LINKS = [
  {key:"fiestaAustin", label:"FIESTA originals: Austin", short:"Austin"},
  {key:"fiestaRoundRock", label:"FIESTA originals: Round Rock", short:"Round Rock"},
  {key:"production", label:"Content production files", short:"folder"},
  {key:"brandKit", label:"Brand kit", short:"folder"},
  {key:"meetings", label:"Meetings", short:"folder"}
];
const DRIVE_CARDS = [
  {tag:"Originals", title:"FIESTA", desc:"Original photos and videos from Austin and Round Rock events.", keys:["fiestaAustin","fiestaRoundRock"], color:"var(--fiesta)"},
  {tag:"Production", title:"Content production", desc:"Carousels, event recaps and interview videos.", keys:["production"], color:"var(--foundhers)"},
  {tag:"Brand", title:"Brand kit", desc:"Logos, colors, fonts and templates.", keys:["brandKit"], color:"var(--regional)"},
  {tag:"Company", title:"Meetings", desc:"Meeting notes, recordings and company files. Upload them here after each meeting.", keys:["meetings"], color:"var(--news)"}
];
const VIEWS = [["mytasks","Home"],["calendar","Calendar"],["analytics","Analytics"],["events","Event org chart"],["roles","Roles"],["chat","Team chat"],["drive","Drive"],["sops","SOPs"]];
// Instagram inputs entered once a month (from Instagram Insights, month totals)
const METRICS = [
  ["igFollowers","Followers at month end"],["igShares","Shares"],["igSaves","Saves"],
  ["igProfileVisits","Profile visits"],["igLinkClicks","Bio link clicks"],["igReach","Accounts reached"]
];
const isRateKey = k => k === "igClickRate" || k === "igGrowthPct";
const AREA_LABELS = {Lead:"FIESTA leadership"};
const AREAS = ["Lead","Program","Media","Operations","After the event","Advisory"];
const ROLE_TEMPLATE = [
  ["Lead","Event lead"],["Program","MC / host"],["Program","Pitch coordinator"],["Program","Judges & speakers contact"],
  ["Media","Photographer"],["Media","Videographer"],["Media","Phone videographer"],["Media","Founder interviewer"],["Media","Editor"],["Media","Social media manager"],
  ["Operations","Venue & setup"],["Operations","Check-in"],["Operations","AV & mics"]];
const FOUNDER_STATUS = ["Not started","Interview filmed","Edited","Posted"];
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const NTH = [[1,"1st"],[2,"2nd"],[3,"3rd"],[4,"4th"],[-1,"Last"]];
function nthWeekday(y, m, nth, wd){
  if (nth === -1){ let d = new Date(y, m+1, 0); while (d.getDay()!==wd) d = new Date(d.getFullYear(), d.getMonth(), d.getDate()-1); return d; }
  let d = new Date(y, m, 1); while (d.getDay()!==wd) d = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7*(nth-1));
}
function ruleText(r){ return r ? `${(NTH.find(([n])=>n===r.nth)||[0,""])[1]} ${WEEKDAYS[r.weekday]} of every month` : "No date rule"; }
/* recurring meetups: one per series per month, plus one-off special events */
function allEvents(){
  const docs = Object.fromEntries(S.events.map(e=>[e.id, e]));
  const out = [], now = new Date();
  for (const s of S.series){
    if (!s.rule) continue;
    for (let k=-3; k<=4; k++){
      const first = new Date(now.getFullYear(), now.getMonth()+k, 1);
      const key = `${first.getFullYear()}-${pad(first.getMonth()+1)}`, id = `${s.id}-${key}`, o = docs[id] || {};
      out.push({...o, id, seriesId:s.id, recurring:true, virtual:!docs[id],
        name:`${s.name} · ${first.toLocaleDateString("en-US",{month:"long"})}`, brand:s.brand,
        date: o.date || ymd(nthWeekday(first.getFullYear(), first.getMonth(), s.rule.nth, s.rule.weekday)),
        venue: o.venue || s.venue || "", photosUrl: o.photosUrl || s.photosUrl || "", infoUrl: o.infoUrl || "", notes: o.notes || "",
        roles: s.roles || [], cancelled: !!o.cancelled});
    }
  }
  for (const e of S.events) if (!e.seriesId) out.push(e);
  return out;
}
function seriesById(id){ return S.series.find(s=>s.id===id); }
async function saveEventDoc(ev, patch){
  const ref = db.collection("events").doc(ev.id);
  if (ev.recurring && ev.virtual && !S.events.some(x=>x.id===ev.id)){
    await ref.set({seriesId:ev.seriesId, ...patch});
    S.events.push({id:ev.id, seriesId:ev.seriesId, ...patch});
  }
  else await ref.update(patch);
}

const S = {team:[], content:[], messages:[], sops:[], links:{}, events:[], series:[], founders:[], tasks:[], meetings:[], kpis:[], metric:"igReach", chartId: load("hub.chart") || "", pitchOpen:false, allowed:[], access:null, allowedSub:null, eventId: load("hub.event") || "",
  view: load("hub.view") || "mytasks", month: firstOfMonth(new Date()), meId: load("hub.me") || "",
  hidden: new Set(), dbState:"loading", showDue: load("hub.showDue")==="1", myEmail:null, drawer:null};
let chatBuilt = false;
if (!VIEWS.some(([k]) => k === S.view) && S.view !== "access") S.view = "mytasks";

/* ---------- helpers ---------- */
function load(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function save(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
function h(tag, attrs, ...kids){
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs||{})){
    if (v==null || v===false) continue;
    if (k==="class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k==="style") e.setAttribute("style", v);
    else e.setAttribute(k, v===true ? "" : v);
  }
  for (const c of kids.flat()){ if (c==null || c===false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
const pad = n => String(n).padStart(2,"0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
const today = () => ymd(new Date());
const daysUntil = s => Math.round((parse(s) - parse(today())) / 86400000);
const fmt = s => parse(s).toLocaleDateString("en-US", {weekday:"short", month:"short", day:"numeric"});
const fmtShort = s => parse(s).toLocaleDateString("en-US", {month:"short", day:"numeric"});
function firstOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function safeUrl(u){ return /^https?:\/\//i.test(u||"") ? u : null; }
function teamById(id){ return S.team.find(t => t.id===id); }
function nameOf(id){ return teamById(id)?.name || "Someone"; }
function hue(str){ let x=0; for (const ch of str||"?") x = (x*31 + ch.charCodeAt(0)) % 360; return x; }
function initials(n){ return String(n||"?").split(/\s+/).map(p=>p[0]).join("").slice(0,2).toUpperCase(); }
function avatar(t, sm){
  const n = t?.name || "?";
  if (t?.photo) return h("img",{class:"av"+(sm?" sm":""), src:t.photo, alt:"", "aria-hidden":"true"});
  return h("span",{class:"av"+(sm?" sm":""), style:`background:hsl(${hue(n)} 48% 44%)`, "aria-hidden":"true"}, initials(n)); }
async function resizeImage(file, max){
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width*s); c.height = Math.round(img.height*s);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("encode")), "image/jpeg", 0.86));
}
function brandChip(b){ const B = BRANDS[b] || {label:b||"Other", c:"var(--muted)"}; return h("span",{class:"chip", style:`--c:${B.c}`}, B.label); }
function relTime(iso){ const d = new Date(iso); const diff = (Date.now()-d)/60000;
  if (diff < 1) return "just now"; if (diff < 60) return `${Math.floor(diff)}m ago`; if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
  return d.toLocaleDateString("en-US",{month:"short", day:"numeric"}); }
function deadlinePill(item){
  if (!item.deadline) return h("span",{class:"pill"},"No deadline");
  if (DONE.has(item.status)) return h("span",{class:"pill ok"}, item.status);
  const n = daysUntil(item.deadline);
  if (n < 0) return h("span",{class:"pill bad"}, `${-n}d overdue`);
  if (n === 0) return h("span",{class:"pill bad"}, "Due today");
  if (n <= 3) return h("span",{class:"pill warn"}, `${n}d left`);
  return h("span",{class:"pill"}, `${n}d left`);
}
let toastT;
function toast(msg){ const t = document.getElementById("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(()=>t.hidden=true, 4200); }
function dbErr(e){
  if (e?.code==="permission-denied") return "You don't have permission to change this. Ask an admin.";
  if (e?.code==="quota_exceeded") return "The hub's storage is full. Delete old items, then try again.";
  if (e?.code==="revoked") return "Your access to this hub changed. Reload the page.";
  return "Couldn't save. Check your connection and try again.";
}
function myLastSeen(){ return load("hub.seen."+S.meId) || ""; }

/* ---------- mentions ---------- */
function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
function extractMentions(text){
  return S.team.filter(t => t.name && new RegExp("@"+escRe(t.name)+"(?![\\w])","i").test(text)).map(t=>t.id);
}
function richText(text){
  const names = S.team.map(t=>t.name).filter(Boolean).sort((a,b)=>b.length-a.length);
  if (!names.length) return [text];
  const re = new RegExp("(@(?:"+names.map(escRe).join("|")+"))(?![\\w])","gi");
  const out = []; let last = 0, m;
  while ((m = re.exec(text))){ out.push(text.slice(last, m.index)); out.push(h("span",{class:"mention"}, m[1])); last = m.index + m[1].length; }
  out.push(text.slice(last)); return out;
}

/* ---------- email (opens the viewer's own mail app, no server needed) ---------- */
async function sendEmail(ids, subject, body){
  const people = ids.map(teamById).filter(Boolean);
  const withMail = people.filter(p => p.email);
  const missing = people.filter(p => !p.email).map(p=>p.name);
  if (!withMail.length) return {ok:false, msg: missing.length ? `No email on file for ${missing.join(", ")}. Add it on the Roles page.` : "Nobody to email."};
  window.location.href = `mailto:${withMail.map(p=>p.email).join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  let msg = `Opened an email to ${withMail.map(p=>p.name).join(", ")} in your mail app.`;
  if (missing.length) msg += ` No email on file for ${missing.join(", ")}.`;
  return {ok:true, msg};
}

/* ---------- sign-in gate ---------- */
function showGate(kind, email){
  document.getElementById("app").hidden = true;
  document.getElementById("gate").hidden = false;
  const msg = document.getElementById("gate-msg");
  document.getElementById("gate-signin").hidden = kind !== "signin";
  document.getElementById("gate-signout").hidden = kind !== "denied";
  msg.textContent = kind === "signin" ? "Sign in with the Google account your team admin added."
    : `${email} isn't on the team list yet. Ask an admin to add this email on the Access page, then reload.`;
}
document.getElementById("gate-signin").onclick = () => signIn().catch(e => { if (e?.code !== "auth/popup-closed-by-user") toast("Sign-in didn't finish. Try again."); });
document.getElementById("gate-signout").onclick = () => signOutUser();
document.getElementById("signout").onclick = () => signOutUser();

let started = false;
onUser(async user => {
  if (!user){ showGate("signin"); return; }
  S.myEmail = (user.email || "").toLowerCase();
  S.googleName = user.displayName || "";
  S.access = isBootstrapAdmin(S.myEmail) ? "admin" : await getAccess(S.myEmail);
  if (!S.access){ showGate("denied", user.email); return; }
  document.getElementById("gate").hidden = true;
  document.getElementById("app").hidden = false;
  document.getElementById("who-email").textContent = user.email;
  document.getElementById("access-badge").textContent = accessLabel(S.access);
  if (!started){ started = true; start(); } else { renderTabs(); renderMain(); }
});

function start(){
  renderTabs(); renderHeader(); renderMain();
  S.dbState = "on"; renderMain();
  const onErr = e => { console.warn(e); if (e?.code==="permission-denied") toast(dbErr(e)); };
  db.doc("allowed/" + S.myEmail).onSnapshot(d => {
    const a = isBootstrapAdmin(S.myEmail) ? "admin" : d.exists ? (d.data().access || "member") : null;
    if (!a){ showGate("denied", S.myEmail); return; }
    if (a !== S.access){ S.access = a; document.getElementById("access-badge").textContent = accessLabel(a); renderTabs(); renderMain(); }
    if (a === "admin" && !S.allowedSub) S.allowedSub = db.collection("allowed").onSnapshot(s => { S.allowed = s.docs.map(x=>({id:x.id, ...x.data()})); renderMain(); }, onErr);
  }, onErr);
  db.collection("team").onSnapshot(s => { S.team = s.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||"")); autoMatch(); renderHeader(); renderMain(true); maybeOnboard(); }, onErr);
  db.collection("content").onSnapshot(s => { S.content = s.docs.map(d=>({id:d.id, ...d.data()})); renderMain(); }, onErr);
  db.collection("sops").onSnapshot(s => { S.sops = s.docs.map(d=>({id:d.id, ...d.data()})); renderMain(); }, onErr);
  db.collection("messages").orderBy("createdAt","desc").limit(400).onSnapshot(s => { S.messages = s.docs.map(d=>({id:d.id, ...d.data()})).reverse(); renderHeader(); updateThreads(); if (S.view!=="chat") renderMain(); }, onErr);
  db.doc("config/links").onSnapshot(d => { S.links = d.exists ? d.data() : {}; renderMain(); }, onErr);
  db.collection("events").onSnapshot(s => { S.events = s.docs.map(d=>({id:d.id, ...d.data()})); renderMain(); }, onErr);
  db.collection("series").onSnapshot(s => { S.series = s.docs.map(d=>({id:d.id, ...d.data()})); renderMain(); }, onErr);
  db.collection("tasks").onSnapshot(s => { S.tasks = s.docs.map(d=>({id:d.id, ...d.data()})); renderMain(); }, onErr);
  db.collection("meetings").onSnapshot(s => { S.meetings = s.docs.map(d=>({id:d.id, ...d.data()})); renderMain(); }, onErr);
  db.collection("kpis").onSnapshot(s => { S.kpis = s.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>a.id.localeCompare(b.id)); renderMain(); }, onErr);
}

/* ---------- analytics ---------- */
const monthLabel = (ym, long) => new Date(+ym.slice(0,4), +ym.slice(5,7)-1, 1).toLocaleDateString("en-US", long ? {month:"long", year:"numeric"} : {month:"short"});
const isRate = isRateKey;
const fmtNum = (k, v) => v==null ? "—" : isRate(k) ? `${v}%` : Math.round(v).toLocaleString("en-US");
const fmtAxis = (k, v) => isRate(k) ? `${Math.round(v)}%` : Math.abs(v) >= 1000 ? `${(v/1000).toFixed(v>=10000?0:1)}K` : String(Math.round(v));
function delta(k, cur, prev){
  if (cur==null || prev==null) return null;
  if (isRate(k)) { const d = +(cur - prev).toFixed(1); return {up:d>=0, text:`${d>=0?"+":""}${d} pts`}; }
  if (!prev) return null;
  const p = (cur - prev) / prev * 100; return {up:p>=0, text:`${p>=0?"+":""}${p.toFixed(1)}%`};
}
// single-series line: 2px line, 8px markers, recessive grid, crosshair + tooltip on hover
function lineChart(rows, key, size){
  const pts = rows.filter(r => typeof r[key] === "number");
  if (pts.length < 2) return h("div",{class:"empty"},"Add at least two months of numbers to see a trend.");
  const W = size?.w || 680, H = size?.h || 240, L = 46, R = 14, T = 16, B = 30;
  const vals = pts.map(p => p[key]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi){ lo -= 1; hi += 1; }
  const padv = (hi - lo) * 0.15; lo = lo < 0 ? lo - padv : Math.max(0, lo - padv); hi += padv;
  const x = i => L + (W - L - R) * (i / (pts.length - 1));
  const y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const ticks = [0,1,2,3].map(i => lo + (hi - lo) * i / 3);
  const path = pts.map((p,i) => `${i?"L":"M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const area = `${path} L${x(pts.length-1).toFixed(1)},${H-B} L${x(0).toFixed(1)},${H-B} Z`;
  const wrap = h("div",{class:"lc"});
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Monthly trend">
    ${ticks.map(t => `<line x1="${L}" x2="${W-R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" class="lc-grid"/><text x="${L-8}" y="${(y(t)+4).toFixed(1)}" text-anchor="end" class="lc-axis">${fmtAxis(key,t)}</text>`).join("")}
    ${pts.map((p,i) => `<text x="${x(i).toFixed(1)}" y="${H-10}" text-anchor="middle" class="lc-axis">${monthLabel(p.id)}</text>`).join("")}
    <path d="${area}" class="lc-area"/><path d="${path}" class="lc-line"/>
    ${pts.map((p,i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p[key]).toFixed(1)}" r="${i===pts.length-1?5:4}" class="lc-dot${i===pts.length-1?" end":""}"/>`).join("")}
    <line class="lc-cross" y1="${T}" y2="${H-B}" x1="0" x2="0" visibility="hidden"/>
    <rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" fill="transparent" class="lc-hit"/></svg>`;
  const tip = h("div",{class:"lc-tip", hidden:true}); wrap.append(tip);
  const svg = wrap.querySelector("svg"), cross = wrap.querySelector(".lc-cross");
  const move = ev => {
    const r = svg.getBoundingClientRect(), sx = (ev.clientX - r.left) * W / r.width;
    const i = Math.max(0, Math.min(pts.length-1, Math.round((sx - L) / ((W - L - R) / (pts.length - 1)))));
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility","visible");
    tip.replaceChildren(h("div",{class:"small muted"}, monthLabel(pts[i].id, true)), h("b",{}, fmtNum(key, pts[i][key])));
    tip.hidden = false;
    const px = x(i) * r.width / W;
    tip.style.left = Math.min(Math.max(px, 60), r.width - 60) + "px"; tip.style.top = (y(pts[i][key]) * r.height / H) + "px";
  };
  svg.querySelector(".lc-hit").addEventListener("pointermove", move);
  svg.querySelector(".lc-hit").addEventListener("pointerleave", () => { tip.hidden = true; cross.setAttribute("visibility","hidden"); });
  return wrap;
}
// month rows plus the three KPIs worked out from them
function kpiRows(){
  const rows = (S.kpis || []).map(r => ({...r}));
  rows.forEach((r, i) => {
    const p = rows[i-1];
    if (p && r.igFollowers != null && p.igFollowers != null){
      r.igGrowth = r.igFollowers - p.igFollowers;
      r.igGrowthPct = p.igFollowers ? +((r.igGrowth / p.igFollowers) * 100).toFixed(1) : null;
    }
    if (r.igLinkClicks != null && r.igProfileVisits) r.igClickRate = +((r.igLinkClicks / r.igProfileVisits) * 100).toFixed(1);
  });
  return rows;
}
const signed = v => v == null ? "—" : `${v > 0 ? "+" : ""}${Math.round(v).toLocaleString("en-US")}`;
function viewAnalytics(){
  const rows = kpiRows();
  const idx = Math.max(0, rows.findIndex(r => r.id === S.kpiMonth) >= 0 ? rows.findIndex(r => r.id === S.kpiMonth) : rows.length - 1);
  const cur = rows[idx], prev = rows[idx-1];
  const vs = prev ? ` vs ${monthLabel(prev.id)}` : "";
  const change = (k) => { const d = cur && prev ? delta(k, cur[k], prev[k]) : null; return d ? h("div",{class:"kpi-d "+(d.up?"up":"down")}, `${d.up?"▲":"▼"} ${d.text}${vs}`) : h("div",{class:"kpi-d muted"}, prev ? "Not enough data to compare" : "First month: nothing to compare yet"); };
  const kpi = (n, title, why, big, unit, sub, d) => h("section",{class:"card kpi"},
    h("div",{class:"kpi-h"}, h("span",{class:"kpi-n"}, n), h("h3",{}, title)),
    h("p",{class:"kpi-why"}, why),
    h("div",{class:"kpi-big"}, big, h("span",{class:"kpi-unit"}, unit)),
    sub ? h("div",{class:"kpi-sub"}, sub) : null, d);
  const growthD = cur?.igGrowth != null && prev?.igGrowth != null
    ? h("div",{class:"kpi-d "+(cur.igGrowth >= prev.igGrowth ? "up" : "down")}, `${cur.igGrowth >= prev.igGrowth ? "▲" : "▼"} ${signed(cur.igGrowth)} vs ${signed(prev.igGrowth)} in ${monthLabel(prev.id)}`)
    : h("div",{class:"kpi-d muted"}, "Needs followers for this month and the two before it to compare growth");
  const ym = cur ? cur.id : `${S.month.getFullYear()}-${pad(S.month.getMonth()+1)}`;
  const posts = S.content.filter(c => (c.publishDate||"").slice(0,7) === ym && c.type !== "Shoot");
  const published = posts.filter(c => DONE.has(c.status)).length;
  const monthPick = rows.length ? h("select",{"aria-label":"Month", onchange:ev=>{ S.kpiMonth = ev.target.value; renderMain(); }},
    ...rows.slice().reverse().map(r => { const o = h("option",{value:r.id}, monthLabel(r.id, true)); if (r.id === cur?.id) o.selected = true; return o; })) : null;
  return [
    h("div",{class:"spread"}, h("div",{}, h("div",{class:"eyebrow"},"Analytics · Instagram"), h("h2",{}, cur ? `Monthly KPIs · ${monthLabel(cur.id, true)}` : "Monthly KPIs")),
      h("div",{class:"row"}, monthPick, canContent() ? h("button",{class:"btn primary", type:"button", onclick:()=>openKpi(null)},"+ Add a month") : null)),
    h("p",{class:"small muted", style:"margin:-12px 0 0"},"Our baseline for judging content experiments: growth, shares and conversion, not just views or likes. Enter numbers from Instagram Insights after each month closes."),
    rows.length ? null : h("div",{class:"panel empty"},"No months entered yet. Click “+ Add a month” and fill in last month's numbers from Instagram Insights."),
    cur ? h("div",{class:"kpis"},
      kpi("1","Growth","Month-over-month follower growth.",
        signed(cur.igGrowth), " new followers",
        cur.igFollowers != null ? `${cur.igGrowthPct != null ? (cur.igGrowthPct > 0 ? "+" : "") + cur.igGrowthPct + "% · " : ""}${fmtNum("igFollowers", cur.igFollowers)} followers` : null, growthD),
      kpi("2","Shares","How often content is shared. Shares and saves push organic distribution.",
        fmtNum("igShares", cur.igShares), " shares", cur.igSaves != null ? `${fmtNum("igSaves", cur.igSaves)} saves` : null, change("igShares")),
      kpi("3","Conversion","Bio link activity that moves people from Instagram to the FIESTA website.",
        fmtNum("igLinkClicks", cur.igLinkClicks), " link clicks",
        cur.igClickRate != null ? `${cur.igClickRate}% of ${fmtNum("igProfileVisits", cur.igProfileVisits)} profile visits` : null, change("igLinkClicks"))) : null,
    rows.length >= 2 ? h("div",{class:"kpis"},
      ...[["igGrowth","Growth · new followers"],["igShares","Shares"],["igLinkClicks","Conversion · link clicks"]].map(([k, t]) =>
        h("section",{class:"card", style:"padding-bottom:12px"}, h("div",{class:"card-h"}, h("h3",{}, t)), h("div",{style:"padding:0 12px"}, lineChart(rows, k, {w:340, h:190}))))) : null,
    cur ? h("div",{class:"dash"},
      card(`Experiments · ${monthLabel(cur.id, true)}`, canContent() ? h("button",{class:"link", type:"button", onclick:()=>openKpi(cur.id)},"Edit") : null,
        h("div",{class:"exp"},
          h("div",{}, h("div",{class:"eyebrow"},"What we tested"), h("p",{}, cur.experiment || "Nothing logged. Note new formats here, like “Founder Q&A reels on Thursdays.”")),
          h("div",{}, h("div",{class:"eyebrow"},"What we learned / try next"), h("p",{}, cur.notes || "—")))),
      card("Posting this month", h("button",{class:"link", type:"button", onclick:()=>{ S.month = new Date(+ym.slice(0,4), +ym.slice(5,7)-1, 1); setView("calendar"); }},"Open calendar"),
        h("div",{class:"mini-kpi"}, h("div",{class:"stat-n"}, `${published} / ${posts.length}`), h("div",{class:"stat-l"},"posts published / planned"),
          cur.igReach != null ? h("div",{class:"small muted"}, `${fmtNum("igReach", cur.igReach)} accounts reached`) : null))) : null,
    rows.length ? h("section",{}, h("div",{class:"group-h"}, h("h3",{},"All months")),
      h("div",{class:"panel kpi-scroll"}, h("table",{class:"plan-table kpi-table"},
        h("thead",{}, h("tr",{}, ...["Month","Followers","Growth","Growth %","Shares","Saves","Profile visits","Link clicks","Click rate","Reach"].map(x => h("th",{}, x)), canContent() ? h("th",{},"") : null)),
        h("tbody",{}, ...rows.slice().reverse().map(r => h("tr",{},
          h("td",{}, h("b",{}, monthLabel(r.id, true))),
          h("td",{class:"mono"}, fmtNum("igFollowers", r.igFollowers)), h("td",{class:"mono"}, signed(r.igGrowth)),
          h("td",{class:"mono"}, r.igGrowthPct == null ? "—" : `${r.igGrowthPct}%`),
          h("td",{class:"mono"}, fmtNum("igShares", r.igShares)), h("td",{class:"mono"}, fmtNum("igSaves", r.igSaves)),
          h("td",{class:"mono"}, fmtNum("igProfileVisits", r.igProfileVisits)), h("td",{class:"mono"}, fmtNum("igLinkClicks", r.igLinkClicks)),
          h("td",{class:"mono"}, r.igClickRate == null ? "—" : `${r.igClickRate}%`), h("td",{class:"mono"}, fmtNum("igReach", r.igReach)),
          canContent() ? h("td",{}, h("button",{class:"btn sm ghost", type:"button", onclick:()=>openKpi(r.id)},"Edit")) : null)))))) : null,
    h("p",{class:"small muted", style:"margin:0"},"LinkedIn and Mailchimp can be added here later in the same format.")
  ];
}
function openKpi(id){
  const r = id ? (S.kpis||[]).find(x=>x.id===id) : {};
  const now = new Date(), prevMonth = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const month = h("input",{type:"month", id:"kp-month"}); month.value = id || `${prevMonth.getFullYear()}-${pad(prevMonth.getMonth()+1)}`; month.disabled = !!id;
  const hints = {igFollowers:"Profile → follower count on the last day of the month", igShares:"Insights → Interactions → Shares", igSaves:"Insights → Interactions → Saves",
    igProfileVisits:"Insights → Profile activity → Profile visits", igLinkClicks:"Insights → Profile activity → External link taps", igReach:"Insights → Accounts reached (optional)"};
  const inputs = METRICS.map(([k,l]) => { const i = h("input",{type:"text", inputmode:"numeric", id:"kp-"+k, placeholder:"e.g. 1250"}); i.value = r[k]==null ? "" : String(r[k]); return [k,l,i]; });
  const exp = h("textarea",{id:"kp-exp", rows:"2", placeholder:"New formats or ideas tried this month"}); exp.value = r.experiment || "";
  const notes = h("textarea",{id:"kp-notes", rows:"3", placeholder:"What the numbers say, and what to try next month"}); notes.value = r.notes || "";
  const status = h("div",{class:"cmp-status"});
  openDrawer(id ? `Instagram · ${monthLabel(id, true)}` : "Add a month", [
    h("p",{class:"small muted", style:"margin:0"},"Use month totals from Instagram Insights (set the date range to that month)."),
    h("div",{class:"fields"}, h("div",{class:"field full"}, h("label",{for:"kp-month"},"Month"), month),
      ...inputs.map(([k,l,i]) => h("div",{class:"field"}, h("label",{for:i.id}, l), i, h("span",{class:"small muted"}, hints[k]))),
      h("div",{class:"field full"}, h("label",{for:"kp-exp"},"What we tested"), exp),
      h("div",{class:"field full"}, h("label",{for:"kp-notes"},"What we learned / try next"), notes)),
    h("div",{class:"d-actions"}, id ? deleteButton(async()=>{ await db.collection("kpis").doc(id).delete(); }, status) : h("span",{}),
      h("button",{class:"btn primary", type:"button", onclick:async()=>{
        if (!/^\d{4}-\d{2}$/.test(month.value)){ status.textContent = "Pick a month."; return; }
        const data = {month:month.value, experiment:exp.value.trim(), notes:notes.value.trim(), updatedAt:new Date().toISOString()};
        for (const [k,l,i] of inputs){
          const v = i.value.replace(/[,\s]/g,"");
          if (v === "") continue;
          if (isNaN(+v)){ status.textContent = `${l} needs a number.`; return; }
          data[k] = +v;
        }
        try{ await db.collection("kpis").doc(month.value).set(data); S.kpiMonth = month.value; closeDrawer(); toast("Saved."); }catch(e){ status.textContent = dbErr(e); }
      }},"Save"))
  ]);
}

// first sign-in: ask for a display name and link the account to a teammate card
function maybeOnboard(){
  if (S.onboardShown || !S.myEmail) return;
  if (S.team.some(t => (t.email||"").toLowerCase() === S.myEmail)) return;
  S.onboardShown = true;
  const name = h("input",{type:"text", id:"ob-name", placeholder:"First and last name, e.g. Esther Ko"}); name.value = S.googleName;
  const open = S.team.filter(t => !t.email);
  const who = h("select",{id:"ob-who"}, h("option",{value:""},"I'm not on the list: add me"), ...open.map(t => h("option",{value:t.id}, t.name + (t.role ? " · " + t.role : ""))));
  const guessFrom = v => { const f = (v.trim().split(/\s+/)[0]||"").toLowerCase(); const g = open.find(t => (t.name||"").toLowerCase().split(/\s+/)[0] === f); if (g) who.value = g.id; };
  guessFrom(name.value);
  name.addEventListener("change", () => { if (!who.value) guessFrom(name.value); });
  const status = h("div",{class:"cmp-status"});
  openDrawer("Welcome to FIESTA Hub", [
    h("p",{style:"margin:0"},"What should we call you? Teammates see this name in the top bar, on the team page and when they @mention you."),
    h("div",{class:"fields"},
      h("div",{class:"field full"}, h("label",{for:"ob-name"},"Your name"), name),
      h("div",{class:"field full"}, h("label",{for:"ob-who"},"Which team card is yours?"), who)),
    h("p",{class:"small muted", style:"margin:0"},"Picking your card links it to this Google account, so your tasks and deadlines find you."),
    h("div",{class:"d-actions"}, h("button",{class:"btn ghost", type:"button", onclick:closeDrawer},"Later"),
      h("button",{class:"btn primary", type:"button", onclick:async()=>{
        const n = name.value.trim(); if (!n){ status.textContent = "Add your name."; return; }
        try{
          let id = who.value;
          if (id) await db.collection("team").doc(id).update({name:n, email:S.myEmail});
          else id = (await db.collection("team").add({name:n, email:S.myEmail, role:"", duties:"", group:"", photo:""})).id;
          S.meId = id; save("hub.me", id);
          closeDrawer(); toast(`Welcome, ${n}!`); renderHeader(); renderMain();
        }catch(e){ status.textContent = dbErr(e); }
      }},"Save")),
    status
  ]);
}
// the signed-in Google email decides who you are
function autoMatch(){
  if (!S.myEmail) return;
  const hit = S.team.find(t => (t.email||"").toLowerCase() === S.myEmail);
  if (hit){ if (hit.id !== S.meId){ S.meId = hit.id; save("hub.me", hit.id); } return; }
  const viaAccess = S.allowed.find(a => a.id === S.myEmail)?.teamId;
  if (viaAccess && teamById(viaAccess)){ S.meId = viaAccess; save("hub.me", viaAccess); }
}

/* ---------- header ---------- */
// line icons, 24px grid, drawn with currentColor
const ICONS = {
  mytasks:"M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  calendar:"M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  analytics:"M3 3v18h18M7 15l4-4 3 3 6-6",
  events:"M10 3h4v4h-4zM12 7v4M5 15v-4h14v4M3 15h4v5H3zM17 15h4v5h-4zM10 15h4v5h-4zM12 11v4",
  roles:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  chat:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  drive:"M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  sops:"M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5",
  access:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  logout:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  bell:"M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"
};
function icon(name){
  const s = document.createElement("span"); s.className = "ic"; s.setAttribute("aria-hidden","true");
  s.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[name]||""}"/></svg>`;
  return s;
}
document.querySelectorAll("[data-icon]").forEach(el => el.replaceWith(icon(el.dataset.icon)));
function navItem([k,l]){
  return h("button",{class:"nav-item", role:"tab", type:"button", "aria-selected": String(S.view===k), onclick:()=>{ if (k==="sops") S.sopOpen = ""; setView(k); }}, icon(k), l);
}
function renderTabs(){
  document.getElementById("tabs").replaceChildren(...VIEWS.map(navItem));
  document.getElementById("tabs-foot").replaceChildren(...(S.access==="admin" ? [navItem(["access","Access"])] : []));
}
function setView(k){ S.view = k; save("hub.view", k); chatBuilt = false; renderTabs(); renderMain(); document.querySelector(".content")?.scrollTo?.(0,0); window.scrollTo(0,0); }
function renderHeader(){
  const n = notifications(), seen = myLastSeen();
  const count = n.filter(x => x.sticky || (x.at||"") > seen).length;
  const b = document.getElementById("bell-count"); b.textContent = count; b.hidden = !count;
  const me = teamById(S.meId);
  document.getElementById("tb-name").textContent = me ? me.name : (S.myEmail || "");
  document.getElementById("tb-avatar").replaceChildren(avatar(me || {name:S.myEmail||"?"}));
  document.getElementById("tb-date").textContent = new Date().toLocaleDateString("en-US",{weekday:"long", month:"long", day:"numeric"});
}
function myMentions(){ return S.meId ? S.messages.filter(m => (m.mentions||[]).includes(S.meId) && m.authorId !== S.meId) : []; }
// one feed: what needs you now (sticky) + what happened (mentions, new tasks)
function notifications(){
  if (!S.meId) return [];
  const out = [];
  const mine = S.content.filter(c => itemOwners(c).includes(S.meId) && !DONE.has(c.status));
  for (const c of mine.filter(c => c.deadline && daysUntil(c.deadline) <= 2)){
    const d = daysUntil(c.deadline);
    out.push({sticky:true, tone: d<0 ? "bad" : "warn", label: d<0 ? `${-d}d overdue` : d===0 ? "Due today" : `Due ${fmtShort(c.deadline)}`, text:c.title, go:()=>openItem(c.id)});
  }
  for (const c of mine.filter(c => c.needsReview)) out.push({sticky:true, tone:"warn", label:"Review", text:c.title, go:()=>openItem(c.id)});
  for (const m of myMentions()){
    const item = m.thread!=="general" ? S.content.find(c=>c.id===m.thread) : null;
    out.push({at:m.createdAt, label:`${nameOf(m.authorId)} mentioned you` + (item ? ` on “${item.title}”` : " in chat"), text:m.text, go:()=> item ? openItem(item.id) : setView("chat")});
  }
  for (const t of S.tasks.filter(t => t.ownerId===S.meId && !t.done && t.createdBy && t.createdBy!==S.meId))
    out.push({at:t.createdAt, label:`New task from ${nameOf(t.createdBy)}`, text:t.text + (t.due ? ` · due ${fmtShort(t.due)}` : ""), go:()=>setView("mytasks")});
  return out;
}
document.getElementById("bell").onclick = () => {
  const p = document.getElementById("notif");
  if (!p.hidden){ p.hidden = true; return; }
  const seen = myLastSeen(), n = notifications();
  const now = n.filter(x=>x.sticky);
  const recent = n.filter(x=>!x.sticky).sort((a,b)=>(b.at||"").localeCompare(a.at||"")).slice(0, 25);
  const row = x => h("button",{class:"n-item"+(!x.sticky && (x.at||"")>seen ? " unread" : ""), type:"button", onclick:()=>{ p.hidden = true; x.go(); }},
    h("div",{class:"small"}, x.sticky ? h("span",{class:"pill "+x.tone, style:"margin-right:6px"}, x.label) : h("b",{}, x.label), x.at ? h("span",{class:"mono muted"}, " · "+relTime(x.at)) : null),
    h("div",{class:"small muted", style:"margin-top:2px"}, x.text.length>140 ? x.text.slice(0,140)+"…" : x.text));
  p.replaceChildren(
    h("div",{class:"d-head"}, h("h3",{},"Notifications"), h("button",{class:"btn ghost sm", type:"button", onclick:()=>p.hidden=true},"Close")),
    !S.meId ? h("div",{class:"empty"},"Ask an admin to put your sign-in email on your Roles card so notifications can find you.")
    : !n.length ? h("div",{class:"empty"},"You're all caught up.")
    : h("div",{}, now.length ? h("div",{class:"ev-group"},"Needs you") : null, ...now.map(row), recent.length ? h("div",{class:"ev-group"},"Recent") : null, ...recent.map(row))
  );
  p.hidden = false;
  if (S.meId && recent.length){ save("hub.seen."+S.meId, recent[0].at); renderHeader(); }
};

/* ---------- main ---------- */
function renderMain(teamChanged){
  const main = document.getElementById("main");
  if (S.view==="chat" && chatBuilt && !teamChanged){ updateThreads(); return; }
  const banner = S.dbState==="off" ? h("div",{class:"notice"},"Couldn't reach the team's data. Check your connection and reload.")
    : S.dbState==="loading" ? h("div",{class:"notice muted"},"Loading the team's calendar…") : null;
  const views = {mytasks:viewMyTasks, calendar:viewCalendar, analytics:viewAnalytics, events:viewEvents, roles:viewRoles, chat:viewChat, drive:viewDrive, sops:viewSops, access:viewAccess};
  main.replaceChildren(...[banner, ...(views[S.view]||viewCalendar)()].filter(Boolean));
  if (S.view==="chat"){ chatBuilt = true; updateThreads(); }
}
function visibleContent(){ return S.content.filter(c => !S.hidden.has(c.brand)); }
function legend(){
  return h("div",{class:"legend"}, ...Object.entries(BRANDS).map(([k,B]) =>
    h("button",{class:"chip", type:"button", style:`--c:${B.c}`, "aria-pressed": String(!S.hidden.has(k)), title:"Show or hide "+B.label,
      onclick:()=>{ S.hidden.has(k) ? S.hidden.delete(k) : S.hidden.add(k); renderMain(); }}, B.label)));
}

function viewCalendar(){
  const m = S.month, y = m.getFullYear(), mo = m.getMonth();
  const start = new Date(y, mo, 1 - m.getDay());
  const items = visibleContent();
  const byPub = {}, byDue = {}, byEv = {};
  for (const it of items){
    if (it.publishDate) (byPub[it.publishDate] ||= []).push(it);
    if (S.showDue && it.deadline && it.deadline !== it.publishDate && !DONE.has(it.status)) (byDue[it.deadline] ||= []).push(it);
  }
  for (const e of allEvents()) if (e.date && !e.cancelled && !S.hidden.has(e.brand)) (byEv[e.date] ||= []).push(e);
  for (const k in byPub) byPub[k].sort((a,b)=>hourOf(a.time)-hourOf(b.time));
  const cells = [];
  for (const d of ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]) cells.push(h("div",{class:"dow"}, d));
  const weeks = Math.ceil((m.getDay() + new Date(y, mo+1, 0).getDate())/7);
  for (let i=0; i<weeks*7; i++){
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate()+i), key = ymd(d);
    cells.push(h("div",{class:"day"+(d.getMonth()!==mo?" out":"")+(key===today()?" today":"")},
      h("span",{class:"dnum"}, d.getDate()),
      ...(byEv[key]||[]).map(e => h("button",{class:"ev meet", type:"button", style:`--c:${(BRANDS[e.brand]||{}).c||"var(--muted)"}`, title:e.name, onclick:()=>{ if (e.seriesId){ S.chartId = e.seriesId; save("hub.chart", e.seriesId); } setView("events"); }}, h("span",{class:"k"},"event"), e.recurring ? (seriesById(e.seriesId)?.name || e.name) : e.name)),
      ...(byPub[key]||[]).map(it => h("button",{class:`ev st-${slug(it.status)}`+(it.needsReview?" review":"")+(isLate(it)?" late":""), type:"button", style:`--c:${(BRANDS[it.brand]||{}).c||"var(--muted)"}`, title:`${it.title} · ${it.status}${it.deadline?" · due "+fmtShort(it.deadline):""}${it.needsReview?" · needs review":""}${isLate(it)?" · past its date, not published":""}`, onclick:()=>openItem(it.id)}, h("span",{class:"k"}, (it.status==="Published"?"✓ ":"") + (it.time || (it.type==="Shoot"?"shoot":"post"))), it.title)),
      ...(byDue[key]||[]).map(it => h("button",{class:"ev due", type:"button", style:`--c:${(BRANDS[it.brand]||{}).c||"var(--muted)"}`, title:"Due: "+it.title, onclick:()=>openItem(it.id)}, h("span",{class:"k"},"due"), it.title))
    ));
  }
  const inMonth = items.filter(c => (c.publishDate||"").slice(0,7) === `${y}-${pad(mo+1)}`);
  const lateN = inMonth.filter(isLate).length;
  const stKey = h("div",{class:"st-key"}, h("span",{class:"muted"},"This month:"),
    ...FLOW.map(s => [s, inMonth.filter(c=>c.status===s).length]).filter(([,n])=>n).map(([s,n]) => h("span",{class:"st-chip st-"+slug(s)}, `${s} ${n}`)),
    lateN ? h("span",{class:"st-chip late"}, `${lateN} past date, not published`) : null,
    inMonth.length ? null : h("span",{class:"muted"},"nothing scheduled"));
  return [
    h("div",{class:"spread"},
      h("div",{class:"cal-head"},
        h("span",{class:"cal-title"}, m.toLocaleDateString("en-US",{month:"long", year:"numeric"})),
        h("button",{class:"btn sm", type:"button", "aria-label":"Previous month", onclick:()=>{S.month = new Date(y, mo-1, 1); renderMain();}},"←"),
        h("button",{class:"btn sm", type:"button", onclick:()=>{S.month = firstOfMonth(new Date()); renderMain();}},"Today"),
        h("button",{class:"btn sm", type:"button", "aria-label":"Next month", onclick:()=>{S.month = new Date(y, mo+1, 1); renderMain();}},"→")),
      canContent() ? h("div",{class:"row"}, h("button",{class:"btn", type:"button", onclick:()=>openPlanner(null)},"Plan a month: FIESTA & FoundHERs"),
        h("button",{class:"btn primary", type:"button", onclick:()=>openItem(null)},"+ New item"))
        : h("span",{class:"small muted"},"View only. Content managers and admins edit the calendar.")),
    h("div",{class:"spread", style:"align-items:center"}, legend(),
      h("button",{class:"btn sm", type:"button", "aria-pressed": String(S.showDue), onclick:()=>{ S.showDue = !S.showDue; save("hub.showDue", S.showDue?"1":"0"); renderMain(); }}, S.showDue ? "Hide deadlines" : "Show deadlines on calendar")),
    stKey,
    items.some(c=>c.needsReview) ? h("div",{class:"notice"}, h("b",{}, items.filter(c=>c.needsReview).length + " drafted posts need review. "), "They have an amber outline. Open one, fix anything that's off, and click “Looks good.”") : null,
    h("div",{class:"panel cal-scroll"}, h("div",{class:"cal"}, cells)),
    h("p",{class:"small muted", style:"margin:-10px 0 0"},"Faded = in progress. Tinted = scheduled. Solid with ✓ = published. Red outline = date passed, not published. Dark = meetup. Click any post for its deadline, content and finished file."),
    ...deadlineSections()
  ];
}

function itemRow(it){
  const owners = itemOwners(it).map(nameOf).join(", ");
  return h("button",{class:"item", type:"button", onclick:()=>openItem(it.id)},
    brandChip(it.brand),
    h("div",{style:"min-width:0"}, h("div",{class:"t"}, it.title), h("div",{class:"meta"}, [it.type, it.status, owners].filter(Boolean).join(" · "))),
    h("div",{class:"when"}, it.deadline ? h("span",{class:"mono"}, fmtShort(it.deadline)) : null, deadlinePill(it)));
}

function deadlineSections(){
  const open = visibleContent().filter(c => !DONE.has(c.status));
  const dated = open.filter(c=>c.deadline).sort((a,b)=>a.deadline.localeCompare(b.deadline));
  const overdue = dated.filter(c=>daysUntil(c.deadline)<0);
  const week = dated.filter(c=>{ const n = daysUntil(c.deadline); return n>=0 && n<=7; });
  const later = dated.filter(c=>daysUntil(c.deadline)>7), none = open.filter(c=>!c.deadline);
  const block = (label, list, empty) => h("section",{}, h("div",{class:"group-h"}, h("h3",{}, label), h("span",{class:"count"}, list.length)),
    h("div",{class:"panel list"}, list.length ? list.map(itemRow) : h("div",{class:"empty"}, empty)));
  const fold = (label, list) => list.length ? h("details",{class:"panel fold"}, h("summary",{}, label, h("span",{class:"count"}, " " + list.length)), h("div",{class:"list"}, ...list.map(itemRow))) : null;
  return [
    h("div",{class:"dl-head"}, h("div",{class:"eyebrow"},"Deadlines"), h("h2",{},"What's due, soonest first")),
    overdue.length ? block("Overdue", overdue, "") : null,
    block("Next 7 days", week, "Nothing due in the next 7 days."),
    fold("Later", later),
    fold("No deadline set", none)
  ];
}

/* ---------- threads ---------- */
function threadList(thread){ return h("div",{class:"thread", "data-thread":thread}); }
function updateThreads(){
  document.querySelectorAll("[data-thread]").forEach(el => {
    const t = el.dataset.thread;
    const msgs = S.messages.filter(m => m.thread===t);
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    el.replaceChildren(...(msgs.length ? msgs.map(m => {
      const author = teamById(m.authorId);
      return h("div",{class:"msg"}, avatar(author),
        h("div",{style:"min-width:0"},
          h("div",{}, h("span",{class:"who"}, author?.name || "Someone"), h("span",{class:"ts"}, relTime(m.createdAt))),
          h("div",{class:"body"}, ...richText(m.text||""))));
    }) : [h("div",{class:"empty"}, t==="general" ? "No messages yet. Say hi to the team, or @mention someone to get their attention." : "No comments yet. @mention a teammate to ask for a review or a file.")]));
    if (nearBottom) el.scrollTop = el.scrollHeight;
  });
}
function composer(thread, ctxTitle){
  const ta = h("textarea",{id:"cmp-"+thread, rows:"2", "aria-label":"Message", placeholder: thread==="general" ? "Message the media team. Type @ to mention someone." : "Comment on this item. Type @ to mention someone."});
  const menu = h("div",{class:"mention-menu", role:"listbox", hidden:true});
  const mail = h("input",{type:"checkbox", id:"cmp-mail-"+thread}); mail.checked = false;
  const status = h("div",{class:"cmp-status", "aria-live":"polite"});
  const send = h("button",{class:"btn primary sm", type:"button"},"Send");
  let matches = [], active = 0, tokenStart = -1;
  const close = () => { menu.hidden = true; tokenStart = -1; };
  function update(){
    const pos = ta.selectionStart, before = ta.value.slice(0,pos);
    const m = before.match(/(^|\s)@([^\s@]*)$/);
    if (!m){ close(); return; }
    tokenStart = pos - m[2].length - 1;
    const q = m[2].toLowerCase();
    matches = S.team.filter(t => (t.name||"").toLowerCase().includes(q)).slice(0,6);
    if (!matches.length){ close(); return; }
    active = Math.min(active, matches.length-1);
    menu.replaceChildren(...matches.map((t,i) => h("button",{class:"mention-opt"+(i===active?" on":""), type:"button", role:"option", onmousedown:e=>{e.preventDefault(); pick(i);}},
      avatar(t,true), h("span",{}, t.name), h("span",{class:"muted small"}, t.role||""))));
    menu.hidden = false;
  }
  function pick(i){
    const t = matches[i]; if (!t) return;
    const pos = ta.selectionStart;
    ta.value = ta.value.slice(0,tokenStart) + "@" + t.name + " " + ta.value.slice(pos);
    const np = tokenStart + t.name.length + 2; ta.setSelectionRange(np,np); close(); ta.focus();
  }
  async function doSend(){
    const text = ta.value.trim(); if (!text) return;
    if (!S.meId){ toast("Choose your name at the top first, so the team knows who wrote this."); return; }
    if (!db){ toast("The hub's shared data isn't available in this view."); return; }
    const mentions = extractMentions(text);
    send.disabled = true; status.textContent = "";
    try{ await db.collection("messages").add({thread, text, authorId:S.meId, mentions, createdAt:new Date().toISOString()}); ta.value = ""; }
    catch(e){ status.textContent = dbErr(e); send.disabled = false; return; }
    send.disabled = false;
    const others = mentions.filter(id => id!==S.meId);
    if (others.length && mail.checked){
      status.textContent = "Emailing…";
      const me = nameOf(S.meId), ctx = ctxTitle ? ctxTitle() : "";
      const r = await sendEmail(others, `${me} mentioned you in FIESTA Media Hub`,
        `${me} mentioned you ${ctx ? `on "${ctx}"` : "in team chat"}:\n\n${text}\n\n` + (HUB_URL ? `Open the hub: ${HUB_URL}` : "Open FIESTA Media Hub to reply."));
      status.textContent = r.msg;
    } else if (others.length) status.textContent = `${others.map(nameOf).join(", ")} will see this in Mentions.`;
  }
  ta.addEventListener("input", () => { active = 0; update(); });
  ta.addEventListener("click", update);
  ta.addEventListener("blur", () => setTimeout(close, 150));
  ta.addEventListener("keydown", e => {
    if (!menu.hidden){
      if (e.key==="ArrowDown"){ e.preventDefault(); active = (active+1)%matches.length; update(); return; }
      if (e.key==="ArrowUp"){ e.preventDefault(); active = (active-1+matches.length)%matches.length; update(); return; }
      if (e.key==="Enter" || e.key==="Tab"){ e.preventDefault(); pick(active); return; }
      if (e.key==="Escape"){ e.preventDefault(); close(); return; }
    }
    if (e.key==="Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); doSend(); }
  });
  send.onclick = doSend;
  return h("div",{class:"composer"}, menu, ta,
    h("div",{class:"cmp-foot"}, h("label",{for:"cmp-mail-"+thread}, mail, "Also open an email to people I @mention"), send), status);
}

function viewChat(){
  return [
    h("div",{}, h("div",{class:"eyebrow"},"Team chat"), h("h2",{},"Media team channel")),
    h("p",{class:"small muted", style:"margin:-12px 0 0"},"Type @ to tag someone. They get it in their Mentions list, and by email when they have one on the Team tab. Questions about one post go in that post's own thread on the calendar."),
    h("div",{class:"panel chat"}, threadList("general"), composer("general"))
  ];
}

/* ---------- drive ---------- */
function viewDrive(){
  return [
    h("div",{class:"spread"}, h("div",{}, h("div",{class:"eyebrow"},"Google Drive"), h("h2",{},"Team folders")),
      h("button",{class:"btn", type:"button", onclick:openLinks},"Edit folder links")),
    h("p",{class:"small muted", style:"margin:-12px 0 0"},"Shortcuts to the team's shared Google Drive folders. Upload files in Drive; these open the right folder."),
    h("div",{class:"drive-grid"}, ...DRIVE_CARDS.map(c => h("div",{class:"panel drive-card", style:`--c:${c.color}`},
      h("div",{class:"dc-tag"}, c.tag),
      h("h3",{}, c.title), h("p",{}, c.desc),
      h("div",{class:"row"}, ...c.keys.map(k => {
        const L = LINKS.find(x=>x.key===k), u = safeUrl(S.links[k]);
        const label = c.keys.length > 1 ? L.short : "folder";
        return u ? h("a",{class:"btn primary sm", href:u, target:"_blank", rel:"noopener"}, `Open ${label} ↗`)
          : h("button",{class:"btn sm", type:"button", onclick:openLinks}, `Add ${label} link`);
      })))))
  ];
}

function openLinks(){
  const inputs = LINKS.map(L => { const i = h("input",{type:"url", id:"lnk-"+L.key, placeholder:"https://drive.google.com/drive/folders/…"}); i.value = S.links[L.key] || ""; return [L, i]; });
  const status = h("div",{class:"cmp-status"});
  openDrawer("Drive folder links", [
    h("p",{class:"small muted", style:"margin:0"},"In Google Drive, right-click a folder, choose Share → Copy link, and paste it here."),
    h("div",{class:"fields"}, ...inputs.map(([L,i]) => h("div",{class:"field full"}, h("label",{for:i.id}, L.label), i))),
    h("div",{class:"d-actions"}, status, h("button",{class:"btn primary", type:"button", onclick:async()=>{
      if (!db) return toast("The hub's shared data isn't available in this view.");
      const data = {}; inputs.forEach(([L,i]) => data[L.key] = i.value.trim());
      try{ await db.doc("config/links").set(data); closeDrawer(); toast("Folder links saved."); }catch(e){ status.textContent = dbErr(e); }
    }},"Save links"))
  ]);
}

/* ---------- SOPs ---------- */
function viewSops(){
  const groups = SOP_CATS.map(c => [c, S.sops.filter(s => s.category===c)]).filter(([,l]) => l.length);
  const other = S.sops.filter(s => !SOP_CATS.includes(s.category));
  if (other.length) groups.push(["Other", other]);
  const open = S.sopOpen && S.sops.find(s=>s.id===S.sopOpen && s.roles);
  if (open) return viewSopDetail(open);
  const st = S.sops.find(s=>s.strategy)?.strategy;
  return [
    h("div",{class:"spread"}, h("div",{}, h("div",{class:"eyebrow"},"Standard operating procedures"), h("h2",{},"How we make FIESTA content")),
      h("button",{class:"btn primary", type:"button", onclick:()=>openSop(null)},"+ New SOP")),
    h("p",{class:"small muted", style:"margin:-12px 0 0"},"Kate's goal: guides other FIESTA cities can use as-is."),
    st ? h("section",{class:"panel strategy"},
      h("div",{class:"strat-grid"},
        h("div",{}, h("div",{class:"eyebrow"},"Who we serve"), h("p",{}, st.serve)),
        h("div",{}, h("div",{class:"eyebrow"},"Primary goal"), h("p",{}, st.primary)),
        h("div",{}, h("div",{class:"eyebrow"},"Secondary goal"), h("p",{}, st.secondary))),
      h("div",{class:"rs-block"}, h("div",{class:"eyebrow"},"How our content gets there"), h("div",{class:"how-grid"}, ...lines(st.how).map(l=>h("div",{class:"how-card"}, ...newify(l)))))) : null,
    ...(groups.length ? groups.map(([c,list]) => h("section",{},
      h("div",{class:"group-h"}, h("h3",{}, c), h("span",{class:"count"}, list.length)),
      h("div",{class:"panel list"}, ...list.map(s => h("button",{class:"item", type:"button", onclick:()=> s.roles ? openSopReader(s.id) : openSop(s.id)},
        h("span",{class:"pill"+(s.status==="Published"?" ok":s.status==="Drafting"?" warn":"")}, s.status||"Planned"),
        h("div",{style:"min-width:0"}, h("div",{class:"t"}, s.title), h("div",{class:"meta"}, [s.summary, (s.ownerIds||[]).map(nameOf).join(", ")].filter(Boolean).join(" · "))),
        h("div",{class:"when"}, s.roles ? h("span",{class:"small"}, `${s.roles.length} roles`) : safeUrl(s.link) ? h("span",{class:"small"},"Doc ↗") : h("span",{class:"small muted"},"No doc yet")))))))
      : [h("div",{class:"panel empty"},"No SOPs yet. Add the first one, like the founder interview editing guide.")])
  ];
}
function openSopReader(id){ closeDrawer(); S.sopOpen = id; setView("sops"); window.scrollTo(0,0); }
function viewSopDetail(s){
  const series = S.series.find(x=>x.brand===s.appliesTo);
  const whoFor = nm => (series?.roles||[]).filter(r=>(r.title||"").toLowerCase()===nm.toLowerCase()).map(r=>r.personId ? teamById(r.personId) || {name:nameOf(r.personId)} : {name:r.name}).filter(p=>p && p.name);
  const link = safeUrl(s.link);
  return [
    h("div",{}, h("button",{class:"btn sm ghost", type:"button", onclick:()=>{ S.sopOpen = ""; renderMain(); }},"← All SOPs")),
    h("div",{class:"spread"},
      h("div",{}, h("div",{class:"eyebrow"},"SOP"), h("h2",{}, s.title), s.summary ? h("p",{class:"muted", style:"margin:6px 0 0"}, s.summary) : null),
      h("div",{class:"row"}, link ? h("a",{class:"btn", href:link, target:"_blank", rel:"noopener"},"Google Doc ↗") : null,
        h("button",{class:"btn", type:"button", onclick:()=>openSopEditor(s.id)},"Edit SOP"))),
    h("nav",{class:"jump", "aria-label":"Jump to role"}, ...(s.roles||[]).map(r => h("button",{type:"button", onclick:()=>document.getElementById("role-"+keyOf(r.name))?.scrollIntoView({behavior:"smooth", block:"start"})}, plainName(r.name)))),
    ...(s.roles||[]).map(r => {
      const nm = plainName(r.name), who = whoFor(nm);
      const ds = lines(r.deliverables).map(parseDeliv), how = lines(r.how), later = lines(r.later);
      return h("section",{class:"panel role-sop", id:"role-"+keyOf(r.name)},
        h("header",{class:"rs-head"},
          h("div",{style:"min-width:0"}, h("h3",{class:"rs-title"}, ...newify(r.name)), r.purpose ? h("p",{class:"rs-purpose"}, r.purpose) : null),
          h("div",{class:"rs-meta"},
            h("div",{class:"who-chips"}, ...(who.length ? who.map(p => h("span",{class:"who-chip"}, avatar(p,true), p.name)) : [h("span",{class:"pill warn"},"Unassigned")])),
            r.folder ? h("span",{class:"folder"}, "Folder · " + r.folder) : null)),
        ds.length ? h("div",{class:"rs-block"}, h("div",{class:"eyebrow"},"What to hand over"),
          h("div",{class:"tiles"}, ...ds.map(d => h("div",{class:"tile"},
            h("div",{class:"tile-n"}, d.count==null ? "✓" : d.per ? `${d.count}×` : String(d.count)),
            h("div",{class:"tile-u"}, d.count==null ? "To do" : d.per ? "Per pitcher" : "Total"),
            h("div",{class:"tile-t"}, ...newify(d.text)))))) : null,
        how.length ? h("div",{class:"rs-block"}, h("div",{class:"eyebrow"},"How to do it"), h("ul",{class:"checks"}, ...how.map(l => h("li",{}, h("span",{}, ...newify(l)))))) : null,
        later.length ? h("details",{class:"rs-block"}, h("summary",{}, `Next to measure (${later.length})`), h("ul",{class:"checks"}, ...later.map(l => h("li",{}, h("span",{}, ...newify(l)))))) : null);
    })
  ];
}
function openSopEditor(id){
  const s = S.sops.find(x=>x.id===id); if (!s) return;
  const ta = (val, rows, idv, ph) => { const t = h("textarea",{id:idv, rows:String(rows), placeholder:ph||""}); t.value = val||""; return t; };
  const inp = (val, idv) => { const t = h("input",{type:"text", id:idv}); t.value = val||""; return t; };
  const st = s.strategy || {};
  const sf = {serve:inp(st.serve,"ss-serve"), primary:inp(st.primary,"ss-primary"), secondary:inp(st.secondary,"ss-secondary"), how:ta(st.how,4,"ss-how","One point per line")};
  const title = inp(s.title,"ss-title"), summary = ta(s.summary,2,"ss-summary"), link = h("input",{type:"url", id:"ss-link"}); link.value = s.link||"";
  const rf = (s.roles||[]).map((r,i) => ({name:inp(r.name,`sr-${i}-name`), folder:inp(r.folder,`sr-${i}-folder`), purpose:ta(r.purpose,2,`sr-${i}-purpose`),
    how:ta(r.how,4,`sr-${i}-how`,"One instruction per line"), deliverables:ta(r.deliverables,4,`sr-${i}-del`,"50 | General photos\n3/pitcher | Photos per pitcher"), later:ta(r.later,3,`sr-${i}-later`)}));
  const status = h("div",{class:"cmp-status"});
  const fld = (label, el) => h("div",{class:"field full"}, h("label",{for:el.id}, label), el);
  openDrawer("Edit: " + s.title, [
    h("p",{class:"small muted", style:"margin:0"},"Deliverables: start a line with a number and “|” to make it countable, like “50 | General photos.” Use “3/pitcher |” for counts that scale with how many founders pitched. Add “(New)” at the end of anything new."),
    h("div",{class:"fields"}, fld("Title", title), fld("Summary", summary), fld("Google Doc link (optional)", link)),
    h("div",{class:"eyebrow"},"Content strategy"),
    h("div",{class:"fields"}, fld("Who we serve", sf.serve), fld("Primary goal", sf.primary), fld("Secondary goal", sf.secondary), fld("How our content gets there", sf.how)),
    ...rf.map((f,i) => h("section",{class:"sop-role"}, h("div",{class:"eyebrow"}, "Role " + (i+1)),
      h("div",{class:"fields"}, h("div",{class:"field"}, h("label",{for:f.name.id},"Role name"), f.name), h("div",{class:"field"}, h("label",{for:f.folder.id},"Folder"), f.folder),
        fld("What it's for", f.purpose), fld("How to do it", f.how), fld("Deliverables", f.deliverables), fld("Next to measure", f.later)))),
    h("div",{class:"d-actions"}, status, h("button",{class:"btn primary", type:"button", onclick:async()=>{
      if (!db) return toast("The hub's shared data isn't available in this view.");
      const roles = rf.map(f => ({name:f.name.value.trim(), folder:f.folder.value.trim(), purpose:f.purpose.value.trim(), how:f.how.value.trim(), deliverables:f.deliverables.value.trim(), later:f.later.value.trim()})).filter(r=>r.name);
      try{ await db.collection("sops").doc(id).update({title:title.value.trim()||s.title, summary:summary.value.trim(), link:link.value.trim(), roles,
        strategy:{serve:sf.serve.value.trim(), primary:sf.primary.value.trim(), secondary:sf.secondary.value.trim(), how:sf.how.value.trim()}, updatedAt:new Date().toISOString()});
        closeDrawer(); toast("SOP saved."); }catch(err){ status.textContent = dbErr(err); }
    }},"Save SOP"))
  ]);
}
function deliverablesSection(e){
  const sop = S.sops.find(s=>s.roles && s.appliesTo===e.brand);
  if (!sop || e.cancelled) return null;
  const n = S.founders.length;
  const done = e.deliv || {};
  let total = 0, got = 0;
  const cards = sop.roles.map(r => {
    const nm = plainName(r.name);
    const who = (e.roles||[]).filter(x => (x.title||"").toLowerCase()===nm.toLowerCase()).map(x => x.personId ? nameOf(x.personId) : x.name).filter(Boolean);
    const items = lines(r.deliverables).map(parseDeliv).map((d, di) => {
      const key = `${keyOf(nm)}-${di}`; total++; if (done[key]) got++;
      const cb = h("input",{type:"checkbox", id:`dl-${e.id}-${key}`}); cb.checked = !!done[key];
      cb.onchange = async () => { if (!db) return; try{ await saveEventDoc(e, {deliv:{[key]:cb.checked}}); }catch(err){ cb.checked = !cb.checked; toast(dbErr(err)); } };
      const target = d.count==null ? null : d.per ? (n ? String(d.count*n) : `${d.count}/pitcher`) : String(d.count);
      return h("label",{class:"dl-item"+(cb.checked?" done":""), for:cb.id}, cb, target ? h("span",{class:"dl-n mono"}, target) : null, h("span",{}, plainName(d.text)));
    });
    return h("div",{class:"panel dl-card"},
      h("div",{class:"spread", style:"align-items:baseline"}, h("h3",{}, nm), who.length ? h("span",{class:"small"}, who.join(", ")) : h("span",{class:"pill warn"},"Unassigned")),
      r.folder ? h("span",{class:"small muted"}, "→ " + r.folder) : null,
      ...items);
  });
  return h("section",{},
    h("div",{class:"spread", style:"margin-bottom:8px"},
      h("div",{class:"group-h", style:"padding:0"}, h("h3",{},"Media deliverables"), h("span",{class:"count"}, `${got}/${total} done`),
        h("span",{class:"small muted"}, n ? `· counts for ${n} pitchers` : "· add the pitcher list to calculate per-pitcher counts")),
      h("button",{class:"btn sm", type:"button", onclick:()=>openSopReader(sop.id)},"Open SOP")),
    h("div",{class:"cards"}, ...cards));
}
function openSop(id){
  const s = id ? S.sops.find(x=>x.id===id) : {category:"Video", status:"Planned", ownerIds:S.meId?[S.meId]:[]};
  if (!s) return;
  const f = {
    title: h("input",{type:"text", id:"sop-title", placeholder:"Founder interview video editing"}),
    category: h("select",{id:"sop-cat"}, ...SOP_CATS.map(c=>h("option",{value:c},c))),
    status: h("select",{id:"sop-status"}, ...SOP_STATUS.map(c=>h("option",{value:c},c))),
    link: h("input",{type:"url", id:"sop-link", placeholder:"https://docs.google.com/document/…"}),
    summary: h("textarea",{id:"sop-summary", rows:"3", placeholder:"What this SOP covers, in a sentence or two."})
  };
  f.title.value = s.title||""; f.category.value = s.category||"Video"; f.status.value = s.status||"Planned"; f.link.value = s.link||""; f.summary.value = s.summary||"";
  const owners = ownerPicker("sop", s.ownerIds||[]);
  const status = h("div",{class:"cmp-status"});
  const link = safeUrl(s.link);
  openDrawer(id ? "Edit SOP" : "New SOP", [
    link ? h("a",{class:"btn primary", href:link, target:"_blank", rel:"noopener", style:"align-self:flex-start"},"Open the SOP doc ↗") : null,
    h("div",{class:"fields"},
      h("div",{class:"field full"}, h("label",{for:"sop-title"},"Title"), f.title),
      h("div",{class:"field"}, h("label",{for:"sop-cat"},"Category"), f.category),
      h("div",{class:"field"}, h("label",{for:"sop-status"},"Status"), f.status),
      h("div",{class:"field full"}, h("span",{class:"lbl"},"Owner"), owners.el),
      h("div",{class:"field full"}, h("label",{for:"sop-link"},"Google Doc link"), f.link),
      h("div",{class:"field full"}, h("label",{for:"sop-summary"},"Summary"), f.summary)),
    h("div",{class:"d-actions"},
      id ? deleteButton(async()=>{ await db.collection("sops").doc(id).delete(); }, status) : h("span",{}),
      h("button",{class:"btn primary", type:"button", onclick:async()=>{
        if (!db) return toast("The hub's shared data isn't available in this view.");
        const title = f.title.value.trim(); if (!title){ status.textContent = "Give the SOP a title."; return; }
        const data = {title, category:f.category.value, status:f.status.value, link:f.link.value.trim(), summary:f.summary.value.trim(), ownerIds:owners.get(), updatedAt:new Date().toISOString()};
        try{ id ? await db.collection("sops").doc(id).update(data) : await db.collection("sops").add(data); closeDrawer(); toast("SOP saved."); }catch(e){ status.textContent = dbErr(e); }
      }},"Save SOP")),
    status
  ]);
}

/* ---------- roles (team) ---------- */
function eventRolesFor(personId){
  const out = [];
  for (const s of S.series) for (const r of (s.roles||[])) if (r.personId===personId) out.push({label:`every ${s.name} meetup`, r, date:""});
  for (const e of S.events) if (!e.seriesId) for (const r of (e.roles||[])) if (r.personId===personId && (!e.date || e.date>=today())) out.push({label:e.name, r, date:e.date||""});
  return out;
}
const GROUPS = [["leadership","FIESTA leadership","Runs FIESTA and the company."],["media","Media team","Video, photos, social and the newsletter."]];
function seriesTagsFor(id){
  const out = [];
  for (const s of S.series){ const ts = (s.roles||[]).filter(r=>r.personId===id).map(r=>r.title); if (ts.length) out.push(`${s.name}: ${[...new Set(ts)].join(", ")}`); }
  return out;
}
function personCard(t){
  const duties = lines(t.duties), tags = seriesTagsFor(t.id);
  return h("article",{class:"person"},
    h("div",{class:"person-top"},
      h("div",{class:"ph"}, t.photo ? h("img",{src:t.photo, alt:t.name}) : h("span",{class:"ph-ini", style:`background:hsl(${hue(t.name)} 48% 44%)`}, initials(t.name))),
      h("h3",{class:"p-name"}, t.name, t.id===S.meId ? h("span",{class:"you"},"You") : null),
      h("div",{class:"p-title"}, t.role || "Title not set"),
      t.email ? h("div",{class:"p-mail"}, t.email) : h("span",{class:"pill warn"},"No email yet")),
    duties.length ? h("ul",{class:"p-duties"}, ...duties.map(d=>h("li",{},d))) : null,
    tags.length ? h("div",{class:"p-tags"}, ...tags.map(x=>h("span",{class:"p-tag"}, x))) : null,
    h("button",{class:"p-foot", type:"button", onclick:()=>openMember(t.id)},"Edit profile"));
}
function viewRoles(){
  const sorted = S.team.slice().sort((a,b)=>(a.order??99)-(b.order??99) || (a.name||"").localeCompare(b.name||""));
  const rest = sorted.filter(t=>!GROUPS.some(([g])=>g===t.group));
  return [
    h("div",{class:"spread"}, h("div",{class:"team-hero"}, h("div",{class:"eyebrow"},"Roles"), h("h2",{class:"team-h"},"The people behind FIESTA"),
        h("p",{class:"muted", style:"margin:0"},"Who leads, who makes the content, and what each person owns.")),
      h("button",{class:"btn", type:"button", onclick:()=>openMember(null)},"+ Add person")),
    ...GROUPS.map(([g,label,desc]) => { const list = sorted.filter(t=>t.group===g); return list.length ? h("section",{class:"team-sec"},
      h("div",{class:"team-sec-h"}, h("h3",{}, label), h("span",{class:"muted small"}, desc)),
      h("div",{class:"people"+(g==="leadership"?" lead":"")}, ...list.map(personCard))) : null; }),
    rest.length ? h("section",{class:"team-sec"}, h("div",{class:"team-sec-h"}, h("h3",{},"Other teammates")), h("div",{class:"people"}, ...rest.map(personCard))) : null,
    S.team.length ? null : h("div",{class:"panel empty"},"No one added yet. Add yourself first.")
  ];
}
function openMember(id){
  const t = id ? teamById(id) : {};
  if (!t) return;
  const name = h("input",{type:"text", id:"tm-name", placeholder:"First name, as people will @mention it"}); name.value = t.name||"";
  const role = h("input",{type:"text", id:"tm-role", placeholder:"Social media, newsletter, events…"}); role.value = t.role||"";
  const duties = h("textarea",{id:"tm-duties", rows:"5", placeholder:"One responsibility per line"}); duties.value = t.duties||"";
  const email = h("input",{type:"email", id:"tm-email", placeholder:"name@example.com"}); email.value = t.email||"";
  const status = h("div",{class:"cmp-status"});
  const group = h("select",{id:"tm-group"}, h("option",{value:"leadership"},"FIESTA leadership"), h("option",{value:"media"},"Media team"), h("option",{value:""},"Other"));
  group.value = t.group ?? (id ? "" : "media");
  let photo = t.photo || "";
  const prev = h("div",{class:"ph", style:"width:120px; border-radius:10px; flex:none"});
  const paintPrev = () => prev.replaceChildren(photo ? h("img",{src:photo, alt:""}) : h("span",{class:"ph-ini", style:`background:hsl(${hue(t.name||"?")} 48% 44%); font-size:28px`}, initials(t.name||"?")));
  paintPrev();
  const pic = h("input",{type:"file", id:"tm-photo", accept:"image/png,image/jpeg,image/webp"});
  const picStatus = h("span",{class:"small muted"});
  pic.onchange = async () => {
    const f = pic.files[0]; if (!f) return;
    picStatus.textContent = "Preparing…";
    // stored inline on the teammate (free plan has no file storage), so keep it small
    try{
      const blob = await resizeImage(f, 480);
      photo = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
      paintPrev(); picStatus.textContent = "Ready. Click Save to keep it.";
    }catch(e){ picStatus.textContent = "Couldn't read that image. Try a JPG or PNG."; }
  };
  const rmPic = h("button",{class:"btn sm ghost", type:"button", onclick:()=>{ photo = ""; paintPrev(); picStatus.textContent = "Photo removed. Click Save to keep this."; }},"Remove photo");
  openDrawer(id ? "Edit teammate" : "Add teammate", [
    h("div",{class:"fields"},
      h("div",{class:"field full"}, h("span",{class:"lbl"},"Headshot"), h("div",{class:"row", style:"align-items:flex-start"}, prev,
        h("div",{style:"display:flex; flex-direction:column; gap:6px; min-width:0"}, h("label",{for:"tm-photo", class:"sr"},"Upload headshot"), pic, picStatus, photo ? rmPic : null))),
      h("div",{class:"field full"}, h("label",{for:"tm-name"},"Name"), name),
      h("div",{class:"field"}, h("label",{for:"tm-role"},"Title"), role),
      h("div",{class:"field"}, h("label",{for:"tm-group"},"Team"), group),
      h("div",{class:"field full"}, h("label",{for:"tm-duties"},"Responsibilities"), duties),
      h("div",{class:"field full"}, h("label",{for:"tm-email"},"Email for @mentions"), email)),
    h("div",{class:"d-actions"},
      id ? deleteButton(async()=>{ await db.collection("team").doc(id).delete(); }, status) : h("span",{}),
      h("button",{class:"btn primary", type:"button", onclick:async()=>{
        if (!db) return toast("The hub's shared data isn't available in this view.");
        const n = name.value.trim(); if (!n){ status.textContent = "Add a name."; return; }
        const e = email.value.trim();
        if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){ status.textContent = "That email doesn't look right."; return; }
        const data = {name:n, role:role.value.trim(), duties:duties.value.trim(), email:e.toLowerCase(), group:group.value, photo};
        try{
          let tid = id;
          if (id) await db.collection("team").doc(id).update(data); else tid = (await db.collection("team").add(data)).id;
          // admins: the email also becomes a sign-in on the Access page
          if (S.access === "admin"){
            const old = (t.email||"").toLowerCase();
            if (old && old !== data.email && S.allowed.some(a=>a.id===old)) await removeAccess(old);
            if (data.email) await setAccess(data.email, S.allowed.some(a=>a.id===data.email) ? {teamId:tid} : {teamId:tid, access:"member"});
          }
          closeDrawer(); toast("Saved.");
        }catch(err){ status.textContent = dbErr(err); }
      }},"Save")),
    status
  ]);
}

/* ---------- events ---------- */
let founderUnsub = null, founderFor = null;
function watchFounders(eid){
  if (founderFor===eid) return;
  if (founderUnsub) founderUnsub();
  founderFor = eid; S.founders = []; founderUnsub = null;
  if (!db || !eid) return;
  founderUnsub = db.collection(`events/${eid}/founders`).onSnapshot(s => {
    S.founders = s.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(a.order??999)-(b.order??999) || (a.name||"").localeCompare(b.name||""));
    if (S.view==="events") renderMain();
  }, e => console.warn(e));
}
function currentEvent(){
  const evs = allEvents();
  return evs.find(e=>e.id===S.eventId)
    || evs.filter(e=>e.date && e.date>=today() && !e.cancelled).sort((a,b)=>a.date.localeCompare(b.date))[0]
    || evs.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
}
function groupRoles(list){
  const m = new Map();
  for (const r of list){
    const key = r.personId || r.name || "open:" + r.title;
    if (!m.has(key)) m.set(key, {personId:r.personId, name:r.name, titles:[]});
    m.get(key).titles.push(r.title);
  }
  return [...m.values()];
}
function ocNode(g){
  const p = g.personId ? teamById(g.personId) : null, nm = p ? (p.name || p.id) : g.name;
  return h("div",{class:"oc-node"+(nm ? "" : " open")},
    nm ? avatar(p || {name:nm}) : h("span",{class:"av oc-q", "aria-hidden":"true"},"?"),
    h("div",{style:"min-width:0"}, h("div",{class:"oc-name"}, nm || "Open role"), h("div",{class:"oc-role"}, g.titles.join(" · "))));
}
function founderRow(e, f){
  return h("button",{class:"item", type:"button", onclick:()=>openFounder(e, f.id)},
    avatar({name:f.name}),
    h("div",{style:"min-width:0"}, h("div",{class:"t"}, f.name, f.company ? h("span",{class:"muted"}, " · "+f.company) : null),
      f.oneLiner ? h("div",{class:"meta"}, f.oneLiner) : null,
      h("div",{class:"links", style:"margin-top:4px"}, ...[["LinkedIn",f.linkedin],["Instagram",f.instagram],["Website",f.website],["Headshot",f.photoUrl]].filter(([,u])=>safeUrl(u)).map(([l,u]) => h("a",{href:u, target:"_blank", rel:"noopener", onclick:ev=>ev.stopPropagation()}, l+" ↗")))),
    h("div",{class:"when"}, h("span",{class:"pill"+(f.contentStatus==="Posted"?" ok":f.contentStatus&&f.contentStatus!=="Not started"?" warn":"")}, f.contentStatus||"Not started")));
}
function viewEvents(){
  const series = S.series.slice().sort((a,b)=>(a.id==="fiesta"?0:1)-(b.id==="fiesta"?0:1));
  if (!series.length) return [h("div",{class:"panel empty"},"No events set up yet.")];
  const cur = series.find(s=>s.id===S.chartId) || series[0];
  const next = allEvents().filter(e=>e.seriesId===cur.id && !e.cancelled && e.date>=today()).sort((a,b)=>a.date.localeCompare(b.date))[0];
  watchFounders(next ? next.id : null);
  const asEvent = {recurring:true, seriesId:cur.id, roles:cur.roles||[], name:cur.name};
  const areas = AREAS.map(a => [a, groupRoles((cur.roles||[]).filter(r=>r.area===a))]).filter(([,l])=>l.length);
  return [
    h("div",{class:"spread"}, h("div",{}, h("div",{class:"eyebrow"},"Event org chart"), h("h2",{},"Who does what at our events")),
      h("div",{class:"row"}, h("button",{class:"btn", type:"button", onclick:()=>openSeries(cur.id)},"Schedule"),
        h("button",{class:"btn primary", type:"button", onclick:()=>openRoles(asEvent)},"Edit roles"))),
    h("div",{class:"seg oc-switch", role:"group", "aria-label":"Event"}, ...series.map(s => h("button",{type:"button", "aria-pressed": String(s.id===cur.id), onclick:()=>{ S.chartId = s.id; save("hub.chart", s.id); renderMain(); }}, s.name))),
    h("section",{class:"panel oc", style:`--c:${(BRANDS[cur.brand]||{}).c||"var(--accent)"}`},
      h("div",{class:"oc-root"}, h("div",{class:"oc-title"}, cur.name), h("div",{class:"oc-sub"}, ruleText(cur.rule) + (next ? " · next " + fmt(next.date) : ""))),
      areas.length ? h("div",{class:"oc-areas"}, ...areas.map(([a, people]) => h("div",{class:"oc-col"}, h("div",{class:"oc-area"}, AREA_LABELS[a] || a), ...people.map(ocNode))))
        : h("div",{class:"empty", style:"text-align:center"}, "No roles yet. ", h("button",{class:"btn sm", type:"button", onclick:()=>useTemplate(asEvent)},"Start from the template"))),
    next ? h("details",{class:"panel fold", open:S.pitchOpen, ontoggle:ev=>{ S.pitchOpen = ev.target.open; }},
      h("summary",{}, `Pitchers at the next ${cur.name} · ${fmtShort(next.date)}`, h("span",{class:"count"}, " " + S.founders.length)),
      h("div",{class:"list"}, ...(S.founders.length ? S.founders.map(f=>founderRow(next, f)) : [h("div",{class:"empty"},"No pitchers added yet.")])),
      h("div",{style:"padding:10px 14px"}, h("button",{class:"btn sm", type:"button", onclick:()=>openFounder(next, null)},"+ Add a pitcher"))) : null
  ];
}

async function saveRoles(e, roles){
  if (e.recurring) await db.collection("series").doc(e.seriesId).update({roles});
  else await db.collection("events").doc(e.id).update({roles});
}
async function useTemplate(e){
  if (!db) return toast("The hub's shared data isn't available in this view.");
  try{ await saveRoles(e, ROLE_TEMPLATE.map(([area,title])=>({area, title, personId:"", name:""}))); toast("Template added. Click Edit roles to assign people."); }catch(err){ toast(dbErr(err)); }
}
function openOccurrence(e){
  const date = h("input",{type:"date", id:"oc-date"}); date.value = e.date || "";
  const venue = h("input",{type:"text", id:"oc-venue"}); venue.value = e.venue || "";
  const photos = h("input",{type:"url", id:"oc-photos", placeholder:"Drive folder for this month's photos"}); photos.value = e.photosUrl || "";
  const info = h("input",{type:"url", id:"oc-info", placeholder:"Run-of-show or sign-up sheet"}); info.value = e.infoUrl || "";
  const notes = h("textarea",{id:"oc-notes", rows:"4", placeholder:"Anything different this month: theme, speakers, shot list…"}); notes.value = e.notes || "";
  const skip = h("input",{type:"checkbox", id:"oc-skip"}); skip.checked = !!e.cancelled;
  const status = h("div",{class:"cmp-status"});
  openDrawer(e.name, [
    h("p",{class:"small muted", style:"margin:0"},"Only for this month. Roles and the usual schedule live in the defaults."),
    h("div",{class:"fields"},
      h("div",{class:"field"}, h("label",{for:"oc-date"},"Date"), date),
      h("div",{class:"field"}, h("label",{for:"oc-venue"},"Venue"), venue),
      h("div",{class:"field full"}, h("label",{for:"oc-photos"},"Photos folder"), photos),
      h("div",{class:"field full"}, h("label",{for:"oc-info"},"Info doc"), info),
      h("div",{class:"field full"}, h("label",{for:"oc-notes"},"Notes for the media team"), notes),
      h("label",{class:"field full", for:"oc-skip", style:"flex-direction:row; align-items:center; gap:8px"}, skip, "No meetup this month")),
    h("div",{class:"d-actions"}, status, h("button",{class:"btn primary", type:"button", onclick:async()=>{
      if (!db) return toast("The hub's shared data isn't available in this view.");
      try{ await saveEventDoc(e, {date:date.value, venue:venue.value.trim(), photosUrl:photos.value.trim(), infoUrl:info.value.trim(), notes:notes.value.trim(), cancelled:skip.checked}); closeDrawer(); toast("Saved for this month."); }
      catch(err){ status.textContent = dbErr(err); }
    }},"Save"))
  ]);
}
function openSeries(id){
  const s = seriesById(id); if (!s) return;
  const name = h("input",{type:"text", id:"se-name"}); name.value = s.name || "";
  const nth = h("select",{id:"se-nth"}, ...NTH.map(([n,l])=>h("option",{value:String(n)}, l))); nth.value = String(s.rule?.nth ?? 1);
  const wd = h("select",{id:"se-wd"}, ...WEEKDAYS.map((d,i)=>h("option",{value:String(i)}, d))); wd.value = String(s.rule?.weekday ?? 3);
  const venue = h("input",{type:"text", id:"se-venue"}); venue.value = s.venue || "";
  const photos = h("input",{type:"url", id:"se-photos", placeholder:"Parent Drive folder for this series' photos"}); photos.value = s.photosUrl || "";
  const status = h("div",{class:"cmp-status"});
  openDrawer(`${s.name} defaults`, [
    h("p",{class:"small muted", style:"margin:0"},"These apply to every month. Change one month's date with “Edit this month.”"),
    h("div",{class:"fields"},
      h("div",{class:"field full"}, h("label",{for:"se-name"},"Name"), name),
      h("div",{class:"field"}, h("label",{for:"se-nth"},"Which week"), nth),
      h("div",{class:"field"}, h("label",{for:"se-wd"},"Day"), wd),
      h("div",{class:"field full"}, h("label",{for:"se-venue"},"Usual venue"), venue),
      h("div",{class:"field full"}, h("label",{for:"se-photos"},"Photos folder"), photos)),
    h("div",{class:"d-actions"}, status, h("button",{class:"btn primary", type:"button", onclick:async()=>{
      if (!db) return toast("The hub's shared data isn't available in this view.");
      try{ await db.collection("series").doc(id).update({name:name.value.trim() || s.name, rule:{nth:+nth.value, weekday:+wd.value}, venue:venue.value.trim(), photosUrl:photos.value.trim()}); closeDrawer(); toast("Defaults saved."); }
      catch(err){ status.textContent = dbErr(err); }
    }},"Save defaults"))
  ]);
}
function openEvent(id){
  const e = id ? S.events.find(x=>x.id===id) : {brand:"FIESTA"};
  if (!e) return;
  const f = {
    name: h("input",{type:"text", id:"evt-name", placeholder:"FIESTA Austin: November pitch night"}),
    brand: h("select",{id:"evt-brand"}, ...Object.entries(BRANDS).filter(([k])=>k!=="Newsletter").map(([k,B])=>h("option",{value:k},B.label))),
    date: h("input",{type:"date", id:"evt-date"}),
    venue: h("input",{type:"text", id:"evt-venue", placeholder:"Venue or city"}),
    photosUrl: h("input",{type:"url", id:"evt-photos", placeholder:"Drive folder for this event's photos"}),
    infoUrl: h("input",{type:"url", id:"evt-info", placeholder:"Run-of-show, sign-up sheet, or any info doc"}),
    notes: h("textarea",{id:"evt-notes", rows:"4", placeholder:"Schedule, speakers, shot list, anything the media team should know."})
  };
  for (const k of Object.keys(f)) f[k].value = e[k] || "";
  const status = h("div",{class:"cmp-status"});
  openDrawer(id ? "Edit event" : "New event", [
    h("div",{class:"fields"},
      h("div",{class:"field full"}, h("label",{for:"evt-name"},"Event name"), f.name),
      h("div",{class:"field"}, h("label",{for:"evt-brand"},"Brand"), f.brand),
      h("div",{class:"field"}, h("label",{for:"evt-date"},"Date"), f.date),
      h("div",{class:"field full"}, h("label",{for:"evt-venue"},"Venue"), f.venue),
      h("div",{class:"field full"}, h("label",{for:"evt-photos"},"Photos folder link"), f.photosUrl),
      h("div",{class:"field full"}, h("label",{for:"evt-info"},"Info doc link"), f.infoUrl),
      h("div",{class:"field full"}, h("label",{for:"evt-notes"},"Notes for the media team"), f.notes)),
    h("div",{class:"d-actions"},
      id ? deleteButton(async()=>{ await db.collection("events").doc(id).delete(); S.eventId = ""; }, status) : h("span",{}),
      h("button",{class:"btn primary", type:"button", onclick:async()=>{
        if (!db) return toast("The hub's shared data isn't available in this view.");
        const name = f.name.value.trim(); if (!name){ status.textContent = "Give the event a name."; return; }
        const data = {}; for (const k of Object.keys(f)) data[k] = f[k].value.trim();
        try{
          if (id) await db.collection("events").doc(id).update(data);
          else { const ref = db.collection("events").doc(); await ref.set({...data, roles:[]}); S.eventId = ref.id; save("hub.event", ref.id); }
          closeDrawer(); toast("Event saved."); renderMain();
        }catch(err){ status.textContent = dbErr(err); }
      }},"Save event")),
    status
  ]);
}
function openRoles(e){
  const rows = h("div",{class:"role-rows"});
  const addRow = (r={area:"Media", title:"", personId:"", name:""}) => {
    const area = h("select",{"aria-label":"Area"}, ...AREAS.map(a=>h("option",{value:a},a))); area.value = r.area;
    const title = h("input",{type:"text", "aria-label":"Role", placeholder:"Role, e.g. Photographer"}); title.value = r.title||"";
    const person = h("select",{"aria-label":"Person"}, h("option",{value:""},"Unassigned"), ...S.team.map(t=>h("option",{value:t.id},t.name)), h("option",{value:"__other"},"Someone else…"));
    const other = h("input",{type:"text", "aria-label":"Name", placeholder:"Their name"}); other.value = r.name||"";
    person.value = r.personId && teamById(r.personId) ? r.personId : (r.name ? "__other" : "");
    other.hidden = person.value!=="__other";
    person.onchange = () => { other.hidden = person.value!=="__other"; };
    const row = h("div",{class:"role-row"}, area, title, h("div",{style:"display:flex; flex-direction:column; gap:4px"}, person, other),
      h("button",{class:"btn ghost sm", type:"button", "aria-label":"Remove role", onclick:()=>row.remove()},"Remove"));
    row._get = () => ({area:area.value, title:title.value.trim(), personId: person.value && person.value!=="__other" ? person.value : "", name: person.value==="__other" ? other.value.trim() : ""});
    rows.append(row);
  };
  (e.roles||[]).forEach(addRow);
  if (!(e.roles||[]).length) ROLE_TEMPLATE.forEach(([area,title])=>addRow({area,title}));
  const status = h("div",{class:"cmp-status"});
  openDrawer(e.recurring ? `Roles at every ${seriesById(e.seriesId)?.name || ""} meetup` : "Roles: " + e.name, [
    h("p",{class:"small muted", style:"margin:0"}, (e.recurring ? "Set once; every month uses this chart. " : "") + "Pick a teammate, or choose “Someone else…” for volunteers and partners who aren't on the hub."),
    rows,
    h("button",{class:"btn sm", type:"button", style:"align-self:flex-start", onclick:()=>addRow()},"+ Add role"),
    h("div",{class:"d-actions"}, status, h("button",{class:"btn primary", type:"button", onclick:async()=>{
      if (!db) return toast("The hub's shared data isn't available in this view.");
      const roles = [...rows.children].map(r=>r._get()).filter(r=>r.title);
      try{ await saveRoles(e, roles); closeDrawer(); toast("Role chart saved."); }catch(err){ status.textContent = dbErr(err); }
    }},"Save roles"))
  ]);
}
function openFounder(e, id){
  const fd = id ? S.founders.find(x=>x.id===id) : {contentStatus:"Not started"};
  if (!fd) return;
  const f = {
    name: h("input",{type:"text", id:"fd-name"}),
    company: h("input",{type:"text", id:"fd-company"}),
    oneLiner: h("textarea",{id:"fd-one", rows:"2", placeholder:"What the company does, in one sentence"}),
    linkedin: h("input",{type:"url", id:"fd-li", placeholder:"https://linkedin.com/in/…"}),
    instagram: h("input",{type:"url", id:"fd-ig", placeholder:"https://instagram.com/…"}),
    website: h("input",{type:"url", id:"fd-web", placeholder:"https://…"}),
    photoUrl: h("input",{type:"url", id:"fd-photo", placeholder:"Drive link to their headshot"}),
    contentStatus: h("select",{id:"fd-status"}, ...FOUNDER_STATUS.map(s=>h("option",{value:s},s))),
    notes: h("textarea",{id:"fd-notes", rows:"4", placeholder:"Wins, funding, awards, pitch order, OK to film?"})
  };
  for (const k of Object.keys(f)) f[k].value = fd[k] || "";
  if (!f.contentStatus.value) f.contentStatus.value = "Not started";
  const status = h("div",{class:"cmp-status"});
  const lbl = {name:"Name", company:"Company", oneLiner:"One-liner", linkedin:"LinkedIn", instagram:"Instagram", website:"Website", photoUrl:"Headshot link", contentStatus:"Content status", notes:"Notes for content"};
  const half = new Set(["linkedin","instagram","website","photoUrl"]);
  openDrawer(id ? fd.name : "Add a founder", [
    h("div",{class:"fields"}, ...Object.keys(f).map(k => h("div",{class:"field"+(half.has(k)?"":" full")}, h("label",{for:f[k].id}, lbl[k]), f[k]))),
    fd.email ? h("p",{class:"small muted", style:"margin:0"}, "Contact on file: ", h("span",{class:"code"}, fd.email)) : null,
    h("div",{class:"d-actions"},
      id ? deleteButton(async()=>{ await db.collection(`events/${e.id}/founders`).doc(id).delete(); }, status) : h("span",{}),
      h("button",{class:"btn primary", type:"button", onclick:async()=>{
        if (!db) return toast("The hub's shared data isn't available in this view.");
        const name = f.name.value.trim(); if (!name){ status.textContent = "Add their name."; return; }
        const data = {}; for (const k of Object.keys(f)) data[k] = f[k].value.trim();
        try{ id ? await db.collection(`events/${e.id}/founders`).doc(id).update(data) : await db.collection(`events/${e.id}/founders`).add({...data, addedBy:S.meId||"", createdAt:new Date().toISOString()}); closeDrawer(); toast("Saved."); }
        catch(err){ status.textContent = dbErr(err); }
      }},"Save"))
  ]);
}
/* ---------- my tasks & meetings ---------- */
const byDue = (a,b) => (a.due||"9999").localeCompare(b.due||"9999");
function meetingById(id){ return S.meetings.find(m=>m.id===id); }
function taskRow(t, showOwner){
  const cb = h("input",{type:"checkbox", id:"tk-"+t.id, "aria-label":"Done: "+t.text}); cb.checked = !!t.done;
  cb.onchange = async () => { if (!db) return; try{ await db.collection("tasks").doc(t.id).update({done:cb.checked, doneAt: cb.checked ? new Date().toISOString() : ""}); }catch(e){ cb.checked = !cb.checked; toast(dbErr(e)); } };
  const m = t.meetingId ? meetingById(t.meetingId) : null;
  const n = t.due ? daysUntil(t.due) : null;
  return h("div",{class:"task"+(t.done?" done":"")}, cb,
    h("label",{for:cb.id, style:"min-width:0"}, h("div",{class:"task-t"}, t.text),
      h("div",{class:"meta"}, [showOwner ? nameOf(t.ownerId) : null, m ? `From: ${m.title}` : "Added by hand"].filter(Boolean).join(" · "))),
    h("div",{class:"when"}, t.due ? h("span",{class:"mono"}, fmtShort(t.due)) : null,
      t.done ? null : n==null ? h("span",{class:"pill"},"No date") : n<0 ? h("span",{class:"pill bad"}, `${-n}d late`) : n<=3 ? h("span",{class:"pill warn"}, n===0 ? "Today" : `${n}d left`) : null));
}
function card(title, action, ...body){
  return h("section",{class:"card"}, h("div",{class:"card-h"}, h("h3",{}, title), action || null), ...body);
}
function viewMyTasks(){
  const me = teamById(S.meId);
  if (!me) return [h("div",{class:"hello"}, h("h1",{},"Welcome!"), h("p",{},"Your sign-in email isn't linked to a teammate yet.")),
    h("div",{class:"panel empty"},"Ask an admin to add your email to your profile on the Roles page. After that, this page shows your tasks, deadlines and events.")];
  const mine = S.tasks.filter(t=>t.ownerId===me.id);
  const open = mine.filter(t=>!t.done).sort(byDue);
  const done = mine.filter(t=>t.done).sort((a,b)=>(b.doneAt||"").localeCompare(a.doneAt||"")).slice(0,5);
  const myContent = S.content.filter(c=>itemOwners(c).includes(me.id) && !DONE.has(c.status));
  const dueSoon = myContent.filter(c=>c.deadline && daysUntil(c.deadline)<=7).sort((a,b)=>a.deadline.localeCompare(b.deadline));
  const review = myContent.filter(c=>c.needsReview);
  const roles = eventRolesFor(me.id);
  const tile = (n, label, tone) => h("div",{class:"panel stat"+(tone?" "+tone:"")}, h("div",{class:"stat-n"}, n), h("div",{class:"stat-l"}, label));
  const link = (label, view) => h("button",{class:"link", type:"button", onclick:()=>setView(view)}, label);
  const nextEvents = S.series.map(s => allEvents().filter(e=>e.seriesId===s.id && !e.cancelled && e.date>=today()).sort((a,b)=>a.date.localeCompare(b.date))[0]).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date));
  const k = kpiRows(), last = k[k.length-1], prev = k[k.length-2];
  const kd = last ? delta("igShares", last.igShares, prev?.igShares) : null;
  const teamPeek = S.team.slice().sort((a,b)=>(a.order??99)-(b.order??99)).slice(0,6);
  return [
    h("div",{class:"hello"}, h("h1",{}, `Hi ${me.name},`),
      h("p",{}, open.length || dueSoon.length || review.length ? `You have ${open.length} open task${open.length===1?"":"s"}, ${dueSoon.length} post${dueSoon.length===1?"":"s"} due this week and ${review.length} to review.` : "You're all caught up. Nice work.")),
    h("div",{class:"stats"},
      tile(open.length, "open tasks"),
      tile(dueSoon.length, "posts due in 7 days", dueSoon.some(c=>daysUntil(c.deadline)<0) ? "bad" : ""),
      tile(review.length, "drafts to review", review.length ? "warn" : "")),
    h("div",{class:"dash"},
      h("div",{class:"dash-col"},
        card("To do", h("button",{class:"link", type:"button", onclick:()=>openTask(null)},"+ Add task"),
          h("div",{class:"list"}, open.length ? open.map(t=>taskRow(t)) : h("div",{class:"empty"},"Nothing open right now."))),
        card("Content due soon", link("Open calendar","calendar"),
          h("div",{class:"list"}, dueSoon.length ? dueSoon.map(itemRow) : h("div",{class:"empty"},"No content deadlines in the next 7 days."))),
        review.length ? card("Needs your review", null, h("div",{class:"list"}, review.map(itemRow))) : null,
        done.length ? card("Recently done", null, h("div",{class:"list"}, done.map(t=>taskRow(t)))) : null),
      h("div",{class:"dash-col"},
        card("Upcoming events", link("Org chart","events"),
          h("div",{class:"list"}, nextEvents.length ? nextEvents.map(e => h("div",{class:"mini-row"}, brandChip(e.brand),
            h("div",{style:"min-width:0"}, h("div",{class:"t"}, seriesById(e.seriesId)?.name || e.name), h("div",{class:"meta"}, fmt(e.date))),
            h("span",{class:"pill"}, daysUntil(e.date)===0 ? "Today" : `in ${daysUntil(e.date)}d`))) : h("div",{class:"empty"},"No upcoming meetups."))),
        roles.length ? card("Your event roles", null, h("div",{class:"p-tags", style:"padding:4px 18px 16px"}, ...roles.map(({label,r}) => h("span",{class:"p-tag"}, `${r.title} · ${label}`)))) : null,
        card("Analytics", link("View all","analytics"),
          last ? h("div",{class:"list"},
            h("div",{class:"mini-row"}, h("span",{class:"kpi-n"},"1"), h("div",{}, h("div",{class:"t"},"Growth"), h("div",{class:"meta"}, monthLabel(last.id, true))), h("b",{}, signed(last.igGrowth))),
            h("div",{class:"mini-row"}, h("span",{class:"kpi-n"},"2"), h("div",{}, h("div",{class:"t"},"Shares"), kd ? h("div",{class:"meta "+(kd.up?"up":"down")}, `${kd.up?"▲":"▼"} ${kd.text}`) : null), h("b",{}, fmtNum("igShares", last.igShares))),
            h("div",{class:"mini-row"}, h("span",{class:"kpi-n"},"3"), h("div",{}, h("div",{class:"t"},"Link clicks"), last.igClickRate != null ? h("div",{class:"meta"}, `${last.igClickRate}% click rate`) : null), h("b",{}, fmtNum("igLinkClicks", last.igLinkClicks))))
            : h("div",{class:"empty"},"No KPIs entered yet.")),
        card("Team", link("View all","roles"),
          h("div",{class:"list"}, ...teamPeek.map(t => h("div",{class:"mini-row"}, avatar(t), h("div",{style:"min-width:0"}, h("div",{class:"t"}, t.name), h("div",{class:"meta"}, t.role||"")))))))
    )
  ];
}
function openTask(id){
  const t = id ? S.tasks.find(x=>x.id===id) : {ownerId:S.meId||""};
  if (!t) return;
  const text = h("input",{type:"text", id:"tk-text", placeholder:"Start with a verb: Send, Draft, Upload…"}); text.value = t.text||"";
  const owner = h("select",{id:"tk-owner"}, h("option",{value:""},"Choose"), ...S.team.map(m=>h("option",{value:m.id}, m.name))); owner.value = t.ownerId||"";
  const due = h("input",{type:"date", id:"tk-due"}); due.value = t.due||"";
  const status = h("div",{class:"cmp-status"});
  openDrawer(id ? "Edit task" : "Add a task", [
    h("div",{class:"fields"}, h("div",{class:"field full"}, h("label",{for:"tk-text"},"Task"), text),
      h("div",{class:"field"}, h("label",{for:"tk-owner"},"Who"), owner), h("div",{class:"field"}, h("label",{for:"tk-due"},"Due"), due)),
    h("div",{class:"d-actions"}, id ? deleteButton(async()=>{ await db.collection("tasks").doc(id).delete(); }, status) : h("span",{}),
      h("button",{class:"btn primary", type:"button", onclick:async()=>{
        if (!db) return toast("The hub's shared data isn't available in this view.");
        if (!text.value.trim() || !owner.value){ status.textContent = "Add the task and who it's for."; return; }
        const data = {text:text.value.trim(), ownerId:owner.value, due:due.value};
        try{ id ? await db.collection("tasks").doc(id).update(data) : await db.collection("tasks").add({...data, done:false, meetingId:"", createdBy:S.meId||"", createdAt:new Date().toISOString()}); closeDrawer(); toast("Saved."); }
        catch(e){ status.textContent = dbErr(e); }
      }},"Save")), status
  ]);
}
/* ---------- access (admins) ---------- */
function viewAccess(){
  if (S.access !== "admin") return [h("div",{class:"panel empty"},"Only admins can manage access.")];
  const rows = S.allowed.slice().sort((a,b)=>a.id.localeCompare(b.id));
  const teamFor = a => teamById(a.teamId) || S.team.find(t=>(t.email||"").toLowerCase()===a.id);
  return [
    h("div",{class:"spread"}, h("div",{}, h("div",{class:"eyebrow"},"Admin"), h("h2",{},"Who can sign in")),
      h("div",{class:"row"}, h("button",{class:"btn", type:"button", onclick:openImport},"Import data"),
        h("button",{class:"btn primary", type:"button", onclick:openAddAccess},"+ Add email"))),
    h("div",{class:"access-levels"}, ...ACCESS.map(([k,l,d]) => h("div",{class:"panel level"}, h("b",{}, l), h("span",{class:"small muted"}, d)))),
    h("div",{class:"panel"}, rows.length ? rows.map(a => {
      const sel = h("select",{"aria-label":"Access for "+a.id}, ...ACCESS.map(([k,l])=>h("option",{value:k}, l))); sel.value = a.access || "member";
      sel.onchange = async () => { try{ await setAccess(a.id, {access:sel.value}); toast(`${a.id} is now ${accessLabel(sel.value)}.`); }catch(e){ toast(dbErr(e)); } };
      const tm = teamFor(a);
      return h("div",{class:"acc-row"}, h("span",{style:"word-break:break-all; font-weight:700"}, a.id),
        h("span",{class:"small"}, tm ? tm.name : h("span",{class:"muted"},"Not linked to a teammate")), sel,
        a.id === S.myEmail ? h("span",{class:"small muted"},"You") : deleteButton(async()=>{ await removeAccess(a.id); }, {set textContent(v){ toast(v); }}));
    }) : h("div",{class:"empty"},"Nobody added yet. Add each teammate's Google email so they can sign in.")),
    h("p",{class:"small muted", style:"margin:0"},"Admins listed in config.js can always sign in, even if they're not on this list.")
  ];
}
function openAddAccess(){
  const email = h("input",{type:"email", id:"ac-email", placeholder:"name@gmail.com"});
  const who = h("select",{id:"ac-team"}, h("option",{value:""},"Not a teammate"), ...S.team.map(t=>h("option",{value:t.id}, t.name)));
  const lvl = h("select",{id:"ac-level"}, ...ACCESS.map(([k,l])=>h("option",{value:k}, l))); lvl.value = "member";
  const status = h("div",{class:"cmp-status"});
  openDrawer("Add a sign-in", [
    h("p",{class:"small muted", style:"margin:0"},"Use the Google account they'll sign in with. Gmail works; so does any work email that's a Google account."),
    h("div",{class:"fields"},
      h("div",{class:"field full"}, h("label",{for:"ac-email"},"Email"), email),
      h("div",{class:"field"}, h("label",{for:"ac-team"},"Teammate"), who),
      h("div",{class:"field"}, h("label",{for:"ac-level"},"Access"), lvl)),
    h("div",{class:"d-actions"}, status, h("button",{class:"btn primary", type:"button", onclick:async()=>{
      const e = email.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){ status.textContent = "That email doesn't look right."; return; }
      try{
        await setAccess(e, {access:lvl.value, teamId:who.value});
        const t = teamById(who.value);
        if (t && !t.email) await db.collection("team").doc(t.id).update({email:e});
        closeDrawer(); toast(`${e} can sign in now.`);
      }catch(err){ status.textContent = dbErr(err); }
    }},"Add"))
  ]);
}
function openImport(){
  const file = h("input",{type:"file", id:"im-file", accept:".json,application/json"});
  const status = h("div",{class:"cmp-status", "aria-live":"polite"});
  openDrawer("Import data", [
    h("p",{class:"small muted", style:"margin:0"},"Choose a data file from the project's data-export folder (the full hub-data.json, or a small patch file). Only the fields in the file change; nothing is deleted."),
    h("div",{class:"field"}, h("label",{for:"im-file"},"Data file"), file),
    h("div",{class:"d-actions"}, status, h("button",{class:"btn primary", type:"button", onclick:async()=>{
      const f = file.files[0]; if (!f){ status.textContent = "Choose the file first."; return; }
      try{
        const json = JSON.parse(await f.text());
        const n = await importData(json, (done, total) => { status.textContent = `Imported ${done} of ${total}…`; });
        closeDrawer(); toast(`Imported ${n} items.`);
      }catch(e){ status.textContent = e instanceof SyntaxError ? "That file isn't valid JSON." : dbErr(e); }
    }},"Import"))
  ]);
}

/* ---------- monthly planner ---------- */
// owners are fixed by content type: newsletter → Cherie + Mindy, recap → Gaia, everything else → Esther
const OWNER_RULES = [
  ["Newsletter posts", t => t === "Newsletter", ["cherie","mindy"]],
  ["Recap reels", t => t === "Event recap", ["gaia"]],
  ["Everything else", () => true, ["esther"]]
];
function ownersForType(type){
  const rule = OWNER_RULES.find(([, test]) => test(type));
  return rule[2].filter(id => teamById(id));
}
const itemOwners = it => ownersForType(it.type);
const PLAN_GROUPS = {
  spotlight:"FIESTA · Founder Spotlights", interview:"FIESTA · Interview reels", wins:"FIESTA · Founder WINs",
  newsletter:"FIESTA FOCUS newsletter", recap:"Recap reel", promo:"FIESTA · Promotion",
  fhInterview:"FoundHERs · Interview reels", fhPromo:"FoundHERs · Promotion", fhNewsletter:"HERald newsletter", fhCarousel:"FoundHERs · Gathering carousels"
};
function buildPlan({eventDate, n, names, start, end, nextEvent, lead, fhDate, fhN}){
  const out = [];
  const add = (group, brand, d, time, title, type, format) => out.push({group, brand, publishDate:ymd(d), time, title, type, format, deadline:ymd(addDays(d, -lead))});
  const s = parse(start), e = parse(end);
  const range = (limit) => { const a = []; for (let d = s; d <= limit; d = addDays(d,1)) a.push(d); return a; };
  const win = range(e), long = range(addDays(s, 120));
  const tag = k => names[k-1] ? `: ${names[k-1]}` : "";
  // FIESTA: spotlights M/W/F and interview reels Tu/Th, one per pitcher
  let k = 0;
  for (const d of long){ if (k>=n) break; if ([1,3,5].includes(d.getDay())){ k++; add("spotlight","FIESTA", d, "12 PM", `Founder Spotlight #${k}${tag(k)}`, "Founder Spotlight", "Carousel"); } }
  k = 0;
  for (const d of long){ if (k>=n) break; if ([2,4].includes(d.getDay())){ k++; add("interview","FIESTA", d, "6 PM", `Founder Interview #${k}${tag(k)}`, "Interview reel", "Reel"); } }
  const sat = win.find(d=>d.getDay()===6);
  if (sat) add("recap","FIESTA", sat, "11 AM", `${monthName(eventDate)} Meetup Recap`, "Event recap", "Reel");
  let w = 0, t = 0;
  for (const d of win) if (d.getDay()===2){
    w++; add("wins","FIESTA", d, "3 PM", `Founder WINs #${w}`, "Founder WINs", "Carousel");
    if (t++ % 2 === 0) add("newsletter","FIESTA", d, "12 PM", "FIESTA FOCUS Newsletter", "Newsletter", "Story");
  }
  if (nextEvent){
    const ne = parse(nextEvent), mn = monthName(nextEvent);
    for (const [o, ti, fm] of [[-12, `${mn} Meetup Promotion`, "Poster"], [-5, `${mn} Meetup Reminder`, "Story"], [-2, "Final Meetup Reminder", "Story"]]){
      const d = addDays(ne, o); if (d >= s) add("promo","FIESTA", d, "6 PM", ti, "Promotion", fm);
    }
  }
  // FoundHERs: interview reels on Fridays, then the gathering's promo, recap, newsletter and carousels
  k = 0;
  for (const d of long){ if (k>=fhN) break; if (d.getDay()===5){ k++; add("fhInterview","FoundHERs", d, "6 PM", `FoundHERs Founder Interview #${k}`, "Interview reel", "Reel"); } }
  if (fhDate){
    const G = parse(fhDate), mn = monthName(fhDate);
    const fh = (o, group, time, title, type, format) => { const d = addDays(G, o); if (d >= s) add(group, "FoundHERs", d, time, title, type, format); };
    fh(-6, "fhPromo", "6 PM", `${mn} Gathering Promotion`, "Promotion", "Poster");
    fh(0, "recap", "Evening", `${mn} Gathering Recap`, "Event recap", "Reel");
    fh(3, "fhNewsletter", "12 PM", "HERald Newsletter Announcement", "Newsletter", "Post");
    fh(6, "fhCarousel", "6 PM", "Gathering Carousel #1", "Gathering carousel", "Carousel");
    fh(13, "fhCarousel", "6 PM", "Gathering Carousel #2", "Gathering carousel", "Carousel");
  }
  return out.sort((a,b)=>a.publishDate.localeCompare(b.publishDate) || hourOf(a.time)-hourOf(b.time));
}
function ownerRulesList(){
  return h("ul",{class:"duties", style:"margin-top:4px"}, ...OWNER_RULES.map(([label,, ids]) =>
    h("li",{}, h("b",{}, label), " → ", ids.map(id => teamById(id)?.name || id).join(", "))));
}
function openPlanner(eventId){
  const evs = allEvents().filter(e=>e.date && !e.cancelled);
  const fiestas = evs.filter(e=>e.brand==="FIESTA").sort((a,b)=>a.date.localeCompare(b.date));
  if (!fiestas.length){ toast("Set up the FIESTA meetup schedule on the Event org chart page first."); setView("events"); return; }
  const fhs = evs.filter(e=>e.brand==="FoundHERs" && e.recurring).sort((a,b)=>a.date.localeCompare(b.date));
  const pick = fiestas.find(e=>e.id===eventId) || fiestas.filter(e=>e.date<=today()).pop() || fiestas[0];
  const evSel = h("select",{id:"pl-event"}, ...fiestas.map(e=>h("option",{value:e.id}, `${e.name} (${fmtShort(e.date)})`))); evSel.value = pick.id;
  const nIn = h("input",{type:"text", inputmode:"numeric", id:"pl-n"});
  const nextIn = h("input",{type:"date", id:"pl-next"});
  const fhIn = h("input",{type:"date", id:"pl-fh"});
  const fhNIn = h("input",{type:"text", inputmode:"numeric", id:"pl-fhn"}); fhNIn.value = "2";
  const startIn = h("input",{type:"date", id:"pl-start"});
  const endIn = h("input",{type:"date", id:"pl-end"});
  const leadIn = h("input",{type:"text", inputmode:"numeric", id:"pl-lead"}); leadIn.value = "2";
  const status = h("div",{class:"cmp-status", "aria-live":"polite"});
  const out = h("div",{class:"preview"});
  let names = [];
  async function loadEvent(){
    const ev = fiestas.find(e=>e.id===evSel.value);
    const next = fiestas.find(e=>e.recurring && e.date > ev.date);
    nextIn.value = next ? next.date : "";
    startIn.value = ymd(addDays(parse(ev.date), 1));
    endIn.value = next ? ymd(addDays(parse(next.date), -1)) : ymd(addDays(parse(ev.date), 28));
    const g = fhs.find(e => e.date >= startIn.value);
    fhIn.value = g ? g.date : "";
    names = [];
    try{ const s = await db.collection(`events/${ev.id}/founders`).get(); names = s.docs.map(d=>d.data()).sort((a,b)=>(a.order??999)-(b.order??999)).map(f=>f.name).filter(Boolean); }catch(e){}
    nIn.value = names.length ? String(names.length) : (nIn.value || "");
    status.textContent = names.length ? `${names.length} pitchers on this meetup's list. Their names go into the post titles.` : "No pitcher list for this meetup yet. Enter how many founders pitched.";
    out.replaceChildren();
  }
  evSel.onchange = loadEvent;
  const preview = h("button",{class:"btn primary", type:"button"},"Preview plan");
  preview.onclick = () => {
    const ev = fiestas.find(e=>e.id===evSel.value);
    const n = parseInt(nIn.value, 10), lead = parseInt(leadIn.value, 10), fhN = parseInt(fhNIn.value || "0", 10);
    if (!(n>=0)){ status.textContent = "Enter how many founders pitched at FIESTA (a number)."; return; }
    if (!(fhN>=0)){ status.textContent = "Enter how many FoundHERs interview reels (a number)."; return; }
    if (!(lead>=0)){ status.textContent = "Enter the lead time in days (a number)."; return; }
    if (!startIn.value || !endIn.value || endIn.value < startIn.value){ status.textContent = "Check the plan dates: the end has to be after the start."; return; }
    const plan = buildPlan({eventDate:ev.date, n, names, start:startIn.value, end:endIn.value, nextEvent:nextIn.value, lead, fhDate:fhIn.value, fhN});
    const exists = new Set(S.content.map(c=>c.publishDate+"|"+(c.title||"").toLowerCase()));
    const boxes = plan.map(p => { const cb = h("input",{type:"checkbox", "aria-label":"Include "+p.title}); cb.checked = !exists.has(p.publishDate+"|"+p.title.toLowerCase()); return cb; });
    const create = h("button",{class:"btn primary", type:"button"}, "Create posts & ask owners to review");
    create.onclick = async () => {
      const picks = plan.filter((_,i)=>boxes[i].checked);
      if (!picks.length){ status.textContent = "Nothing selected."; return; }
      create.disabled = true; status.textContent = `Creating ${picks.length} posts…`;
      const now = new Date().toISOString();
      try{
        for (const p of picks){
          const {group, ...rest} = p;
          await db.collection("content").add({...rest, status:"Drafting", ownerIds: ownersForType(p.type), needsReview:true, planEvent:ev.id, notes:"", driveUrl:"", finalUrl:"", createdAt:now, updatedAt:now});
        }
      }catch(e){ status.textContent = dbErr(e); create.disabled = false; return; }
      const byOwner = {};
      for (const p of picks) for (const o of ownersForType(p.type)) (byOwner[o] ||= []).push(p);
      const others = Object.keys(byOwner).filter(o=>o!==S.meId);
      const lines = list => list.map(p => `- ${fmt(p.publishDate)} · ${p.time} · ${p.brand} · ${p.title} (${p.format}), due ${fmtShort(p.deadline)}`).join("\n");
      if (S.meId && Object.keys(byOwner).length){
        const text = Object.keys(byOwner).map(o=>"@"+nameOf(o)).join(" ") + ` I drafted ${picks.length} FIESTA & FoundHERs posts for next month. Please check yours on the calendar (amber outline), fix anything that's off, and click “Looks good.”`;
        try{ await db.collection("messages").add({thread:"general", text, authorId:S.meId, mentions:Object.keys(byOwner), createdAt:new Date().toISOString()}); }catch(e){}
      }
      const results = [];
      if (others.length){
        const r = await sendEmail(others, "Please review: next month's FIESTA & FoundHERs posts",
          `Hi all,\n\n${nameOf(S.meId)} drafted next month's content.\n\n` + others.map(o => `${nameOf(o)}:\n${lines(byOwner[o])}`).join("\n\n") +
          `\n\nOpen the hub, click each post to check the date, deadline and brief, fix anything that's off, then click "Looks good."\n${HUB_URL}`);
        results.push(r.msg);
      }
      closeDrawer();
      toast(`Created ${picks.length} posts.` + (results.length ? " " + results.join(" ") : " They're marked for review on the calendar."));
      S.month = firstOfMonth(parse(picks[0].publishDate)); setView("calendar");
    };
    out.replaceChildren(
      h("div",{class:"small"}, h("b",{}, `${plan.length} posts`), ` from ${fmtShort(startIn.value)}. Already-planned posts are unchecked.`),
      h("div",{class:"plan-scroll"}, h("table",{class:"plan-table"},
        h("thead",{}, h("tr",{}, h("th",{},""), h("th",{},"Goes live"), h("th",{},"Post"), h("th",{},"Due"), h("th",{},"Owner"))),
        h("tbody",{}, ...plan.map((p,i) => h("tr",{}, h("td",{}, boxes[i]), h("td",{class:"mono"}, `${fmtShort(p.publishDate)} ${p.time}`),
          h("td",{}, h("div",{class:"row", style:"gap:6px"}, brandChip(p.brand), p.title), h("div",{class:"small muted"}, `${p.format} · ${PLAN_GROUPS[p.group]}`)),
          h("td",{class:"mono"}, fmtShort(p.deadline)),
          h("td",{}, ownersForType(p.type).map(nameOf).join(", ") || "—")))))),
      h("div",{class:"d-actions"}, h("span",{class:"small muted"},"Owners get an @mention, plus one email with their list."), create));
    status.textContent = "";
  };
  openDrawer("Plan a month: FIESTA & FoundHERs", [
    h("p",{class:"small muted", style:"margin:0"},"Builds the month from your default schedule. FIESTA spotlights and interview reels scale with how many founders pitched. Every post comes in as a draft marked “Needs review.”"),
    h("div",{class:"eyebrow"},"FIESTA"),
    h("div",{class:"fields"},
      h("div",{class:"field full"}, h("label",{for:"pl-event"},"Meetup the content is about"), evSel),
      h("div",{class:"field"}, h("label",{for:"pl-n"},"Founders who pitched"), nIn),
      h("div",{class:"field"}, h("label",{for:"pl-next"},"Next meetup (for promotion)"), nextIn)),
    h("div",{class:"eyebrow"},"FoundHERs"),
    h("div",{class:"fields"},
      h("div",{class:"field"}, h("label",{for:"pl-fh"},"Gathering date"), fhIn),
      h("div",{class:"field"}, h("label",{for:"pl-fhn"},"Interview reels"), fhNIn)),
    h("div",{class:"eyebrow"},"Dates"),
    h("div",{class:"fields"},
      h("div",{class:"field"}, h("label",{for:"pl-start"},"Plan from"), startIn),
      h("div",{class:"field"}, h("label",{for:"pl-end"},"Plan until"), endIn),
      h("div",{class:"field"}, h("label",{for:"pl-lead"},"Deadline: days before posting"), leadIn)),
    h("div",{class:"facts"}, h("div",{class:"wide"}, h("dt",{},"Owners (fixed by content type)"), h("dd",{}, ownerRulesList()))),
    preview, status, out
  ]);
  loadEvent();
}

/* ---------- content item drawer ---------- */
function ownerPicker(prefix, selected){
  const boxes = S.team.map(t => { const cb = h("input",{type:"checkbox", id:`${prefix}-own-${t.id}`, value:t.id}); cb.checked = selected.includes(t.id); return cb; });
  const el = h("div",{class:"owners"}, ...(S.team.length ? S.team.map((t,i) => h("label",{for:boxes[i].id}, boxes[i], t.name)) : [h("span",{class:"small muted"},"Add people on the Team tab first.")]));
  return {el, get:()=>boxes.filter(b=>b.checked).map(b=>b.value)};
}
function deleteButton(fn, status){
  const wrap = h("span",{class:"row"});
  const ask = () => wrap.replaceChildren(h("span",{class:"small"},"Delete for everyone?"),
    h("button",{class:"btn sm danger", type:"button", onclick:async()=>{ try{ await fn(); closeDrawer(); toast("Deleted."); }catch(e){ status.textContent = dbErr(e); } }},"Delete"),
    h("button",{class:"btn sm ghost", type:"button", onclick:reset},"Cancel"));
  const reset = () => wrap.replaceChildren(h("button",{class:"btn ghost danger", type:"button", onclick:ask},"Delete"));
  reset(); return wrap;
}
function openItemReadOnly(it){
  const drive = safeUrl(it.driveUrl), final = safeUrl(it.finalUrl);
  openDrawer("", [
    h("div",{class:"row"}, brandChip(it.brand), it.format ? h("span",{class:"pill"}, it.format) : null, h("span",{class:"pill"}, it.status), isLate(it) ? h("span",{class:"pill bad"},"Past its date") : null),
    h("dl",{class:"facts"},
      h("div",{}, h("dt",{},"Deadline"), h("dd",{}, ...(it.deadline ? [h("span",{class:"mono"}, fmt(it.deadline)), " ", deadlinePill(it)] : ["Not set"]))),
      h("div",{}, h("dt",{},"Goes live"), h("dd",{}, it.publishDate ? h("span",{class:"mono"}, fmt(it.publishDate) + (it.time ? " · "+it.time : "")) : "Not scheduled")),
      h("div",{class:"wide"}, h("dt",{},"Content"), h("dd",{style:"white-space:pre-wrap"}, it.notes || "No brief yet.")),
      h("div",{class:"wide"}, h("dt",{},"Finished file"), h("dd",{}, final ? h("a",{href:final, target:"_blank", rel:"noopener"},"Open finished file ↗") : "Not uploaded yet.")),
      h("div",{class:"wide"}, h("dt",{},"Owner"), h("dd",{}, itemOwners(it).map(nameOf).join(", ") || "Nobody yet"))),
    drive ? h("a",{class:"btn", href:drive, target:"_blank", rel:"noopener", style:"align-self:flex-start"},"Working folder ↗") : null,
    h("p",{class:"small muted", style:"margin:0"},"Only content managers and admins can change calendar items. Leave a note below instead."),
    h("section",{class:"d-thread"}, h("div",{style:"padding:12px 14px 0"}, h("h3",{},"Discussion")), threadList(it.id), composer(it.id, () => it.title))
  ], it.title);
  updateThreads();
}
function openItem(id){
  const it = id ? S.content.find(c=>c.id===id) : {brand:"FIESTA", type:"Founder Spotlight", format:"Carousel", time:"12 PM", status:"Idea", ownerIds:S.meId?[S.meId]:[]};
  if (!it) return;
  if (!canContent()){ if (id) openItemReadOnly(it); return; }
  const f = {
    title: h("input",{type:"text", id:"it-title", placeholder:"Founder WIN: …"}),
    brand: h("select",{id:"it-brand"}, ...Object.entries(BRANDS).map(([k,B])=>h("option",{value:k},B.label))),
    type: h("select",{id:"it-type"}, ...TYPES.map(c=>h("option",{value:c},c))),
    status: h("select",{id:"it-status"}, ...STATUSES.map(c=>h("option",{value:c},c))),
    publishDate: h("input",{type:"date", id:"it-pub"}),
    deadline: h("input",{type:"date", id:"it-due"}),
    driveUrl: h("input",{type:"url", id:"it-drive", placeholder:"https://drive.google.com/…"}),
    finalUrl: h("input",{type:"url", id:"it-final", placeholder:"Link to the finished file in Drive"}),
    format: h("select",{id:"it-format"}, ...FORMATS.map(c=>h("option",{value:c}, c || "—"))),
    time: h("input",{type:"text", id:"it-time", placeholder:"12 PM"}),
    notes: h("textarea",{id:"it-notes", rows:"4", placeholder:"What the post says: featured founder, key points, caption draft…"})
  };
  for (const k of Object.keys(f)) f[k].value = it[k] || "";
  if (!TYPES.includes(it.type) && it.type) f.type.append(h("option",{value:it.type}, it.type)), f.type.value = it.type;
  // owner follows the content type (see OWNER_RULES); shown, not picked
  const ownerTxt = h("div",{class:"owner-fixed"});
  const paintOwner = () => { ownerTxt.textContent = (ownersForType(f.type.value).map(nameOf).join(", ") || "—") + "  ·  set by content type"; };
  f.type.addEventListener("change", paintOwner); paintOwner();
  const status = h("div",{class:"cmp-status", "aria-live":"polite"});
  const drive = safeUrl(it.driveUrl);
  const remind = h("button",{class:"btn", type:"button", onclick:async()=>{
    const ids = itemOwners(it).filter(x=>x!==S.meId);
    if (!ids.length){ status.textContent = "Add an owner (other than you) to send a reminder."; return; }
    if (!S.meId){ toast("Choose your name at the top first."); return; }
    remind.disabled = true; status.textContent = "Emailing…";
    const due = it.deadline ? fmt(it.deadline) : "soon";
    const r = await sendEmail(ids, `Reminder: "${it.title}" is due ${due}`,
      `Hi! Quick reminder from ${nameOf(S.meId)}: "${it.title}" (${(BRANDS[it.brand]||{}).label||it.brand}, ${it.type}) is due ${due}.\n\nStatus: ${it.status}` + (drive ? `\nDrive: ${drive}` : "") + (HUB_URL ? `\n\nOpen the hub: ${HUB_URL}` : ""));
    status.textContent = r.msg; remind.disabled = false;
  }},"Email deadline reminder");
  const final = safeUrl(it.finalUrl);
  const paint = () => seg.querySelectorAll("button").forEach((b,i) => { b.setAttribute("aria-pressed", String(FLOW[i]===it.status)); b.classList.toggle("done", FLOW.indexOf(it.status) > i); });
  const seg = h("div",{class:"seg", role:"group", "aria-label":"Progress"}, ...FLOW.map(s => h("button",{type:"button", onclick:async()=>{
    if (!db || !id || it.status===s) return;
    try{ await db.collection("content").doc(id).update({status:s, updatedAt:new Date().toISOString()}); it.status = s; f.status.value = s; paint(); toast(`Marked ${s}.`); }
    catch(e){ status.textContent = dbErr(e); }
  }}, s)));
  paint();
  openDrawer(id ? "" : "New content item", [
    id ? h("div",{class:"row"}, brandChip(it.brand), it.format ? h("span",{class:"pill"}, it.format) : null, it.needsReview ? h("span",{class:"pill warn"},"Needs review") : null, isLate(it) ? h("span",{class:"pill bad"},"Past its date") : null) : null,
    id ? h("div",{class:"field"}, h("span",{class:"lbl"},"Progress"), seg) : null,
    id ? h("dl",{class:"facts"},
      h("div",{}, h("dt",{},"Deadline"), h("dd",{}, ...(it.deadline ? [h("span",{class:"mono"}, fmt(it.deadline)), " ", deadlinePill(it)] : ["Not set"]))),
      h("div",{}, h("dt",{},"Goes live"), h("dd",{}, it.publishDate ? h("span",{class:"mono"}, fmt(it.publishDate) + (it.time ? " · "+it.time : "")) : "Not scheduled")),
      h("div",{class:"wide"}, h("dt",{},"Content"), h("dd",{style:"white-space:pre-wrap"}, it.notes || "No brief yet. Add what this post says below.")),
      h("div",{class:"wide"}, h("dt",{},"Finished file"), h("dd",{}, final ? h("a",{href:final, target:"_blank", rel:"noopener"},"Open finished file ↗") : "Not uploaded yet. Paste the link below when it's done.")),
      h("div",{class:"wide"}, h("dt",{},"Owner"), h("dd",{}, itemOwners(it).map(nameOf).join(", ") || "Nobody yet"))) : null,
    id ? h("div",{class:"row"},
      it.needsReview ? h("button",{class:"btn primary", type:"button", onclick:async()=>{
        if (!db) return;
        try{ await db.collection("content").doc(id).update({needsReview:false, reviewedBy:S.meId||""}); toast("Marked as reviewed."); closeDrawer(); }catch(e){ status.textContent = dbErr(e); }
      }},"Looks good") : null,
      drive ? h("a",{class:"btn", href:drive, target:"_blank", rel:"noopener"},"Working folder ↗") : null,
      remind) : null,
    h("div",{class:"fields"},
      h("div",{class:"field full"}, h("label",{for:"it-title"},"Title"), f.title),
      h("div",{class:"field"}, h("label",{for:"it-brand"},"Brand"), f.brand),
      h("div",{class:"field"}, h("label",{for:"it-type"},"Type"), f.type),
      h("div",{class:"field"}, h("label",{for:"it-format"},"Format"), f.format),
      h("div",{class:"field"}, h("label",{for:"it-status"},"Status"), f.status),
      h("div",{class:"field"}, h("label",{for:"it-pub"},"Goes live (date)"), f.publishDate),
      h("div",{class:"field"}, h("label",{for:"it-time"},"Time"), f.time),
      h("div",{class:"field"}, h("label",{for:"it-due"},"Deadline"), f.deadline),
      h("div",{class:"field full"}, h("span",{class:"lbl"},"Owner"), ownerTxt),
      h("div",{class:"field full"}, h("label",{for:"it-notes"},"Content brief & caption"), f.notes),
      h("div",{class:"field full"}, h("label",{for:"it-drive"},"Working folder (raw files, drafts)"), f.driveUrl),
      h("div",{class:"field full"}, h("label",{for:"it-final"},"Finished file location"), f.finalUrl)),
    h("div",{class:"d-actions"},
      id ? deleteButton(async()=>{ await db.collection("content").doc(id).delete(); }, status) : h("span",{}),
      h("button",{class:"btn primary", type:"button", onclick:async()=>{
        if (!db) return toast("The hub's shared data isn't available in this view.");
        const title = f.title.value.trim(); if (!title){ status.textContent = "Give it a title."; return; }
        const data = {title, brand:f.brand.value, type:f.type.value, status:f.status.value, publishDate:f.publishDate.value, deadline:f.deadline.value,
          driveUrl:f.driveUrl.value.trim(), finalUrl:f.finalUrl.value.trim(), format:f.format.value, time:f.time.value.trim(),
          notes:f.notes.value.trim(), ownerIds:ownersForType(f.type.value), updatedAt:new Date().toISOString()};
        try{
          if (id){ await db.collection("content").doc(id).update(data); toast("Saved."); closeDrawer(); }
          else { const ref = db.collection("content").doc(); await ref.set({...data, createdAt:data.updatedAt}); toast("Added to the calendar."); closeDrawer(); }
        }catch(e){ status.textContent = dbErr(e); }
      }}, id ? "Save changes" : "Add to calendar")),
    status,
    id ? h("section",{class:"d-thread"},
      h("div",{style:"padding:12px 14px 0"}, h("h3",{},"Discussion")),
      threadList(id), composer(id, () => it.title)) : null
  ], id ? it.title : null);
  updateThreads();
}

/* ---------- drawer ---------- */
function openDrawer(title, body, heading){
  const d = document.getElementById("drawer");
  d.replaceChildren(
    h("div",{class:"d-head"}, h("h3",{id:"d-title"}, heading || title), h("button",{class:"btn ghost sm", type:"button", onclick:closeDrawer},"Close")),
    h("div",{class:"d-body"}, ...body.filter(Boolean)));
  d.setAttribute("aria-labelledby","d-title");
  d.hidden = false; document.getElementById("scrim").hidden = false;
  const first = d.querySelector("input,select,textarea"); if (first && !heading) first.focus();
}
function closeDrawer(){ document.getElementById("drawer").hidden = true; document.getElementById("scrim").hidden = true; }
document.getElementById("scrim").onclick = closeDrawer;
document.addEventListener("keydown", e => { if (e.key==="Escape" && !document.getElementById("drawer").hidden && !document.querySelector(".mention-menu:not([hidden])")) closeDrawer(); });
