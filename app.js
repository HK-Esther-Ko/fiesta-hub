// Entry point: sign-in gate, app shell (menu, top bar, notifications, chat button) and live data.
import { onUser, signIn, signOutUser, isBootstrapAdmin, getAccess } from "./firebase.js";
import { S, db, h, icon, avatar, isAdmin, renderMain, setView, setNavHook, onRender, load, save, today, daysUntil, fmtShort, relTime,
  teamById, nameOf, posts, isDone, ownersFor } from "./js/core.js";
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

const NAV = [["home","Home"],["calendar","Calendar"],["requests","Requests"],["analytics","Analytics"],["team","Team"],["drive","Drive"],["sops","SOPs"],["cycle","How we work"]];
if (![...NAV.map(([k]) => k), "access"].includes(S.view)) S.view = "home";

/* ---------- shell ---------- */
document.querySelectorAll("[data-icon]").forEach(el => el.replaceWith(icon(el.dataset.icon)));
function navItem([k, l]){
  return h("button",{class:"nav-item", type:"button", "aria-current":S.view === k ? "page" : null, onclick:() => { if (k === "sops") S.sopOpen = ""; setView(k); }}, icon(k === "access" ? "access" : k), l);
}
function renderNav(){
  document.getElementById("nav").replaceChildren(...NAV.map(navItem));
  document.getElementById("nav-foot").replaceChildren(...(isAdmin() ? [navItem(["access","Access"])] : []));
}
setNavHook(renderNav);
function renderHeader(){
  const me = teamById(S.meId);
  document.getElementById("tb-avatar").replaceChildren(avatar(me || {name:S.myEmail || "?"}, "md"));
  document.getElementById("tb-name").textContent = me?.name || S.googleName || S.myEmail;
  document.getElementById("tb-sub").textContent = (me?.role || "") + (isAdmin() ? (me?.role ? " · " : "") + "Admin" : "");
  const n = notifications(), seen = load("hub.nseen." + S.meId) || "";
  const count = n.filter(x => x.sticky || (x.at || "") > seen).length;
  const b = document.getElementById("bell-count"); b.textContent = count; b.hidden = !count;
  renderChatButton();
}
document.getElementById("brand").onclick = () => setView("home");
document.getElementById("me-btn").onclick = () => openProfile(false);
document.getElementById("signout").onclick = () => signOutUser();
document.getElementById("chat-fab").onclick = () => { const p = document.getElementById("chat-panel"); if (p.hidden) openChat(); else p.hidden = true; };
document.getElementById("scrim").onclick = () => { document.getElementById("drawer").hidden = true; document.getElementById("scrim").hidden = true; };
document.addEventListener("keydown", e => { if (e.key === "Escape" && !document.getElementById("drawer").hidden) document.getElementById("scrim").click(); });

/* ---------- notifications ---------- */
function notifications(){
  if (!S.meId) return [];
  const out = [];
  for (const c of posts().filter(c => ownersFor(c).includes(S.meId) && !isDone(c) && c.deadline && daysUntil(c.deadline) <= 2)){
    const d = daysUntil(c.deadline);
    out.push({sticky:true, tone:d < 0 ? "bad" : "warn", label:d < 0 ? `${-d}d overdue` : d === 0 ? "Due today" : `Due ${fmtShort(c.deadline)}`, text:c.title, go:() => openItem(c.id)});
  }
  for (const t of S.tasks.filter(t => t.ownerId === S.meId && !t.done && t.due && daysUntil(t.due) <= 2))
    out.push({sticky:true, tone:daysUntil(t.due) < 0 ? "bad" : "warn", label:daysUntil(t.due) < 0 ? "Request late" : "Request due", text:t.text, go:() => openTask(t.id)});
  for (const m of S.messages.filter(m => m.authorId !== S.meId && ((m.mentions || []).includes(S.meId) || (m.thread.startsWith("dm:") && m.thread.slice(3).split("|").includes(S.meId))))){
    const isDm = m.thread.startsWith("dm:"), post = S.content.find(c => c.id === m.thread);
    out.push({at:m.createdAt, label:isDm ? `${nameOf(m.authorId)} sent you a message` : `${nameOf(m.authorId)} mentioned you` + (post ? ` on “${post.title}”` : ` in ${threadTitle(m.thread)}`), text:m.text,
      go:() => post ? openItem(post.id) : openChat(m.thread)});
  }
  for (const t of S.tasks.filter(t => t.ownerId === S.meId && !t.done && t.createdBy && t.createdBy !== S.meId))
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
  if (recent.length){ save("hub.nseen." + S.meId, recent[0].at); renderHeader(); }
};

/* ---------- sign-in gate ---------- */
function showGate(kind, email){
  document.getElementById("app").hidden = true; document.getElementById("gate").hidden = false;
  document.getElementById("gate-signin").hidden = kind !== "signin";
  document.getElementById("gate-signout").hidden = kind !== "denied";
  document.getElementById("gate-msg").textContent = kind === "signin" ? "Sign in with the Google account your admin added."
    : `${email} isn't on the team list yet. Ask an admin to add this email, then reload.`;
}
document.getElementById("gate-signin").onclick = () => signIn().catch(e => { if (e?.code !== "auth/popup-closed-by-user") alert("Sign-in didn't finish. Try again."); });
document.getElementById("gate-signout").onclick = () => signOutUser();

// who am I: the admin-assigned team card on my Access entry, else a card with my sign-in email
function linkMe(){
  const viaAccess = S.myAllowed?.teamId && teamById(S.myAllowed.teamId) ? S.myAllowed.teamId : "";
  const viaEmail = S.team.find(t => (t.email || "").toLowerCase() === S.myEmail)?.id || "";
  S.meId = viaAccess || viaEmail || "";
}
function maybeWelcome(){
  const me = teamById(S.meId);
  if (!me || load("hub.onboarded." + S.myEmail) || S.welcomed) return;
  S.welcomed = true;
  if (!me.photo || !me.contactEmail) openProfile(true); else save("hub.onboarded." + S.myEmail, "1");
}

let started = false;
onUser(async user => {
  if (!user){ showGate("signin"); return; }
  S.myEmail = (user.email || "").toLowerCase(); S.googleName = user.displayName || "";
  S.access = isBootstrapAdmin(S.myEmail) ? "admin" : (await getAccess(S.myEmail) ? (await getAccess(S.myEmail) === "admin" ? "admin" : "member") : null);
  if (!S.access){ showGate("denied", user.email); return; }
  document.getElementById("gate").hidden = true; document.getElementById("app").hidden = false;
  if (!started){ started = true; start(); }
});

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
  live("team", "team", () => { linkMe(); maybeWelcome(); });
  live("content", "content"); live("sops", "sops"); live("events", "events"); live("series", "series"); live("tasks", "tasks"); live("kpis", "kpis"); live("chats", "chats");
  db.collection("messages").orderBy("createdAt", "desc").limit(500).onSnapshot(s => {
    S.messages = s.docs.map(d => ({id:d.id, ...d.data()})).reverse(); renderHeader(); updateThreads(); renderChatPanel();
  }, onErr);
  db.doc("config/links").onSnapshot(d => { S.links = d.exists ? d.data() : {}; renderMain(); }, onErr);
  db.doc("config/meetings").onSnapshot(d => { S.meetCfg = d.exists ? d.data() : null; renderMain(); }, onErr);
}
onRender(updateThreads);
