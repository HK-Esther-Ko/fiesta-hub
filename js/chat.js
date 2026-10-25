// Team chat: one team channel, direct messages, small group chats, and per-post threads.
// Opens as a floating panel (bottom right) instead of a full page.
import { S, db, h, icon, avatar, isAdmin, nameOf, teamById, teamSorted, relTime, toast, dbErr, load, save, openDrawer, closeDrawer, field, input } from "./core.js";
import { openTask, duePill } from "./requests.js";

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const dmThread = (a, b) => "dm:" + [a, b].sort().join("|");
export function threadTitle(t){
  if (t === "general") return "Team";
  if (t.startsWith("dm:")){ const other = t.slice(3).split("|").find(x => x !== S.meId); return nameOf(other); }
  if (t.startsWith("g:")) return S.chats.find(c => "g:" + c.id === t)?.name || "Group";
  return S.content.find(c => c.id === t)?.title || "Post";
}
const canSee = t => t === "general" || !(t.startsWith("dm:") || t.startsWith("g:")) ||
  (t.startsWith("dm:") ? t.slice(3).split("|").includes(S.meId) : (S.chats.find(c => "g:" + c.id === t)?.members || []).includes(S.meId));
export function extractMentions(text){
  return S.team.filter(t => t.name && new RegExp("@" + escRe(t.name) + "(?![\\w])", "i").test(text)).map(t => t.id);
}
function richText(text){
  const names = S.team.map(t => t.name).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length) return [text];
  const re = new RegExp("(@(?:" + names.map(escRe).join("|") + "))(?![\\w])", "gi");
  const out = []; let last = 0, m;
  while ((m = re.exec(text))){ out.push(text.slice(last, m.index), h("span",{class:"mention"}, m[1])); last = m.index + m[1].length; }
  out.push(text.slice(last)); return out;
}
export const seenKey = t => "hub.seen." + S.meId + "." + t;
export function unreadIn(t){ const seen = load(seenKey(t)) || ""; return S.messages.filter(m => m.thread === t && m.authorId !== S.meId && m.createdAt > seen).length; }
export function unreadTotal(){
  if (!S.meId) return 0;
  const threads = new Set(S.messages.filter(m => m.thread.startsWith("dm:") || m.thread.startsWith("g:") || m.thread === "general").map(m => m.thread));
  let n = 0; for (const t of threads) if (canSee(t)) n += unreadIn(t);
  return n;
}
function markSeen(t){ const last = S.messages.filter(m => m.thread === t).pop(); if (last) save(seenKey(t), last.createdAt); }

// a request sent from chat shows as a card in the thread; it opens the request itself
function requestCard(id){
  const t = S.tasks.find(x => x.id === id);
  if (!t) return h("div",{class:"msg-req gone"},"Request removed");
  return h("button",{class:"msg-req" + (t.done ? " done" : ""), type:"button", onclick:() => openTask(id)},
    h("span",{class:"lbl"}, t.done ? "Request · done" : "Request"), h("b",{}, t.text), duePill(t));
}
export function threadList(thread){ return h("div",{class:"thread", "data-thread":thread}); }
export function updateThreads(){
  document.querySelectorAll("[data-thread]").forEach(el => {
    const t = el.dataset.thread, msgs = S.messages.filter(m => m.thread === t);
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    // chat bubbles: mine on the right, everyone else on the left; back-to-back messages from one person
    // within 5 minutes skip the repeated name and photo
    el.replaceChildren(...(msgs.length ? msgs.map((m, i) => { const a = teamById(m.authorId), mine = m.authorId === S.meId, p = msgs[i - 1];
      const cont = p && p.authorId === m.authorId && Date.parse(m.createdAt) - Date.parse(p.createdAt) < 5 * 60000;
      return h("div",{class:"msg" + (mine ? " mine" : "") + (cont ? " cont" : "")}, mine ? null : (cont ? h("span") : avatar(a, "sm")),
        h("div",{class:"msg-b"}, cont ? null : h("div",{class:"msg-h"}, mine ? null : h("b",{}, a?.name || "Someone"), h("span",{class:"muted small"}, relTime(m.createdAt))),
          h("div",{class:"msg-t"}, ...richText(m.text || "")), m.taskId ? requestCard(m.taskId) : null));
    }) : [h("div",{class:"empty"}, "No messages yet.")]));
    if (near) el.scrollTop = el.scrollHeight;
  });
}
export function composer(thread){
  const ta = h("textarea",{id:"cmp-" + thread.replace(/[^a-z0-9]/gi, ""), rows:"2", "aria-label":"Message", placeholder:"Write a message. Type @ to tag someone."});
  const menu = h("div",{class:"mention-menu", hidden:true});
  const send = h("button",{class:"btn primary sm", type:"button"}, "Send");
  let matches = [], active = 0, start = -1;
  const close = () => { menu.hidden = true; start = -1; };
  function update(){
    const pos = ta.selectionStart, m = ta.value.slice(0, pos).match(/(^|\s)@([^\s@]*)$/);
    if (!m){ close(); return; }
    start = pos - m[2].length - 1;
    matches = teamSorted().filter(t => (t.name || "").toLowerCase().includes(m[2].toLowerCase())).slice(0, 6);
    if (!matches.length){ close(); return; }
    active = Math.min(active, matches.length - 1);
    menu.replaceChildren(...matches.map((t, i) => h("button",{class:"mention-opt" + (i === active ? " on" : ""), type:"button", onmousedown:e => { e.preventDefault(); pick(i); }}, avatar(t, "sm"), t.name)));
    menu.hidden = false;
  }
  function pick(i){ const t = matches[i]; if (!t) return; const pos = ta.selectionStart;
    ta.value = ta.value.slice(0, start) + "@" + t.name + " " + ta.value.slice(pos); const np = start + t.name.length + 2; ta.setSelectionRange(np, np); close(); ta.focus(); }
  async function go(){
    const text = ta.value.trim(); if (!text || !S.meId) return;
    send.disabled = true;
    try{ await db.collection("messages").add({thread, text, authorId:S.meId, mentions:extractMentions(text), createdAt:new Date().toISOString()}); ta.value = ""; }
    catch(e){ toast(dbErr(e)); }
    send.disabled = false;
  }
  ta.addEventListener("input", () => { active = 0; update(); });
  ta.addEventListener("blur", () => setTimeout(close, 150));
  ta.addEventListener("keydown", e => {
    if (!menu.hidden){
      if (e.key === "ArrowDown"){ e.preventDefault(); active = (active + 1) % matches.length; update(); return; }
      if (e.key === "ArrowUp"){ e.preventDefault(); active = (active - 1 + matches.length) % matches.length; update(); return; }
      if (e.key === "Enter" || e.key === "Tab"){ e.preventDefault(); pick(active); return; }
      if (e.key === "Escape"){ close(); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); go(); }
  });
  send.onclick = go;
  // admins can turn a chat into a request: who it's for comes from the DM or the @mentions typed so far
  const ask = isAdmin() ? h("button",{class:"btn sm", type:"button", onclick:() => {
    const dm = thread.startsWith("dm:") ? thread.slice(3).split("|").filter(x => x !== S.meId) : [];
    const ownerIds = [...new Set([...dm, ...extractMentions(ta.value)])];
    const post = S.content.find(c => c.id === thread);
    openTask(null, {ownerIds, thread, text:S.team.reduce((s, m) => m.name ? s.replace(new RegExp("@" + escRe(m.name), "gi"), "") : s, ta.value).replace(/\s+/g, " ").trim().slice(0, 140), postId:post?.id || "", due:post?.publishDate || ""});
  }}, "+ Request") : null;
  return h("div",{class:"composer"}, menu, ta, h("div",{class:"cmp-foot"}, h("span",{class:"small muted"},"Enter to send · Shift+Enter for a new line"), h("div",{class:"row"}, ask, send)));
}

/* ---------- floating chat panel ---------- */
let current = load("hub.chat") || "general";
export function renderChatButton(){
  const b = document.getElementById("chat-fab"); if (!b) return;
  const n = unreadTotal(), badge = b.querySelector(".dot-badge");
  badge.textContent = n; badge.hidden = !n;
}
export function openChat(thread){
  if (thread) current = thread;
  const p = document.getElementById("chat-panel");
  p.hidden = false; renderChatPanel();
}
export function renderChatPanel(){
  const p = document.getElementById("chat-panel"); if (!p || p.hidden) return;
  if (!canSee(current)) current = "general";
  save("hub.chat", current); markSeen(current); renderChatButton();
  const item = (t, label, av) => { const n = unreadIn(t);
    return h("button",{class:"chat-item" + (t === current ? " on" : ""), type:"button", onclick:() => { current = t; renderChatPanel(); }}, av, h("span",{class:"chat-name"}, label), n ? h("span",{class:"badge"}, n) : null); };
  const people = teamSorted().filter(t => t.id !== S.meId);
  const groups = S.chats.filter(c => (c.members || []).includes(S.meId));
  p.replaceChildren(
    h("div",{class:"chat-side"},
      h("div",{class:"chat-sec"},"Channels"), item("general", "Team", h("span",{class:"av sm chan"}, "#")),
      h("div",{class:"chat-sec"}, "Groups", h("button",{class:"icon-btn ghost xs", type:"button", "aria-label":"New group", onclick:openNewGroup}, icon("plus", 14))),
      ...groups.map(g => item("g:" + g.id, g.name, h("span",{class:"av sm chan"}, (g.name || "G")[0].toUpperCase()))),
      h("div",{class:"chat-sec"},"Direct"),
      ...people.map(t => item(dmThread(S.meId, t.id), t.name, avatar(t, "sm")))),
    h("div",{class:"chat-main"},
      h("div",{class:"chat-top"}, h("b",{}, threadTitle(current)), h("button",{class:"icon-btn ghost", type:"button", "aria-label":"Close chat", onclick:() => { p.hidden = true; }}, icon("close", 18))),
      threadList(current), composer(current)));
  updateThreads();
  p.querySelector("textarea")?.focus();
}
function openNewGroup(){
  const name = input("grp-name", "", {placeholder:"e.g. Newsletter crew"});
  const boxes = teamSorted().filter(t => t.id !== S.meId).map(t => { const cb = h("input",{type:"checkbox", id:"grp-" + t.id, value:t.id}); return [t, cb]; });
  openDrawer("New group chat", [
    field("Group name", name, true),
    h("div",{class:"field full"}, h("span",{class:"lbl"},"Members"), h("div",{class:"owners"}, ...boxes.map(([t, cb]) => h("label",{for:cb.id}, cb, avatar(t, "sm"), t.name)))),
    h("div",{class:"d-actions"}, h("span",{}), h("button",{class:"btn primary", type:"button", onclick:async () => {
      const members = [S.meId, ...boxes.filter(([, cb]) => cb.checked).map(([t]) => t.id)];
      if (!name.value.trim() || members.length < 2){ toast("Name the group and pick at least one person."); return; }
      try{ const ref = await db.collection("chats").add({name:name.value.trim(), members, createdBy:S.meId, createdAt:new Date().toISOString()});
        closeDrawer(); openChat("g:" + ref.id); }catch(e){ toast(dbErr(e)); }
    }}, "Create group"))
  ]);
}
