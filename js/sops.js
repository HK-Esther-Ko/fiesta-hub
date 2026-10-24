// SOPs: the main media team SOP, with the social / content SOP below it. Each opens as its own page.
import { S, db, h, icon, avatar, isAdmin, registerView, renderMain, setView, lines, teamById, toast, dbErr, openDrawer, closeDrawer, field, input, textarea } from "./core.js";

const plainName = s => String(s || "").replace(/\s*\(new\)\s*$/i, "");
const newify = t => [plainName(t), /\(new\)\s*$/i.test(t || "") ? h("span",{class:"pill new"},"New") : null];
const keyOf = s => plainName(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");
function parseDeliv(line){ const m = line.match(/^\s*(\d+)\s*(\/\s*pitcher)?\s*\|\s*(.+)$/i); return {count:m ? +m[1] : null, per:!!(m && m[2]), text:m ? m[3] : line}; }
const visibleSops = () => S.sops.filter(s => !s.hidden);
const mainSop = () => visibleSops().find(s => s.main) || visibleSops().find(s => s.roles);

function sopList(){
  const main = mainSop(), subs = visibleSops().filter(s => s !== main).sort((a, b) => (a.order ?? 9) - (b.order ?? 9));
  const st = main?.strategy;
  return [
    h("div",{class:"page-h"}, h("div",{}, h("h2",{},"SOPs"), h("p",{class:"sub"},"How the media team works. New here? Start with “How we work”, then the main SOP.")),
      h("button",{class:"btn", type:"button", onclick:() => setView("cycle")},"How we work →")),
    st ? h("section",{class:"card strategy"},
      h("div",{class:"strat-grid"}, ...[["Who we serve", st.serve],["Primary goal", st.primary],["Secondary goal", st.secondary]].map(([l, v]) => h("div",{}, h("div",{class:"lbl"}, l), h("p",{}, v))))) : null,
    main ? h("button",{class:"card sop-main", type:"button", onclick:() => { S.sopOpen = main.id; renderMain(); }},
      h("span",{class:"sop-ic"}, icon("sops", 26)), h("div",{}, h("div",{class:"lbl"},"Main SOP"), h("h3",{}, main.title), h("p",{class:"muted"}, main.summary || "")), h("span",{class:"folder-go"},"Open →")) : null,
    subs.length ? h("div",{class:"sop-subs"}, ...subs.map(s => h("button",{class:"card sop-sub", type:"button", onclick:() => { S.sopOpen = s.id; renderMain(); }},
      h("h3",{}, s.title), h("p",{class:"muted small"}, s.summary || ""), h("span",{class:"folder-go"},"Open →")))) : null
  ];
}
function sopPage(s){
  const fiesta = S.series.find(x => x.id === "fiesta");
  const whoFor = nm => (fiesta?.roles || []).filter(r => (r.title || "").toLowerCase() === nm.toLowerCase()).map(r => teamById(r.personId)).filter(Boolean);
  return [
    h("div",{}, h("button",{class:"btn ghost sm", type:"button", onclick:() => { S.sopOpen = ""; renderMain(); }},"← All SOPs")),
    h("div",{class:"page-h"}, h("div",{}, h("h2",{}, s.title), s.summary ? h("p",{class:"sub"}, s.summary) : null),
      isAdmin() ? h("button",{class:"btn", type:"button", onclick:() => openSopEditor(s)},"Edit") : null),
    (s.roles || []).length > 1 ? h("nav",{class:"jump"}, ...(s.roles || []).map(r => h("button",{type:"button", onclick:() => document.getElementById("r-" + keyOf(r.name))?.scrollIntoView({behavior:"smooth"})}, plainName(r.name)))) : null,
    ...(s.roles || []).map(r => {
      const nm = plainName(r.name), who = whoFor(nm), ds = lines(r.deliverables).map(parseDeliv), how = lines(r.how);
      return h("section",{class:"card sop-role", id:"r-" + keyOf(r.name)},
        h("header",{class:"rs-head"}, h("div",{}, h("h3",{class:"rs-title"}, ...newify(r.name)), r.purpose ? h("p",{class:"muted"}, r.purpose) : null),
          h("div",{class:"rs-meta"}, ...who.map(p => h("span",{class:"who-chip"}, avatar(p, "sm"), p.name)), r.folder ? h("span",{class:"folder-tag"}, r.folder) : null)),
        ds.length ? h("div",{class:"rs-block"}, h("div",{class:"lbl"},"What to hand over"), h("div",{class:"tiles"}, ...ds.map(d => h("div",{class:"tile"},
          h("div",{class:"tile-n"}, d.count == null ? "✓" : d.per ? `${d.count}×` : String(d.count)), h("div",{class:"tile-u"}, d.count == null ? "To do" : d.per ? "Per pitcher" : "Total"), h("div",{class:"tile-t"}, ...newify(d.text)))))) : null,
        how.length ? h("div",{class:"rs-block"}, h("div",{class:"lbl"},"How to do it"), h("ul",{class:"checks"}, ...how.map(l => h("li",{}, ...newify(l))))) : null,
        lines(r.later).length ? h("details",{class:"rs-block wide"}, h("summary",{}, "Next to measure"), h("ul",{class:"checks"}, ...lines(r.later).map(l => h("li",{}, ...newify(l))))) : null);
    })
  ];
}
function viewSops(){ const s = S.sopOpen && visibleSops().find(x => x.id === S.sopOpen); return s ? sopPage(s) : sopList(); }

function openSopEditor(s){
  const title = input("se-title", s.title), summary = textarea("se-sum", s.summary, 2);
  const rf = (s.roles || []).map((r, i) => ({name:input(`sr-${i}-n`, r.name), folder:input(`sr-${i}-f`, r.folder), purpose:textarea(`sr-${i}-p`, r.purpose, 2),
    how:textarea(`sr-${i}-h`, r.how, 4, "One instruction per line"), deliverables:textarea(`sr-${i}-d`, r.deliverables, 3, "50 | General photos\n3/pitcher | Photos per pitcher"), later:textarea(`sr-${i}-l`, r.later, 2)}));
  const msg = h("div",{class:"cmp-status"});
  openDrawer("Edit SOP", [
    h("p",{class:"small muted", style:"margin:0"},"Deliverables: “50 | General photos” makes a countable tile; “3/pitcher |” scales with pitchers. Add “(New)” at the end of anything new."),
    h("div",{class:"fields"}, field("Title", title, true), field("Summary", summary, true)),
    ...rf.map((f, i) => h("section",{class:"sop-edit"}, h("div",{class:"form-sec"}, `Section ${i + 1}`),
      h("div",{class:"fields"}, field("Name", f.name), field("Folder", f.folder), field("What it's for", f.purpose, true), field("How to do it", f.how, true), field("Deliverables", f.deliverables, true), field("Next to measure", f.later, true)))),
    h("div",{class:"d-actions"}, msg, h("button",{class:"btn primary", type:"button", onclick:async () => {
      const roles = rf.map(f => ({name:f.name.value.trim(), folder:f.folder.value.trim(), purpose:f.purpose.value.trim(), how:f.how.value.trim(), deliverables:f.deliverables.value.trim(), later:f.later.value.trim()})).filter(r => r.name);
      try{ await db.collection("sops").doc(s.id).update({title:title.value.trim() || s.title, summary:summary.value.trim(), roles, updatedAt:new Date().toISOString()}); closeDrawer(); toast("SOP saved."); }
      catch(e){ msg.textContent = dbErr(e); }
    }},"Save"))
  ]);
}

registerView("sops", viewSops);
