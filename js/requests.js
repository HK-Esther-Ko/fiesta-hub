// Requests: production to-dos and small asks ("newsletter cover image by Nov 3").
// Admins assign one or more people; everyone else can only add and manage their own.
import { S, db, h, avatar, isAdmin, registerView, renderMain, save, ymd, parse, today, addDays, daysUntil, fmt, fmtShort, relTime, safeUrl, posts, normItem, brandChip,
  nameOf, teamById, teamSorted, taskOwners, isMyTask, toast, dbErr, openDrawer, closeDrawer, deleteButton, field, input, select, textarea,
  emailHook, sendEmail, HUB_URL } from "./core.js";
import { EMAIL_HOOK } from "../config.js";

export const REQ_COLS = [["todo","To do"],["doing","In progress"],["done","Done"]];
const PRIORITIES = ["High","Medium","Low"];
export const reqStatus = t => t.done ? "done" : (t.status === "doing" ? "doing" : "todo");
const byDue = (a, b) => (a.due || "9999").localeCompare(b.due || "9999");
const canEditTask = t => isAdmin() || isMyTask(t);
const ownerNames = t => taskOwners(t).map(nameOf).join(", ") || "Unassigned";
async function setStatus(t, st){
  try{ await db.collection("tasks").doc(t.id).update({status:st, done:st === "done", doneAt:st === "done" ? new Date().toISOString() : ""}); }catch(e){ toast(dbErr(e)); }
}
export function duePill(t){
  if (t.done) return null;
  const n = t.due ? daysUntil(t.due) : null;
  return n == null ? null : n < 0 ? h("span",{class:"pill bad"}, `${-n}d late`) : n <= 3 ? h("span",{class:"pill warn"}, n === 0 ? "Today" : `${n}d left`) : h("span",{class:"pill"}, fmtShort(t.due));
}
function faces(t){
  const ids = taskOwners(t);
  return h("span",{class:"faces-sm"}, ...ids.slice(0, 4).map(id => avatar(teamById(id) || {name:"?"}, "sm")));
}
export function taskRow(t, showOwner){
  const cb = h("input",{type:"checkbox", class:"check", id:"tk-" + t.id, "aria-label":"Done: " + t.text, disabled:!canEditTask(t)}); cb.checked = !!t.done;
  cb.onchange = () => setStatus(t, cb.checked ? "done" : "todo");
  const post = t.postId ? S.content.find(c => c.id === t.postId) : null;
  const others = taskOwners(t).filter(id => id !== S.meId);
  const from = t.createdBy && !taskOwners(t).includes(t.createdBy) ? `from ${nameOf(t.createdBy)}` : null;
  return h("div",{class:"task" + (t.done ? " done" : "")}, cb,
    h("button",{class:"task-open", type:"button", onclick:() => openTask(t.id)}, h("div",{class:"task-t"}, t.text),
      h("div",{class:"meta"}, [showOwner ? ownerNames(t) : (others.length && isMyTask(t) ? `with ${others.map(nameOf).join(", ")}` : null), from, post ? `for ${post.title}` : null].filter(Boolean).join(" · "))),
    h("div",{class:"when"}, duePill(t)));
}
function reqCard(t){
  const post = t.postId ? S.content.find(c => c.id === t.postId) : null, st = reqStatus(t);
  const next = st === "todo" ? ["doing","Start"] : st === "doing" ? ["done","Done"] : ["todo","Reopen"];
  return h("article",{class:"req"},
    h("button",{class:"req-open", type:"button", onclick:() => openTask(t.id)},
      h("div",{class:"req-top"}, t.priority ? h("span",{class:"prio p-" + t.priority.toLowerCase()}, t.priority) : null, duePill(t)),
      h("div",{class:"req-t"}, t.text),
      post ? h("div",{class:"req-for"}, brandChip(normItem(post).brand), `for ${post.title}`) : null),
    h("div",{class:"req-foot"},
      h("span",{class:"row tight"}, faces(t), h("span",{class:"small"}, ownerNames(t))),
      canEditTask(t) ? h("button",{class:"link", type:"button", onclick:() => setStatus(t, next[0])}, next[1]) : null));
}
// one row per person, top to bottom: a long progress bar of their extra asks, with the open ones listed under it
function peopleBoard(list){
  const since = ymd(addDays(parse(today()), -30)), byPrio = (a, b) => PRIORITIES.indexOf(a.priority || "Medium") - PRIORITIES.indexOf(b.priority || "Medium") || byDue(a, b);
  // people with the most open asks rise to the top; ties keep the usual team order
  const openOf = p => list.filter(t => !t.done && taskOwners(t).includes(p.id)).length;
  const people = teamSorted().filter(p => p.group === "media" || list.some(t => taskOwners(t).includes(p.id))).sort((a, b) => openOf(b) - openOf(a));
  if (!people.length) return h("div",{class:"card empty"},"No one on the team yet.");
  const key = (k, l) => h("span",{class:"st"}, h("i",{class:"kdot k-" + k}), l);
  return h("section",{class:"card pl"},
    h("div",{class:"pl-head"}, h("span",{class:"lbl"},"Person"), h("div",{class:"pl-key"}, key("done","Done (30 days)"), key("doing","In progress"), key("todo","To do")), h("span",{})),
    ...people.map(p => {
      const theirs = list.filter(t => taskOwners(t).includes(p.id));
      const open = theirs.filter(t => !t.done).sort((a, b) => (reqStatus(a) === "doing" ? 0 : 1) - (reqStatus(b) === "doing" ? 0 : 1) || byPrio(a, b));
      const doing = open.filter(t => reqStatus(t) === "doing").length, todo = open.length - doing;
      const done = theirs.filter(t => t.done && (t.doneAt || "") >= since).length, total = open.length + done;
      // each segment carries its own count, so the bar reads without the legend
      const seg = (n, k) => n ? h("span",{class:"pl-seg k-" + k, style:`flex:${n}`}, n) : null;
      return h("div",{class:"pl-row" + (p.id === S.meId ? " me" : "")},
        h("div",{class:"pl-who"}, avatar(p, "md"), h("div",{}, h("b",{}, p.name), h("div",{class:"small muted"}, p.role || "Team"))),
        h("div",{class:"pl-main"},
          h("div",{class:"pl-track"},
            h("div",{class:"pl-bar", role:"img", "aria-label":`${done} done, ${doing} in progress, ${todo} to do`},
              total ? [seg(done, "done"), seg(doing, "doing"), seg(todo, "todo")] : h("span",{class:"pl-none"},"No extra requests")),
            h("span",{class:"pl-sum"}, total ? `${done}/${total} done` : "")),
          open.length ? h("div",{class:"pl-tasks"}, ...open.map(t => h("button",{class:"pl-t", type:"button", onclick:() => openTask(t.id)},
            h("i",{class:"kdot k-" + reqStatus(t)}), h("span",{}, t.text), duePill(t)))) : null),
        isAdmin() ? h("button",{class:"link pl-add", type:"button", onclick:() => openTask(null, {ownerIds:[p.id]})}, `+ Ask ${p.name.split(/\s+/)[0]}`) : h("span",{}));
    }));
}
function viewRequests(){
  const f = ["all","mine","asked"].includes(S.reqFilter) ? S.reqFilter : "all";
  const mode = S.reqView === "status" ? "status" : "people";
  const list = S.tasks.filter(t => f === "all" || (f === "mine" ? isMyTask(t) : t.createdBy === S.meId && !isMyTask(t)));
  const cols = REQ_COLS.map(([k, l]) => {
    let items = list.filter(t => reqStatus(t) === k);
    const count = items.length;
    items = k === "done" ? items.sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || "")).slice(0, 12)
      : items.sort((a, b) => PRIORITIES.indexOf(a.priority || "Medium") - PRIORITIES.indexOf(b.priority || "Medium") || byDue(a, b));
    return h("section",{class:"kcol"}, h("div",{class:"kcol-h"}, h("i",{class:"kdot k-" + k}), h("h3",{}, l), h("span",{class:"count"}, count)),
      ...(items.length ? items.map(reqCard) : [h("div",{class:"empty"}, k === "todo" ? "Nothing waiting." : k === "doing" ? "Nothing in progress." : "Nothing finished yet.")]));
  });
  return [
    h("div",{class:"page-h"}, h("div",{}, h("h2",{},"Requests"), h("p",{class:"sub"},"Extra asks on top of each person's usual role: things that come up in meetings or from teammates.")),
      h("button",{class:"btn primary", type:"button", onclick:() => openTask(null)}, isAdmin() ? "+ New request" : "+ Add my task")),
    h("div",{class:"spread"},
      h("div",{class:"seg", role:"group", "aria-label":"Filter"}, ...[["all","All"],["mine","Mine"],["asked","I asked for"]].map(([k, l]) =>
        h("button",{type:"button", "aria-pressed":String(f === k), onclick:() => { S.reqFilter = k; renderMain(); }}, l))),
      h("div",{class:"seg", role:"group", "aria-label":"View"}, ...[["people","By person"],["status","By status"]].map(([k, l]) =>
        h("button",{type:"button", "aria-pressed":String(mode === k), onclick:() => { S.reqView = k; save("hub.reqView", k); renderMain(); }}, l)))),
    mode === "people" ? peopleBoard(list) : h("div",{class:"kanban"}, ...cols)
  ];
}
// requests linked to one calendar post, shown inside its drawer
export function prepSection(c){
  const reqs = S.tasks.filter(t => t.postId === c.id);
  return h("section",{class:"d-thread"},
    h("div",{class:"d-sec spread"}, h("h3",{},"Prep for this post"), h("button",{class:"link", type:"button", onclick:() => openTask(null, {postId:c.id, due:c.publishDate || ""})}, "+ Request something")),
    reqs.length ? h("div",{class:"list"}, ...reqs.map(t => taskRow(t, true))) : h("div",{class:"empty"},"Nothing requested yet, e.g. a cover image or founder logo."));
}
// a row of buttons instead of a dropdown: every choice is visible and one tap sets it
function pick(label, opts, value, cls){
  let v = value;
  const el = h("div",{class:"seg pick " + cls, role:"group", "aria-label":label}, ...opts.map(([k, l, c]) => h("button",{type:"button", class:c, "aria-pressed":String(k === v),
    onclick:ev => { v = k; el.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === ev.currentTarget))); }}, h("i",{}), l)));
  return {el, get value(){ return v; }};
}
export function openTask(id, preset){
  const t = id ? S.tasks.find(x => x.id === id) : {priority:"Medium", ...(preset || {}), ownerIds:isAdmin() ? (preset?.ownerIds || []) : [S.meId]};
  if (!t) return;
  const current = taskOwners(t);
  const text = input("tk-text", t.text, {placeholder:"e.g. Newsletter cover image"});
  const boxes = isAdmin() ? teamSorted().map(m => { const cb = h("input",{type:"checkbox", id:"tko-" + m.id, value:m.id}); cb.checked = current.includes(m.id); return [m, cb]; }) : null;
  const due = input("tk-due", t.due, {type:"date"});
  const prio = pick("Priority", PRIORITIES.map(p => [p, p, "p-" + p.toLowerCase()]), t.priority || "Medium", "prio-seg");
  const st = pick("Status", REQ_COLS.map(([k, l]) => [k, l, "st-" + (k === "done" ? "published" : k)]), reqStatus(t), "status-seg");
  const ps = posts().filter(c => c.publishDate && (c.id === t.postId || daysUntil(c.publishDate) >= -14)).sort((a, b) => a.publishDate.localeCompare(b.publishDate)).slice(0, 150);
  const post = select("tk-post", [["","Not linked to a post"], ...ps.map(c => [c.id, `${fmtShort(c.publishDate)} · ${c.brand} · ${c.title}`])], t.postId || "");
  const link = input("tk-link", t.link, {type:"url", placeholder:"Drive link to references or the finished file"});
  const notes = textarea("tk-notes", t.notes, 3, "Size, format, references, anything they need");
  const msg = h("div",{class:"cmp-status"}), lk = safeUrl(t.link);
  // without the email hook, admins can still open a pre-filled email to the people they add
  const mailBox = boxes && !EMAIL_HOOK.url ? h("input",{type:"checkbox", id:"tk-mail", checked:true}) : null;
  if (id && !canEditTask(t)){
    openDrawer("Request", [
      h("div",{class:"row"}, h("span",{class:"pill"}, REQ_COLS.find(([k]) => k === reqStatus(t))[1]), t.priority ? h("span",{class:"prio p-" + t.priority.toLowerCase()}, t.priority) : null, duePill(t)),
      h("h3",{}, t.text),
      h("p",{class:"muted"}, `${ownerNames(t)} · requested by ${nameOf(t.createdBy)}${t.due ? " · due " + fmt(t.due) : ""}`),
      t.notes ? h("p",{style:"white-space:pre-wrap"}, t.notes) : null,
      lk ? h("a",{class:"btn", href:lk, target:"_blank", rel:"noopener"},"Open link ↗") : null]);
    return;
  }
  openDrawer(id ? "Request" : (isAdmin() ? "New request" : "Add my task"), [
    id && t.createdBy ? h("p",{class:"small muted", style:"margin:0"}, `Requested by ${nameOf(t.createdBy)}${t.createdAt ? " · " + relTime(t.createdAt) : ""}`) : null,
    lk ? h("a",{class:"btn", href:lk, target:"_blank", rel:"noopener", style:"align-self:flex-start"},"Open link ↗") : null,
    h("div",{class:"fields"},
      field("What's needed", text, true),
      boxes ? h("div",{class:"field full"}, h("span",{class:"lbl"},"Who's on it (pick one or more)"),
        h("div",{class:"owners"}, ...boxes.map(([m, cb]) => h("label",{for:cb.id}, cb, avatar(m, "sm"), m.name))))
        : h("div",{class:"field full"}, h("span",{class:"lbl"},"Who"), h("div",{class:"owner-fixed"}, ownerNames({ownerIds:current.length ? current : [S.meId]}))),
      field("Due", due, true), h("div",{class:"field full"}, h("span",{class:"lbl"},"Status"), st.el), h("div",{class:"field full"}, h("span",{class:"lbl"},"Priority"), prio.el),
      field("For which post (optional)", post, true), field("Link", link, true), field("Details", notes, true),
      mailBox ? h("label",{class:"check-row field full", for:"tk-mail"}, mailBox, h("span",{}, "Also email them", h("br"), h("span",{class:"small muted"},"Opens your mail app with the request filled in")))
        : boxes ? h("p",{class:"small muted field full", style:"margin:0"},"People you add get an email too.") : null),
    h("div",{class:"d-actions"}, id ? deleteButton(() => db.collection("tasks").doc(id).delete()) : h("span",{}),
      h("button",{class:"btn primary", type:"button", onclick:async () => {
        const ownerIds = boxes ? boxes.filter(([, cb]) => cb.checked).map(([m]) => m.id) : (current.length ? current : [S.meId]);
        if (!text.value.trim() || !ownerIds.length){ msg.textContent = "Add what's needed" + (boxes ? " and who's on it." : "."); return; }
        const data = {text:text.value.trim(), ownerIds, ownerId:ownerIds[0], due:due.value, priority:prio.value, status:st.value, done:st.value === "done",
          postId:post.value, link:link.value.trim(), notes:notes.value.trim()};
        if (st.value === "done" && !t.done) data.doneAt = new Date().toISOString();
        try{
          if (id) await db.collection("tasks").doc(id).update(data);
          else {
            const ref = await db.collection("tasks").add({...data, createdBy:S.meId || "", createdAt:new Date().toISOString()});
            // started from a chat: post it there so the conversation shows what was asked
            if (t.thread) await db.collection("messages").add({thread:t.thread, text:`Request for ${ownerIds.map(x => "@" + nameOf(x)).join(" ")}: ${data.text}`,
              authorId:S.meId, mentions:ownerIds, taskId:ref.id, createdAt:new Date().toISOString()});
          }
          const to = ownerIds.filter(x => x !== S.meId && !(id && current.includes(x)));
          closeDrawer(); toast(to.length ? `Sent to ${to.map(nameOf).join(", ")}.` : id ? "Saved." : "Added.");
          if (to.length){
            const p = S.content.find(c => c.id === data.postId);
            const subject = `${nameOf(S.meId)} needs: ${data.text}`;
            const body = [`${nameOf(S.meId)} sent you a request on FIESTA Media Team.`, "", data.text,
              ...[data.due && "Due: " + fmt(data.due), "Priority: " + data.priority, p && "For: " + p.title, data.link && "Link: " + data.link].filter(Boolean),
              ...(data.notes ? ["", data.notes] : []), "", "Open it: " + HUB_URL].join("\n");
            if (!emailHook(EMAIL_HOOK, to, subject, body) && mailBox?.checked) sendEmail(to, subject, body);
          }
        }catch(e){ msg.textContent = dbErr(e); }
      }}, id ? "Save" : (isAdmin() ? "Send request" : "Add"))), msg
  ]);
}

registerView("requests", viewRequests);
