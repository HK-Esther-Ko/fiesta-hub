// Entry point: sign-in gate, app shell (menu, top bar, notifications, chat button) and live data.
import { onUser, signIn, signOutUser, isBootstrapAdmin, getAccess, sendEmailLink, isEmailLink, savedLinkEmail, finishEmailLink,
  passwordSignIn, setPassword } from "./firebase.js";
import { S, db, h, icon, avatar, isAdmin, renderMain, setView, setNavHook, onRender, load, save, today, daysUntil, fmtShort, relTime,
  teamById, nameOf, posts, isDone, ownersFor, isMyTask, realAdmin, setPreview, normItem } from "./js/core.js";
import "./js/home.js";
import "./js/calendar.js";
import "./js/requests.js";
import "./js/analytics.js";
import "./js/team.js";
import "./js/drive.js";
import "./js/sops.js";
import "./js/cycle.js";
import "./js/access.js";
import { openItem } from "./js/calendar.js";
import { openTask } from "./js/requests.js";
import { openProfile } from "./js/team.js";
import { updateThreads, renderChatButton, renderChatPanel, openChat, threadTitle, seenKey } from "./js/chat.js";

// menu with sub-items that open underneath; each sub-item sets that page's state
const scrollTo = id => setTimeout(() => document.getElementById(id)?.scrollIntoView({behavior:"smooth", block:"start"}), 60);
const NAV = [
  ["home","Home"],
  ["calendar","Calendar", () => [["cal","Calendar", () => true, () => {}], ["up","Coming up", () => false, () => scrollTo("upcoming")]]],
  ["requests","Requests", () => [["all","All"],["mine","Mine"],["asked","I asked for"]].map(([k, l]) => [k, l, () => (S.reqFilter || "all") === k, () => { S.reqFilter = k; }])],
  ["analytics","Analytics", () => [["ig","Instagram", () => true, () => {}]]],
  ["team","Team", () => [["chart","Event org chart"],["roles","Roles"]].map(([k, l]) => [k, l, () => (S.teamTab === "roles" ? "roles" : "chart") === k, () => { S.teamTab = k; save("hub.teamTab", k); }])],
  ["drive","Drive"],
  ["sops","SOPs", () => S.sops.filter(s => !s.hidden).sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0) || (a.order ?? 9) - (b.order ?? 9))
    .map(s => [s.id, s.main ? "Media team SOP" : s.title.replace(/:.*$/, ""), () => S.sopOpen === s.id, () => { S.sopOpen = s.id; }])],
  ["cycle","How we work", () => [["cycle","Monthly cycle","wheel"],["plan","Monthly content plan","plan"],["system","Content system","system"]]
    .map(([k, l, anchor]) => [k, l, () => false, () => scrollTo("hw-" + anchor)])]
];
if (![...NAV.map(([k]) => k), "access"].includes(S.view)) S.view = "home";
const openGroups = new Set([S.view]);

/* ---------- shell ---------- */
document.querySelectorAll("[data-icon]").forEach(el => el.replaceWith(icon(el.dataset.icon)));
const closeMobileNav = () => document.body.classList.remove("nav-open");
function navItem([k, l, kids]){
  const children = kids ? kids() : [];
  const active = S.view === k, open = children.length > 1 && openGroups.has(k);
  const btn = h("button",{class:"nav-item" + (children.length > 1 ? " has-kids" : "") + (open ? " open" : ""), type:"button", "aria-current":active ? "page" : null,
    "aria-expanded":children.length > 1 ? String(open) : null,
    onclick:() => { if (k === "sops") S.sopOpen = ""; if (children.length > 1){ if (active && open) openGroups.delete(k); else openGroups.add(k); } if (!active || !children.length){ setView(k); closeMobileNav(); } else renderNav(); }},
    icon(k === "access" ? "access" : k), h("span",{class:"nav-l"}, l), children.length > 1 ? h("span",{class:"chev", "aria-hidden":"true"}, "▾") : null);
  if (!open) return btn;
  return h("div",{class:"nav-group"}, btn, h("div",{class:"nav-sub"}, ...children.map(([ck, cl, isOn, go]) =>
    h("button",{class:"nav-subitem", type:"button", "aria-current":active && isOn() ? "true" : null, onclick:() => { go(); setView(k); closeMobileNav(); }}, cl))));
}
function renderNav(){
  document.getElementById("nav").replaceChildren(...NAV.map(navItem));
  document.getElementById("nav-foot").replaceChildren(...(isAdmin() ? [navItem(["access","Access"])] : []));
}
// leaving a section folds its submenu; only the section you are on stays open
setNavHook(() => { openGroups.clear(); openGroups.add(S.view); renderNav(); });
document.getElementById("menu-btn").onclick = () => document.body.classList.toggle("nav-open");
document.getElementById("nav-scrim").onclick = closeMobileNav;
function renderHeader(){
  const me = teamById(S.meId);
  document.getElementById("tb-avatar").replaceChildren(avatar(me || {name:S.myEmail || "?"}, "md"));
  document.getElementById("tb-name").textContent = me?.name || S.googleName || S.myEmail;
  document.getElementById("tb-sub").textContent = (me?.role || "") + (isAdmin() ? (me?.role ? " · " : "") + "Admin" : "");
  const n = notifications(), seen = load("hub.nseen." + S.meId) || "", seenNow = seenSticky();
  const count = n.filter(x => x.sticky ? !seenNow.has(x.key) : (x.at || "") > seen).length;
  const b = document.getElementById("bell-count"); b.textContent = count; b.hidden = !count;
  renderChatButton();
  const pv = document.getElementById("preview-bar");
  pv.hidden = !(realAdmin() && S.preview);
  if (!pv.hidden) pv.replaceChildren(h("span",{}, h("b",{},"Preview: "), `team member view${me ? " as " + me.name : ""}. Changes you make still save as you.`),
    h("button",{class:"btn sm", type:"button", onclick:() => setPreview(null)},"Exit preview"));
}
document.getElementById("brand").onclick = () => setView("home");
document.getElementById("me-btn").onclick = () => openProfile(false);
document.getElementById("signout").onclick = () => signOutUser();
document.getElementById("chat-fab").onclick = () => { const p = document.getElementById("chat-panel"); if (p.hidden) openChat(); else p.hidden = true; };
document.getElementById("scrim").onclick = () => { document.getElementById("drawer").hidden = true; document.getElementById("scrim").hidden = true; };
document.addEventListener("keydown", e => { if (e.key === "Escape" && !document.getElementById("drawer").hidden) document.getElementById("scrim").click(); });

/* ---------- notifications ---------- */
// "needs you" items stay in the list until they're resolved, but stop counting on the bell once you've opened it.
// Each key includes the item's state, so a post that goes from "due soon" to "past date" counts again.
const STICKY_KEY = () => "hub.nseenSticky." + S.meId;
function seenSticky(){ try{ return new Set(JSON.parse(load(STICKY_KEY()) || "[]")); }catch(e){ return new Set(); } }
function notifications(){
  if (!S.meId) return [];
  const out = [];
  for (const c of posts().filter(c => ownersFor(c).includes(S.meId) && !isDone(c) && c.publishDate && daysUntil(c.publishDate) <= 2)){
    const d = daysUntil(c.publishDate);
    out.push({sticky:true, key:`post:${c.id}:${d < 0 ? "late" : "soon"}`, tone:d < 0 ? "bad" : "warn", label:d < 0 ? `${-d}d past date` : d === 0 ? "Goes up today" : `Goes up ${fmtShort(c.publishDate)}`, text:c.title, go:() => openItem(c.id)});
  }
  for (const t of S.tasks.filter(t => isMyTask(t) && !t.done && t.due && daysUntil(t.due) <= 2))
    out.push({sticky:true, key:`task:${t.id}:${daysUntil(t.due) < 0 ? "late" : "soon"}`, tone:daysUntil(t.due) < 0 ? "bad" : "warn", label:daysUntil(t.due) < 0 ? "Request late" : "Request due", text:t.text, go:() => openTask(t.id)});
  for (const m of S.messages.filter(m => m.authorId !== S.meId && !m.taskId && ((m.mentions || []).includes(S.meId) || (m.thread.startsWith("dm:") && m.thread.slice(3).split("|").includes(S.meId))))){
    const isDm = m.thread.startsWith("dm:"), post = S.content.find(c => c.id === m.thread);
    out.push({at:m.createdAt, label:isDm ? `${nameOf(m.authorId)} sent you a message` : `${nameOf(m.authorId)} mentioned you` + (post ? ` on “${post.title}”` : ` in ${threadTitle(m.thread)}`), text:m.text,
      go:() => post ? openItem(post.id) : openChat(m.thread)});
  }
  for (const t of S.tasks.filter(t => isMyTask(t) && !t.done && t.createdBy && t.createdBy !== S.meId))
    out.push({at:t.createdAt, label:`New request from ${nameOf(t.createdBy)}`, text:t.text, go:() => openTask(t.id)});
  return out;
}
document.getElementById("bell").onclick = () => {
  const p = document.getElementById("notif");
  if (!p.hidden){ p.hidden = true; return; }
  const seen = load("hub.nseen." + S.meId) || "", n = notifications();
  const now = n.filter(x => x.sticky), recent = n.filter(x => !x.sticky).sort((a, b) => (b.at || "").localeCompare(a.at || "")).slice(0, 25);
  const row = x => h("button",{class:"n-item" + (!x.sticky && (x.at || "") > seen ? " unread" : ""), type:"button", onclick:() => { p.hidden = true; x.go(); }},
    h("div",{class:"n-top"}, x.sticky ? h("span",{class:"pill " + x.tone}, x.label) : h("b",{}, x.label), x.at ? h("span",{class:"muted small"}, relTime(x.at)) : null),
    h("div",{class:"n-text"}, x.text.length > 120 ? x.text.slice(0, 120) + "…" : x.text));
  p.replaceChildren(h("div",{class:"n-head"}, h("h3",{},"Notifications"), h("button",{class:"icon-btn ghost", type:"button", "aria-label":"Close", onclick:() => p.hidden = true}, icon("close", 16))),
    !n.length ? h("div",{class:"empty"},"You're all caught up.")
      : h("div",{}, now.length ? h("div",{class:"n-sec"},"Needs you") : null, ...now.map(row), recent.length ? h("div",{class:"n-sec"},"Recent") : null, ...recent.map(row)));
  p.hidden = false;
  if (recent.length) save("hub.nseen." + S.meId, recent[0].at);
  save(STICKY_KEY(), JSON.stringify(now.map(x => x.key)));
  renderHeader();
};

/* ---------- sign-in gate ---------- */
function showGate(kind, email){
  document.getElementById("app").hidden = true; document.getElementById("gate").hidden = false;
  document.getElementById("gate-signin").hidden = kind !== "signin";
  document.getElementById("gate-signout").hidden = kind !== "denied";
  document.getElementById("gate-alt").hidden = kind !== "signin" || !!(realAdmin() && S.preview?.first);
  document.getElementById("gate-setpw").hidden = kind !== "setpw";
  document.getElementById("gate-msg").textContent = kind === "signin" ? "Sign in with the email your admin added."
    : kind === "setpw" ? `Your email ${email} is confirmed. Set a password so next time you can sign in with it.`
    : `${email} isn't on the team list yet. Ask an admin to add this email, then reload.`;
}
// Google sign-in can't finish inside app browsers (KakaoTalk, Instagram, LINE, Facebook…): they block the popup
const inAppBrowser = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|DaumApps|wv\)/i.test(navigator.userAgent);
function showOpenInBrowser(){
  const msg = document.getElementById("gate-msg");
  msg.replaceChildren(
    "This app's built-in browser can't do Google sign-in. Open the link in Safari or Chrome, or use your email below.",
    h("br"), h("button",{class:"btn sm", type:"button", style:"margin-top:10px", onclick:async ev => {
      try{ await navigator.clipboard.writeText(location.href); ev.target.textContent = "Link copied"; }catch(e){ ev.target.textContent = location.href; } }}, "Copy link"));
}
document.getElementById("gate-signin").onclick = () => {
  if (realAdmin() && S.preview?.first){
    keepPreview({first:false}); document.getElementById("gate-pv").hidden = true;
    document.getElementById("gate").hidden = true; document.getElementById("app").hidden = false;
    if (!started){ started = true; start(); } return;
  }
  if (inAppBrowser){ showOpenInBrowser(); return; }
  signIn().catch(e => {
    if (e?.code === "auth/popup-closed-by-user" || e?.code === "auth/cancelled-popup-request") return;
    if (/missing initial state|storage|popup-blocked|operation-not-supported/i.test((e?.code || "") + " " + (e?.message || ""))){ showOpenInBrowser(); return; }
    document.getElementById("gate-msg").textContent = "Sign-in didn't finish. Try again.";
  });
};
if (inAppBrowser) setTimeout(showOpenInBrowser, 0);
document.getElementById("gate-signout").onclick = () => signOutUser();

// work email (not Google): one form. Email + password signs in. The first time, or after a forgotten password,
// "Verify your email" sends a link; opening it confirms the address (that's the account) and then asks for a password.
const passForm = document.getElementById("gate-pass"), passEmail = document.getElementById("gate-pemail"), passPw = document.getElementById("gate-pw");
const passBtn = document.getElementById("gate-pass-btn"), passMsg = document.getElementById("gate-pass-msg");
const SETPW = "hub.setpw";
const tabGet = k => { try{ return sessionStorage.getItem(k); }catch(e){ return null; } }, tabSet = (k, v) => { try{ v ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k); }catch(e){} };
// unknown errors show their code, so a setup problem (a sign-in method switched off, a domain not allowed) can be found
const AUTH_ERR = {"auth/invalid-credential":"Wrong email or password. First time here? Press Verify your email.", "auth/wrong-password":"Wrong email or password.",
  "auth/user-not-found":"No password for this email yet. Press Verify your email to set one.", "auth/invalid-email":"That email doesn't look right.",
  "auth/too-many-requests":"Too many tries. Wait a few minutes, or press Verify your email to reset.", "auth/weak-password":"Use at least 6 characters.",
  "auth/operation-not-allowed":"This sign-in method isn't switched on in Firebase yet. Ask an admin.",
  "auth/unauthorized-continue-uri":"This site's address isn't on Firebase's allowed domains yet. Ask an admin.",
  "auth/quota-exceeded":"Today's email limit is used up. Try again tomorrow, or sign in with your password."};
const authErr = (e, fallback) => AUTH_ERR[e?.code] || `${fallback} (${e?.code || "unknown error"})`;
async function completeLink(email){
  passMsg.textContent = "Confirming your email…";
  tabSet(SETPW, "1");
  try{ await finishEmailLink(email); passMsg.textContent = ""; }
  catch(e){
    tabSet(SETPW, null); passForm.dataset.mode = ""; passPw.hidden = false; passBtn.textContent = "Sign in";
    passMsg.textContent = e?.code === "auth/invalid-email" ? "That isn't the email the link was sent to. Try again."
      : e?.code === "auth/invalid-action-code" || e?.code === "auth/expired-action-code" ? "That link has expired or was already used. Press Verify your email for a new one."
      : authErr(e, "Couldn't confirm the email.");
  }
}
passForm.onsubmit = async ev => {
  ev.preventDefault();
  const email = passEmail.value.trim().toLowerCase(); if (!email) return;
  if (passForm.dataset.mode === "confirm"){ completeLink(email); return; }
  if (!passPw.value){ passMsg.textContent = "Type your password, or press Verify your email if you don't have one yet."; passPw.focus(); return; }
  passBtn.disabled = true; passMsg.textContent = "Signing in…";
  try{ await passwordSignIn(email, passPw.value); passMsg.textContent = ""; }
  catch(e){ passMsg.textContent = authErr(e, "Couldn't sign in."); }
  passBtn.disabled = false;
};
document.getElementById("gate-verify").onclick = async () => {
  const email = passEmail.value.trim().toLowerCase();
  if (!email || !passEmail.checkValidity()){ passMsg.textContent = "Type your email above first, then press Verify your email."; passEmail.focus(); return; }
  passMsg.textContent = "Sending…";
  try{ await sendEmailLink(email); passMsg.textContent = `We sent a link to ${email}. Open it on this device (check spam too); you'll come back here to set your password.`; }
  catch(e){ passMsg.textContent = authErr(e, "Couldn't send the email."); }
};
if (isEmailLink()){
  const saved = savedLinkEmail();
  if (saved) completeLink(saved);
  else { // opened on another device or browser: ask which address the link was for
    passForm.dataset.mode = "confirm"; passPw.hidden = true; passBtn.textContent = "Confirm email";
    passMsg.textContent = "Type the email this link was sent to, to finish confirming it.";
  }
}
// back from the link: set a password (or skip), then into the site
const newPw = document.getElementById("gate-newpw"), setMsg = document.getElementById("gate-setpw-msg");
document.getElementById("gate-setpw").onsubmit = async ev => {
  ev.preventDefault();
  setMsg.textContent = "Saving…";
  try{ await setPassword(newPw.value); tabSet(SETPW, null); location.reload(); }
  catch(e){ setMsg.textContent = e?.code === "auth/requires-recent-login" ? "That took a while. Press Verify your email again, then set the password right away." : authErr(e, "Couldn't save the password."); }
};
document.getElementById("gate-skip").onclick = () => { tabSet(SETPW, null); location.reload(); };

// who am I: the admin-assigned team card on my Access entry, else a card with my sign-in email
function linkMe(){
  const viaAccess = S.myAllowed?.teamId && teamById(S.myAllowed.teamId) ? S.myAllowed.teamId : "";
  const viaEmail = S.team.find(t => (t.email || "").toLowerCase() === S.myEmail)?.id || "";
  S.meId = viaAccess || viaEmail || "";
  if (realAdmin() && S.preview?.as && teamById(S.preview.as)) S.meId = S.preview.as;
}
function maybeWelcome(){
  const me = teamById(S.meId);
  if (realAdmin() && S.preview?.welcome){ if (me){ keepPreview({welcome:false}); openProfile(true); } return; }
  if (!me || load("hub.onboarded." + S.myEmail) || S.welcomed) return;
  S.welcomed = true;
  if (!me.photo || !me.contactEmail) openProfile(true); else save("hub.onboarded." + S.myEmail, "1");
}

let started = false;
onUser(async user => {
  if (!user){ showGate("signin"); return; }
  // an account whose address was never confirmed (made before the email check moved first) has to confirm it now
  if (!user.emailVerified){ await signOutUser(); showGate("signin"); passEmail.value = user.email || "";
    passMsg.textContent = "Confirm this email first: press Verify your email, open the link, then set your password."; return; }
  S.myEmail = (user.email || "").toLowerCase(); S.googleName = user.displayName || "";
  S.access = isBootstrapAdmin(S.myEmail) ? "admin" : (await getAccess(S.myEmail) ? (await getAccess(S.myEmail) === "admin" ? "admin" : "member") : null);
  if (!S.access){ tabSet(SETPW, null); showGate("denied", user.email); return; }
  if (tabGet(SETPW)){ showGate("setpw", user.email); document.getElementById("gate-setpw-user").value = user.email || ""; newPw.focus(); return; }
  // preview of a teammate's first visit: show the sign-in screen; its button just continues
  if (realAdmin() && S.preview?.first){ showGate("signin"); document.getElementById("gate-pv").hidden = false; return; }
  document.getElementById("gate").hidden = true; document.getElementById("app").hidden = false;
  if (!started){ started = true; start(); }
});
function keepPreview(p){ S.preview = {...S.preview, ...p}; try{ sessionStorage.setItem("hub.preview", JSON.stringify(S.preview)); }catch(e){} }

function start(){
  renderNav(); renderHeader(); renderMain();
  const onErr = e => console.warn(e);
  const live = (path, key, map) => db.collection(path).onSnapshot(s => { S[key] = s.docs.map(d => ({id:d.id, ...d.data()})); if (map) map(); renderHeader(); renderMain(); }, onErr);
  db.doc("allowed/" + S.myEmail).onSnapshot(d => {
    S.myAllowed = d.exists ? d.data() : null;
    const a = isBootstrapAdmin(S.myEmail) ? "admin" : d.exists ? (d.data().access === "admin" ? "admin" : "member") : null;
    if (!a){ showGate("denied", S.myEmail); return; }
    if (a !== S.access){ S.access = a; renderNav(); }
    if (a === "admin" && !S.allowedLive) S.allowedLive = live("allowed", "allowed");
    linkMe(); renderHeader(); renderMain();
  }, onErr);
  live("team", "team", () => { linkMe(); maybeWelcome(); syncOwners(); });
  live("content", "content", syncOwners); live("sops", "sops", renderNav); live("events", "events"); live("series", "series"); live("tasks", "tasks"); live("kpis", "kpis"); live("chats", "chats");
  db.collection("messages").orderBy("createdAt", "desc").limit(500).onSnapshot(s => {
    S.messages = s.docs.map(d => ({id:d.id, ...d.data()})).reverse(); renderHeader(); updateThreads(); renderChatPanel();
  }, onErr);
  db.doc("config/links").onSnapshot(d => { S.links = d.exists ? d.data() : {}; renderMain(); }, onErr);
  db.doc("config/meetings").onSnapshot(d => { S.meetCfg = d.exists ? d.data() : null; renderMain(); }, onErr);
}
// security rules read ownerIds from each post, so an admin's session keeps them matching the fixed owner rules
let syncing = false;
async function syncOwners(){
  if (!realAdmin() || S.preview || syncing || !S.team.length) return;
  const off = S.content.filter(c => { const want = ownersFor(normItem(c)); return want.length && want.join() !== (c.ownerIds || []).join(); });
  if (!off.length) return;
  syncing = true;
  try{ for (const c of off) await db.collection("content").doc(c.id).update({ownerIds:ownersFor(normItem(c))}); }catch(e){ console.warn(e); }
  syncing = false;
}
onRender(updateThreads);
