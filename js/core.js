// Shared state, helpers and domain rules. Views import from here; this file imports no views.
import { db } from "../firebase.js";
export { db };

export const HUB_URL = location.origin + location.pathname;

/* ---------- state ---------- */
export const S = {
  team:[], content:[], messages:[], chats:[], sops:[], links:{}, events:[], series:[], tasks:[], kpis:[], allowed:[],
  meetCfg:null, access:null, myEmail:"", myAllowed:null, googleName:"", meId:"",
  view: tabLoad("hub.view") || "home", month: firstOfMonth(new Date()), dbState:"loading",
  brandOff:new Set(), platformOff:new Set(), teamTab: load("hub.teamTab") || "chart", chartId: "fiesta",
  sopOpen:"", reqFilter:"all", reqView: load("hub.reqView") || "people", weekOff:0, kpiMonth:"", kpiCompare:"", kpiPlatform:"instagram"
};
// admins can preview the site as a team member (optionally as a specific person); UI only, kept per browser tab
S.preview = (() => { try{ return JSON.parse(sessionStorage.getItem("hub.preview") || "null"); }catch(e){ return null; } })();
export const realAdmin = () => S.access === "admin";
export const isAdmin = () => realAdmin() && !S.preview;
export function setPreview(p){
  S.preview = p;
  try{ p ? sessionStorage.setItem("hub.preview", JSON.stringify(p)) : sessionStorage.removeItem("hub.preview"); }catch(e){}
  location.reload();
}

/* ---------- small helpers ---------- */
export function load(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
export function save(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
// the page you're on lasts only for this tab: a refresh keeps it, coming back to the site starts on Home
function tabLoad(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }
function tabSave(k, v){ try{ sessionStorage.setItem(k, v); }catch(e){} }
export function h(tag, attrs, ...kids){
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})){
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()){ if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
export const pad = n => String(n).padStart(2, "0");
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m-1, d); };
export const today = () => ymd(new Date());
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const daysUntil = s => Math.round((parse(s) - parse(today())) / 86400000);
export const fmt = s => parse(s).toLocaleDateString("en-US", {weekday:"short", month:"short", day:"numeric"});
export const fmtShort = s => parse(s).toLocaleDateString("en-US", {month:"short", day:"numeric"});
export const monthName = s => parse(s).toLocaleDateString("en-US", {month:"long"});
export function firstOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
export const safeUrl = u => /^https?:\/\//i.test(u || "") ? u : null;
export const lines = s => String(s || "").split("\n").map(x => x.trim()).filter(Boolean);
export const slug = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
export const hourOf = t => { if (!t) return 99; if (/evening/i.test(t)) return 19.5; const m = String(t).match(/(\d+)(?::(\d+))?\s*(AM|PM)/i); return m ? (+m[1]) % 12 + (/pm/i.test(m[3]) ? 12 : 0) + (m[2] ? +m[2]/60 : 0) : 99; };
export function relTime(iso){
  const diff = (Date.now() - new Date(iso)) / 60000;
  if (diff < 1) return "just now"; if (diff < 60) return `${Math.floor(diff)}m ago`; if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", {month:"short", day:"numeric"});
}
export async function resizeImage(file, max){
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("encode")), "image/jpeg", 0.86));
}
export const blobToDataUrl = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });

/* ---------- icons (24px line icons, currentColor) ---------- */
const ICONS = {
  home:"M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  calendar:"M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  requests:"M3 4h5v16H3zM10 4h5v10h-5zM17 4h4v6h-4z",
  analytics:"M3 3v18h18M7 15l4-4 3 3 6-6",
  team:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  drive:"M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  sops:"M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5",
  cycle:"M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2M18 2v4h-4M6 22v-4h4",
  access:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  logout:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  bell:"M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
  chat:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  instagram:"M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zM16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4zM17.5 6.5h0",
  linkedin:"M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
  newsletter:"M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
  plus:"M12 5v14M5 12h14",
  target:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  compass:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z",
  dollar:"M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  close:"M18 6 6 18M6 6l12 12",
  link:"M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  user:"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  video:"M15 10l6-4v12l-6-4M3 6h12v12H3z"
};
export function icon(name, size){
  const s = document.createElement("span"); s.className = "ic"; s.setAttribute("aria-hidden", "true");
  const px = size || 20;
  s.innerHTML = `<svg viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[name] || ""}"/></svg>`;
  return s;
}

/* ---------- people ---------- */
// fixed display order everywhere: Cherie, Jon, Ryan, Tayo, Esther/Kate, Mindy, Gaia
export const PEOPLE_ORDER = ["cherie","john","ryan","tayo","esther","kate","mindy","gaia"];
export const byPeopleOrder = (a, b) => {
  const ia = PEOPLE_ORDER.indexOf(a), ib = PEOPLE_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
};
export const teamSorted = () => S.team.slice().sort((a, b) => byPeopleOrder(a.id, b.id) || (a.name||"").localeCompare(b.name||""));
export const teamById = id => S.team.find(t => t.id === id);
export const nameOf = id => teamById(id)?.name || "Someone";
export const firstName = id => (nameOf(id).split(/\s+/)[0]);
export const emailOf = t => t?.contactEmail || t?.email || "";
// tasks can have several people on them (ownerIds); older ones have a single ownerId
export const taskOwners = t => t?.ownerIds?.length ? t.ownerIds : (t?.ownerId ? [t.ownerId] : []);
export const isMyTask = t => taskOwners(t).includes(S.meId);
function hue(str){ let x = 0; for (const ch of str || "?") x = (x * 31 + ch.charCodeAt(0)) % 360; return x; }
export const initials = n => String(n || "?").split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase();
export function avatar(t, size){
  const n = t?.name || "?", cls = "av" + (size ? " " + size : "");
  if (t?.photo) return h("img",{class:cls, src:t.photo, alt:"", "aria-hidden":"true"});
  return h("span",{class:cls, style:`background:hsl(${hue(n)} 42% 46%)`, "aria-hidden":"true"}, initials(n));
}

/* ---------- content model ---------- */
export const BRANDS = { FIESTA:{label:"FIESTA", c:"var(--fiesta)"}, FoundHERs:{label:"FoundHERs", c:"var(--foundhers)"} };
export const PLATFORMS = {
  Instagram:{label:"Instagram", icon:"instagram", formats:["Carousel","Reel","Story"]},
  LinkedIn:{label:"LinkedIn", icon:"linkedin", formats:["Post"]},
  Newsletter:{label:"Newsletter", icon:"newsletter", formats:["Newsletter"]}
};
export const STATUS = [
  ["todo","Not started"], ["doing","In production"], ["published","Published"]
];
export const statusLabel = k => (STATUS.find(([s]) => s === k) || STATUS[0])[1];
export const NON_POST = new Set(["Shoot","Doc / report","Task"]);
// older records used other field values; read them through this so every view sees one shape
export function normItem(c){
  const legacyStatus = {Idea:"todo", Drafting:"doing", "In review":"doing", Scheduled:"doing", Published:"published", Done:"published"};
  const status = ["todo","doing","published"].includes(c.status) ? c.status : (legacyStatus[c.status] || "todo");
  let brand = c.brand, platform = c.platform;
  if (brand === "Newsletter"){ brand = "FIESTA"; platform = platform || "Newsletter"; }
  if (!BRANDS[brand]) brand = "FIESTA";
  if (!platform) platform = c.type === "Newsletter" ? "Newsletter" : "Instagram";
  let format = c.format;
  if (!PLATFORMS[platform].formats.includes(format)) format = platform === "Instagram" ? (["Poster","Post"].includes(format) ? "Carousel" : (format || "Carousel")) : PLATFORMS[platform].formats[0];
  return {...c, status, brand, platform, format};
}
export const isPost = c => !NON_POST.has(c.type);
export const isDone = c => c.status === "published";
export const isLate = c => c.publishDate && c.publishDate < today() && !isDone(c);
// owners are fixed: newsletters → Cherie + Mindy, recap reels → Gaia, everything else → Esther
export const OWNER_RULES = [
  ["Newsletters", c => c.platform === "Newsletter", ["cherie","mindy"]],
  ["Recap reels", c => c.type === "Event recap" || /recap/i.test(c.title || ""), ["gaia"]],
  ["Everything else", () => true, ["esther"]]
];
export const ownersFor = c => OWNER_RULES.find(([, test]) => test(c))[2].filter(id => teamById(id));
export const posts = () => S.content.map(normItem).filter(isPost);
export function brandChip(b){ const B = BRANDS[b] || {label:b || "—", c:"var(--muted)"}; return h("span",{class:"chip", style:`--c:${B.c}`}, B.label); }
export function statusPill(k){ return h("span",{class:"st st-" + k}, h("i",{}), statusLabel(k)); }
export function deadlinePill(c){
  if (!c.deadline || isDone(c)) return null;
  const n = daysUntil(c.deadline);
  if (n < 0) return h("span",{class:"pill bad"}, `${-n}d overdue`);
  if (n === 0) return h("span",{class:"pill bad"}, "Due today");
  if (n <= 3) return h("span",{class:"pill warn"}, `${n}d left`);
  return h("span",{class:"pill"}, `${n}d left`);
}

/* ---------- events ---------- */
export const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export const NTH = [[1,"1st"],[2,"2nd"],[3,"3rd"],[4,"4th"],[-1,"Last"]];
export function nthWeekday(y, m, nth, wd){
  if (nth === -1){ let d = new Date(y, m+1, 0); while (d.getDay() !== wd) d = addDays(d, -1); return d; }
  let d = new Date(y, m, 1); while (d.getDay() !== wd) d = addDays(d, 1);
  return addDays(d, 7 * (nth - 1));
}
export const seriesById = id => S.series.find(s => s.id === id);
// one occurrence per series per month (overridable), plus one-off special events
export function allEvents(){
  const docs = Object.fromEntries(S.events.map(e => [e.id, e]));
  const out = [], now = new Date();
  for (const s of S.series){
    if (!s.rule) continue;
    for (let k = -3; k <= 6; k++){
      const first = new Date(now.getFullYear(), now.getMonth() + k, 1);
      const id = `${s.id}-${first.getFullYear()}-${pad(first.getMonth()+1)}`, o = docs[id] || {};
      out.push({...o, id, seriesId:s.id, recurring:true, name:s.name, brand:s.brand,
        date: o.date || ymd(nthWeekday(first.getFullYear(), first.getMonth(), s.rule.nth, s.rule.weekday)), cancelled:!!o.cancelled});
    }
  }
  for (const e of S.events) if (!e.seriesId) out.push({...e, special:true});
  return out.filter(e => e.date && !e.cancelled);
}
export const nextEventOf = seriesId => allEvents().filter(e => e.seriesId === seriesId && e.date >= today()).sort((a,b) => a.date.localeCompare(b.date))[0];
export const upcomingSpecials = () => allEvents().filter(e => e.special && e.date >= today()).sort((a,b) => a.date.localeCompare(b.date));
// biweekly team meeting from config/meetings {anchor, every}
export function nextMeeting(from){
  const c = S.meetCfg; if (!c || !c.anchor) return null;
  const every = +c.every || 14; let d = parse(c.anchor); const f = parse(from || today());
  if (d < f) d = addDays(d, Math.ceil((f - d) / (every * 86400000)) * every);
  return ymd(d);
}
export function meetingsBetween(a, b){
  const out = []; let d = nextMeeting(a);
  while (d && d <= b){ out.push(d); d = ymd(addDays(parse(d), +(S.meetCfg.every || 14))); }
  return out;
}

/* ---------- UI plumbing ---------- */
let toastT;
export function toast(msg){ const t = document.getElementById("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 4200); }
export function dbErr(e){
  if (e?.code === "permission-denied") return "You don't have permission to change this. Ask an admin.";
  return "Couldn't save. Check your connection and try again.";
}
export function openDrawer(title, body){
  const d = document.getElementById("drawer");
  d.replaceChildren(
    h("div",{class:"d-head"}, h("h3",{id:"d-title"}, title), h("button",{class:"icon-btn ghost", type:"button", "aria-label":"Close", onclick:closeDrawer}, icon("close", 18))),
    h("div",{class:"d-body"}, ...body.filter(Boolean)));
  d.setAttribute("aria-labelledby", "d-title");
  d.hidden = false; document.getElementById("scrim").hidden = false;
}
export function closeDrawer(){ document.getElementById("drawer").hidden = true; document.getElementById("scrim").hidden = true; }
export function deleteButton(fn, label){
  const wrap = h("span",{class:"row"});
  const reset = () => wrap.replaceChildren(h("button",{class:"btn ghost danger", type:"button", onclick:ask}, label || "Delete"));
  const ask = () => wrap.replaceChildren(h("span",{class:"small"},"Delete for everyone?"),
    h("button",{class:"btn sm danger", type:"button", onclick:async () => { try{ await fn(); closeDrawer(); toast("Deleted."); }catch(e){ toast(dbErr(e)); } }},"Delete"),
    h("button",{class:"btn sm ghost", type:"button", onclick:reset},"Cancel"));
  reset(); return wrap;
}
export function card(title, action, ...body){
  return h("section",{class:"card"}, title ? h("div",{class:"card-h"}, h("h3",{}, title), action || null) : null, ...body);
}
export const linkBtn = (label, onclick) => h("button",{class:"link", type:"button", onclick}, label);
export function field(label, el, full){ return h("div",{class:"field" + (full ? " full" : "")}, h("label",{for:el.id}, label), el); }
export function input(id, value, attrs){ const i = h("input",{type:"text", id, ...(attrs||{})}); i.value = value ?? ""; return i; }
export function select(id, options, value){ const s = h("select",{id}, ...options.map(o => Array.isArray(o) ? h("option",{value:o[0]}, o[1]) : h("option",{value:o}, o))); if (value != null) s.value = value; return s; }
export function textarea(id, value, rows, ph){ const t = h("textarea",{id, rows:String(rows || 3), placeholder:ph || ""}); t.value = value ?? ""; return t; }
// mailto: opens the sender's own mail app (no server needed)
// email without a mail app: posts to the Google Apps Script in tools/email-hook.gs (see config.js)
export function emailHook(hook, ids, subject, body){
  const to = ids.map(teamById).map(emailOf).filter(Boolean);
  if (!hook?.url || !to.length) return false;
  fetch(hook.url, {method:"POST", mode:"no-cors", headers:{"Content-Type":"text/plain"}, body:JSON.stringify({key:hook.key, to, subject, body})}).catch(e => console.warn(e));
  return true;
}
export function sendEmail(ids, subject, body){
  const people = ids.map(teamById).filter(Boolean), withMail = people.filter(p => emailOf(p));
  if (!withMail.length) return "No email on file.";
  window.location.href = `mailto:${withMail.map(emailOf).join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return `Opened an email to ${withMail.map(p => p.name).join(", ")}.`;
}

/* ---------- view registry ---------- */
const VIEWS = {};
export const registerView = (name, fn) => { VIEWS[name] = fn; };
const after = [];
export const onRender = fn => after.push(fn);
export function renderMain(){
  const main = document.getElementById("main");
  if (!main) return;
  const fn = VIEWS[S.view] || VIEWS.home;
  if (!fn) return;
  main.replaceChildren(...fn().filter(Boolean));
  after.forEach(f => f());
}
let navHook = () => {};
export const setNavHook = fn => { navHook = fn; };
export function setView(k){ S.view = k; tabSave("hub.view", k); navHook(); renderMain(); window.scrollTo(0, 0); }
