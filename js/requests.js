// Requests: production to-dos and small asks ("newsletter cover image by Nov 3").
// Admins assign to anyone; everyone else can only add and manage their own.
import { S, db, h, icon, avatar, isAdmin, registerView, renderMain, today, daysUntil, fmt, fmtShort, relTime, safeUrl, posts, normItem, BRANDS, brandChip,
  nameOf, teamById, teamSorted, toast, dbErr, openDrawer, closeDrawer, deleteButton, field, input, select, textarea } from "./core.js";

export const REQ_COLS = [["todo","To do"],["doing","In progress"],["done","Done"]];
const PRIORITIES = ["High","Medium","Low"];
export const reqStatus = t => t.done ? "done" : (t.status === "doing" ? "doing" : "todo");
const byDue = (a, b) => (a.due || "9999").localeCompare(b.due || "9999");
const mine = t => t.ownerId === S.meId;
const canEditTask = t => isAdmin() || mine(t);
async function setStatus(t, st){
  try{ await db.collection("tasks").doc(t.id).update({status:st, done:st === "done", doneAt:st === "done" ? new Date().toISOString() : ""}); }catch(e){ toast(dbErr(e)); }
}
export function duePill(t){
  if (t.done) return null;
  const n = t.due ? daysUntil(t.due) : null;
  return n == null ? null : n < 0 ? h("span",{class:"pill bad"}, `${-n}d late`) : n <= 3 ? h("span",{class:"pill warn"}, n === 0 ? "Today" : `${n}d left`) : h("span",{class:"pill"}, fmtShort(t.due));
}
export function taskRow(t, showOwner){
  const cb = h("input",{type:"checkbox", class:"check", id:"tk-" + t.id, "aria-label":"Done: " + t.text, disabled:!canEditTask(t)}); cb.checked = !!t.done;
  cb.onchange = () => setStatus(t, cb.checked ? "done" : "todo");
  const post = t.postId ? S.content.find(c => c.id === t.postId) : null;
  const from = t.createdBy && t.createdBy !== t.ownerId ? `from ${nameOf(t.createdBy)}` : null;
  return h("div",{class:"task" + (t.done ? " done" : "")}, cb,
    h("button",{class:"task-open", type:"button", onclick:() => openTask(t.id)}, h("div",{class:"task-t"}, t.text),
      h("div",{class:"meta"}, [showOwner ? nameOf(t.ownerId) : null, from, post ? `for ${post.title}` : null].filter(Boolean).join(" · "))),
    h("div",{class:"when"}, duePill(t)));
}
function reqCard(t){
  const post = t.postId ? S.content.find(c => c.id === t.postId) : null, st = reqStatus(t), p = teamById(t.ownerId);
  const next = st === "todo" ? ["doing","Start"] : st === "doing" ? ["done","Done"] : ["todo","Reopen"];
  return h("article",{class:"req"},
    h("button",{class:"req-open", type:"button", onclick:() => openTask(t.id)},
      h("div",{class:"req-top"}, t.priority ? h("span",{class:"prio p-" + t.priority.toLowerCase()}, t.priority) : null, duePill(t)),
      h("div",{class:"req-t"}, t.text),
      post ? h("div",{class:"req-for"}, brandChip(normItem(post).brand), `for ${post.title}`) : null),
    h("div",{class:"req-foot"},
      h("span",{class:"row tight"}, avatar(p || {name:"?"}, "sm"), h("span",{class:"small"}, p ? p.name : "Unassigned")),
      canEditTask(t) ? h("button",{class:"link", type:"button", onclick:() => setStatus(t, next[0])}, next[1]) : null));
}
function viewRequests(){
  const f = ["all","mine","asked"].includes(S.reqFilter) ? S.reqFilter : "all";
  const list = S.tasks.filter(t => f === "all" || (f === "mine" ? mine(t) : t.createdBy === S.meId && !mine(t)));
  const cols = REQ_COLS.map(([k, l]) => {
    let items = list.filter(t => reqStatus(t) === k);
    const count = items.length;
    items = k === "done" ? items.sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || "")).slice(0, 12)
      : items.sort((a, b) => PRIORITIES.indexOf(a.priority || "Medium") - PRIORITIES.indexOf(b.priority || "Medium") || byDue(a, b));
    return h("section",{class:"kcol"}, h("div",{class:"kcol-h"}, h("i",{class:"kdot k-" + k}), h("h3",{}, l), h("span",{class:"count"}, count)),
      ...(items.length ? items.map(reqCard) : [h("div",{class:"empty"}, k === "todo" ? "Nothing waiting." : k === "doing" ? "Nothing in progress." : "Nothing finished yet.")]));
  });
  return [
    h("div",{class:"page-h"}, h("div",{}, h("h2",{},"Requests"), h("p",{class:"sub"},"Who's making what, by when. The calendar is for what goes live; this is the work behind it.")),
      h("button",{class:"btn primary", type:"button", onclick:() => openTask(null)}, isAdmin() ? "+ New request" : "+ Add my task")),
    h("div",{class:"seg", role:"group", "aria-label":"Filter"}, ...[["all","All"],["mine","Mine"],["asked","I asked for"]].map(([k, l]) =>
      h("button",{type:"button", "aria-pressed":String(f === k), onclick:() => { S.reqFilter = k; renderMain(); }}, l))),
    h("div",{class:"kanban"}, ...cols)
  ];
}
// requests linked to one calendar post, shown inside its drawer
export function prepSection(c){
  const reqs = S.tasks.filter(t => t.postId === c.id);
  return h("section",{class:"d-thread"},
    h("div",{class:"d-sec spread"}, h("h3",{},"Prep for this post"), h("button",{class:"link", type:"button", onclick:() => openTask(null, {postId:c.id, due:c.deadline || ""})}, "+ Request something")),
    reqs.length ? h("div",{class:"list"}, ...reqs.map(t => taskRow(t, true))) : h("div",{class:"empty"},"Nothing requested yet, e.g. a cover image or founder logo."));
}
export function openTask(id, preset){
  const t = id ? S.tasks.find(x => x.id === id) : {priority:"Medium", ...(preset || {}), ownerId:isAdmin() ? (preset?.ownerId || "") : S.meId};
  if (!t) return;
  const editable = !id || canEditTask(t);
  const text = input("tk-text", t.text, {placeholder:"e.g. Newsletter cover image"});
  const owner = isAdmin() ? select("tk-owner", [["","Choose"], ...teamSorted().map(m => [m.id, m.name])], t.ownerId || "") : null;
  const due = input("tk-due", t.due, {type:"date"});
  const prio = select("tk-prio", PRIORITIES, t.priority || "Medium");
  const st = select("tk-status", REQ_COLS, reqStatus(t));
  const ps = posts().filter(c => c.publishDate && (c.id === t.postId || daysUntil(c.publishDate) >= -14)).sort((a, b) => a.publishDate.localeCompare(b.publishDate)).slice(0, 150);
  const post = select("tk-post", [["","Not linked to a post"], ...ps.map(c => [c.id, `${fmtShort(c.publishDate)} · ${c.brand} · ${c.title}`])], t.postId || "");
  const link = input("tk-link", t.link, {type:"url", placeholder:"Drive link to references or the finished file"});
  const notes = textarea("tk-notes", t.notes, 3, "Size, format, references, anything they need");
  const msg = h("div",{class:"cmp-status"}), lk = safeUrl(t.link);
  if (!editable){
    openDrawer("Request", [
      h("div",{class:"row"}, h("span",{class:"pill"}, REQ_COLS.find(([k]) => k === reqStatus(t))[1]), t.priority ? h("span",{class:"prio p-" + t.priority.toLowerCase()}, t.priority) : null, duePill(t)),
      h("h3",{}, t.text),
      h("p",{class:"muted"}, `${nameOf(t.ownerId)} · requested by ${nameOf(t.createdBy)}${t.due ? " · due " + fmt(t.due) : ""}`),
      t.notes ? h("p",{style:"white-space:pre-wrap"}, t.notes) : null,
      lk ? h("a",{class:"btn", href:lk, target:"_blank", rel:"noopener"},"Open link ↗") : null]);
    return;
  }
  openDrawer(id ? "Request" : (isAdmin() ? "New request" : "Add my task"), [
    id && t.createdBy ? h("p",{class:"small muted", style:"margin:0"}, `Requested by ${nameOf(t.createdBy)}${t.createdAt ? " · " + relTime(t.createdAt) : ""}`) : null,
    lk ? h("a",{class:"btn", href:lk, target:"_blank", rel:"noopener", style:"align-self:flex-start"},"Open link ↗") : null,
    h("div",{class:"fields"},
      field("What's needed", text, true),
      owner ? field("Who makes it", owner) : h("div",{class:"field"}, h("span",{class:"lbl"},"Who"), h("div",{class:"owner-fixed"}, nameOf(t.ownerId || S.meId))),
      field("Due", due), field("Priority", prio), field("Status", st),
      field("For which post (optional)", post, true), field("Link", link, true), field("Details", notes, true)),
    h("div",{class:"d-actions"}, id ? deleteButton(() => db.collection("tasks").doc(id).delete()) : h("span",{}),
      h("button",{class:"btn primary", type:"button", onclick:async () => {
        const ownerId = owner ? owner.value : (t.ownerId || S.meId);
        if (!text.value.trim() || !ownerId){ msg.textContent = "Add what's needed" + (owner ? " and who makes it." : "."); return; }
        const data = {text:text.value.trim(), ownerId, due:due.value, priority:prio.value, status:st.value, done:st.value === "done", postId:post.value, link:link.value.trim(), notes:notes.value.trim()};
        if (st.value === "done" && !t.done) data.doneAt = new Date().toISOString();
        try{
          if (id) await db.collection("tasks").doc(id).update(data);
          else await db.collection("tasks").add({...data, createdBy:S.meId || "", createdAt:new Date().toISOString()});
          closeDrawer(); toast(id ? "Saved." : ownerId === S.meId ? "Added." : `Sent to ${nameOf(ownerId)}.`);
        }catch(e){ msg.textContent = dbErr(e); }
      }}, id ? "Save" : (ownerId_label()))), msg
  ]);
  function ownerId_label(){ return isAdmin() ? "Send request" : "Add"; }
}

registerView("requests", viewRequests);
