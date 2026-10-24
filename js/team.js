// Team: event org charts (fixed roles per series) and the people page, under one menu item.
import { S, db, h, icon, avatar, isAdmin, realAdmin, registerView, renderMain, save, lines, teamById, teamSorted, nameOf, byPeopleOrder, BRANDS, seriesById,
  toast, dbErr, openDrawer, closeDrawer, deleteButton, field, input, select, textarea, resizeImage, blobToDataUrl } from "./core.js";
import { setAccess } from "../firebase.js";

const AREAS = [["Lead","FIESTA leadership"],["Media","Media team"],["After the event","After the event"]];
const GROUPS = [["leadership","FIESTA leadership"],["media","Media team"]];

function groupRoles(list){
  const m = new Map();
  for (const r of list){ const k = r.personId || r.name || "open:" + r.title; if (!m.has(k)) m.set(k, {personId:r.personId, name:r.name, titles:[]}); m.get(k).titles.push(r.title); }
  return [...m.values()].sort((a, b) => (a.personId ? 0 : 1) - (b.personId ? 0 : 1) || byPeopleOrder(a.personId, b.personId));
}
function node(g){
  const p = g.personId ? teamById(g.personId) : null, nm = p ? (p.name || p.id) : g.name;
  return h("div",{class:"oc-node" + (nm ? "" : " open")}, nm ? avatar(p || {name:nm}, "md") : h("span",{class:"av md oc-q"},"?"),
    h("div",{class:"oc-txt"}, h("div",{class:"oc-name"}, nm || "To be decided"), h("div",{class:"oc-role"}, g.titles.join(" · "))));
}
function orgChart(){
  const series = S.series.slice().sort((a, b) => (a.id === "fiesta" ? 0 : 1) - (b.id === "fiesta" ? 0 : 1));
  if (!series.length) return [h("div",{class:"card empty-big"},"No events set up yet.")];
  const cur = series.find(s => s.id === S.chartId) || series[0];
  const areas = AREAS.map(([a, label]) => [label, groupRoles((cur.roles || []).filter(r => r.area === a))]).filter(([, l]) => l.length);
  return [
    h("div",{class:"spread"},
      h("div",{class:"seg", role:"group", "aria-label":"Event"}, ...series.map(s => h("button",{type:"button", "aria-pressed":String(s.id === cur.id), onclick:() => { S.chartId = s.id; renderMain(); }}, s.name))),
      isAdmin() ? h("button",{class:"btn", type:"button", onclick:() => openRoles(cur)},"Edit roles") : null),
    h("section",{class:"card oc", style:`--c:${(BRANDS[cur.brand] || {}).c || "var(--accent)"}`},
      h("div",{class:"oc-root"}, cur.name),
      h("div",{class:"oc-areas"}, ...areas.map(([label, people]) => h("div",{class:"oc-col"}, h("div",{class:"oc-area"}, label), ...people.map(node)))))
  ];
}
function personCard(t){
  const duties = lines(t.duties), mine = t.id === S.meId;
  return h("article",{class:"person"},
    h("div",{class:"ph"}, t.photo ? h("img",{src:t.photo, alt:t.name}) : avatar(t, "xl")),
    h("h3",{class:"p-name"}, t.name, mine ? h("span",{class:"you"},"You") : null),
    h("div",{class:"p-title"}, t.role || "—"),
    duties.length ? h("ul",{class:"p-duties"}, ...duties.map(d => h("li",{}, d))) : null,
    isAdmin() ? h("button",{class:"p-foot", type:"button", onclick:() => openMember(t.id)},"Edit")
      : mine ? h("button",{class:"p-foot", type:"button", onclick:openProfile},"Edit my profile") : null);
}
function roles(){
  const list = teamSorted(), rest = list.filter(t => !GROUPS.some(([g]) => g === t.group));
  return [
    isAdmin() ? h("div",{class:"spread"}, h("span",{}), h("button",{class:"btn", type:"button", onclick:() => openMember(null)},"+ Add person")) : null,
    ...GROUPS.map(([g, label]) => { const people = list.filter(t => t.group === g); return people.length ? h("section",{class:"team-sec"}, h("div",{class:"sec-h"}, h("h3",{}, label)), h("div",{class:"people"}, ...people.map(personCard))) : null; }),
    rest.length ? h("section",{class:"team-sec"}, h("div",{class:"sec-h"}, h("h3",{},"Other")), h("div",{class:"people"}, ...rest.map(personCard))) : null
  ];
}
function viewTeam(){
  const tab = S.teamTab === "roles" ? "roles" : "chart";
  return [
    h("div",{class:"page-h"}, h("div",{}, h("h2",{},"Team"), h("p",{class:"sub"},"Who does what at our events, and who's on the team."))),
    h("div",{class:"tabs"}, ...[["chart","Event org chart"],["roles","Roles"]].map(([k, l]) =>
      h("button",{class:"tab", type:"button", "aria-selected":String(tab === k), onclick:() => { S.teamTab = k; save("hub.teamTab", k); renderMain(); }}, l))),
    ...(tab === "chart" ? orgChart() : roles())
  ];
}

/* ---------- editors ---------- */
function openRoles(s){
  const rows = h("div",{class:"role-rows"});
  const add = (r = {area:"Media", title:"", personId:""}) => {
    const area = select(null, AREAS.map(([a, l]) => [a, l]), r.area);
    const title = input(null, r.title, {placeholder:"Role, e.g. Photographer", "aria-label":"Role"});
    const who = select(null, [["","To be decided"], ...teamSorted().map(t => [t.id, t.name])], r.personId || "");
    const row = h("div",{class:"role-row"}, area, title, who, h("button",{class:"icon-btn ghost", type:"button", "aria-label":"Remove", onclick:() => row.remove()}, icon("close", 16)));
    row._get = () => ({area:area.value, title:title.value.trim(), personId:who.value, name:""});
    rows.append(row);
  };
  (s.roles || []).forEach(add);
  const msg = h("div",{class:"cmp-status"});
  openDrawer(`${s.name} roles`, [
    h("p",{class:"small muted", style:"margin:0"},"These are fixed for every meetup. People are always listed in team order."),
    rows, h("button",{class:"btn sm", type:"button", style:"align-self:flex-start", onclick:() => add()},"+ Add role"),
    h("div",{class:"d-actions"}, msg, h("button",{class:"btn primary", type:"button", onclick:async () => {
      try{ await db.collection("series").doc(s.id).update({roles:[...rows.children].map(r => r._get()).filter(r => r.title)}); closeDrawer(); toast("Roles saved."); }catch(e){ msg.textContent = dbErr(e); }
    }},"Save"))
  ]);
}
function photoPicker(initial){
  let photo = initial || "";
  const prev = h("div",{class:"ph-prev"});
  const paint = () => prev.replaceChildren(photo ? h("img",{src:photo, alt:""}) : icon("user", 28));
  paint();
  const pick = h("input",{type:"file", id:"ph-file", accept:"image/png,image/jpeg,image/webp", class:"sr"});
  const status = h("span",{class:"small muted"});
  pick.onchange = async () => { const f = pick.files[0]; if (!f) return; status.textContent = "Preparing…";
    try{ photo = await blobToDataUrl(await resizeImage(f, 480)); paint(); status.textContent = ""; }catch(e){ status.textContent = "Couldn't read that image. Try a JPG or PNG."; } };
  const el = h("div",{class:"ph-pick"}, prev, h("div",{class:"col"}, h("label",{for:"ph-file", class:"btn sm"},"Choose photo"), pick,
    h("button",{class:"link", type:"button", onclick:() => { photo = ""; paint(); }},"Remove"), status));
  return {el, get:() => photo};
}
// admins edit everything about a person, including which sign-in email is theirs
function openMember(id){
  const t = id ? teamById(id) : {group:"media"};
  if (!t) return;
  const name = input("tm-name", t.name), role = input("tm-role", t.role, {placeholder:"e.g. Social media & content"});
  const group = select("tm-group", [["leadership","FIESTA leadership"],["media","Media team"],["","Other"]], t.group ?? "");
  const duties = textarea("tm-duties", t.duties, 3, "One responsibility per line (two or three is plenty)");
  const email = input("tm-email", t.email, {type:"email", placeholder:"Google account they sign in with"});
  const ph = photoPicker(t.photo), msg = h("div",{class:"cmp-status"});
  openDrawer(id ? `Edit ${t.name}` : "Add person", [
    ph.el,
    h("div",{class:"fields"}, field("Name", name, true), field("Title", role), field("Team", group), field("Responsibilities", duties, true), field("Sign-in email", email, true)),
    h("p",{class:"small muted", style:"margin:0"},"The sign-in email is added to the Access list as a team member, linked to this person."),
    h("div",{class:"d-actions"}, id ? deleteButton(() => db.collection("team").doc(id).delete()) : h("span",{}),
      h("button",{class:"btn primary", type:"button", onclick:async () => {
        const n = name.value.trim(); if (!n){ msg.textContent = "Add a name."; return; }
        const e = email.value.trim().toLowerCase();
        if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){ msg.textContent = "That email doesn't look right."; return; }
        const data = {name:n, role:role.value.trim(), group:group.value, duties:duties.value.trim(), email:e, photo:ph.get()};
        try{
          let tid = id;
          if (id) await db.collection("team").doc(id).update(data); else tid = (await db.collection("team").add(data)).id;
          if (e){ const had = S.allowed.find(a => a.id === e); await setAccess(e, had ? {teamId:tid} : {teamId:tid, access:"member"}); }
          closeDrawer(); toast("Saved.");
        }catch(err){ msg.textContent = dbErr(err); }
      }},"Save")), msg
  ]);
}
// everyone edits their own name, photo and contact email; title and role come from admins
export function openProfile(first){
  const t = teamById(S.meId);
  if (!t){ toast("Your account isn't linked to a team card yet. Ask an admin."); return; }
  const name = input("pf-name", t.name || S.googleName), mail = input("pf-mail", t.contactEmail || t.email || S.myEmail, {type:"email"});
  const ph = photoPicker(t.photo), msg = h("div",{class:"cmp-status"});
  const pv = realAdmin() && S.preview;
  if (pv) mail.value = t.contactEmail || t.email || "";
  openDrawer(first ? "Welcome to FIESTA Media Team" : "My profile", [
    first ? h("p",{style:"margin:0"},"Add your name and a photo so teammates know who's who.") : null,
    ph.el,
    h("div",{class:"fields"}, field("Name", name, true), field("Contact email", mail, true)),
    h("dl",{class:"facts"}, h("div",{}, h("dt",{},"Title"), h("dd",{}, t.role || "—")), h("div",{}, h("dt",{},"Signed in as"), h("dd",{}, pv ? t.email || "their Google email" : S.myEmail))),
    h("p",{class:"small muted", style:"margin:0"},"Your title and role are set by an admin."),
    h("div",{class:"d-actions"}, first ? h("button",{class:"btn ghost", type:"button", onclick:closeDrawer},"Later") : h("span",{}),
      h("button",{class:"btn primary", type:"button", onclick:async () => {
        const n = name.value.trim(); if (!n){ msg.textContent = "Add your name."; return; }
        if (pv){ closeDrawer(); toast("Preview: nothing was saved."); return; }
        try{ await db.collection("team").doc(t.id).update({name:n, photo:ph.get(), contactEmail:mail.value.trim()}); closeDrawer(); toast(first ? `Welcome, ${n.split(" ")[0]}!` : "Profile saved."); save("hub.onboarded." + S.myEmail, "1"); }
        catch(e){ msg.textContent = dbErr(e); }
      }},"Save")), msg
  ]);
}

registerView("team", viewTeam);
