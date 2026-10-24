// Access (admins only): every sign-in email is added here first, already linked to a person and a level.
// People can't choose or change their own role.
import { S, h, isAdmin, setPreview, registerView, teamById, teamSorted, toast, dbErr, openDrawer, closeDrawer, field, input, select } from "./core.js";
import { setAccess, removeAccess, importData } from "../firebase.js";

const LEVELS = [["admin","Admin","Edits the calendar, roles, SOPs, analytics and access. Assigns requests."],["member","Team member","Sees everything; updates progress, brief and files on posts they own, plus their own tasks, profile and chat."]];
const level = a => a === "admin" ? "admin" : "member";

function viewAccess(){
  if (!isAdmin()) return [h("div",{class:"card empty-big"},"Only admins can open this page.")];
  const rows = S.allowed.slice().sort((a, b) => (level(b.access) === "admin") - (level(a.access) === "admin")
    || (teamById(a.teamId)?.name || a.id).localeCompare(teamById(b.teamId)?.name || b.id));
  const linked = new Set(rows.map(r => r.teamId).filter(Boolean));
  const missing = teamSorted().filter(t => !linked.has(t.id));
  return [
    h("div",{class:"page-h"}, h("div",{}, h("h2",{},"Access"), h("p",{class:"sub"},"Add each person's Google email before they sign in. Their name, role and level are set here, not by them.")),
      h("div",{class:"row"}, h("button",{class:"btn", type:"button", onclick:openPreview},"Preview as team member"), h("button",{class:"btn", type:"button", onclick:openImport},"Import data"), h("button",{class:"btn primary", type:"button", onclick:() => openAdd()},"+ Add email"))),
    h("div",{class:"levels"}, ...LEVELS.map(([, l, d]) => h("div",{class:"card level"}, h("b",{}, l), h("span",{class:"small muted"}, d)))),
    h("div",{class:"card"}, h("div",{class:"acc-row head"}, h("span",{},"Email"), h("span",{},"Person"), h("span",{},"Level"), h("span",{})),
      ...(rows.length ? rows.map(a => {
        const who = select(null, [["","Not linked"], ...teamSorted().map(t => [t.id, t.name])], a.teamId || "");
        who.onchange = async () => { try{ await setAccess(a.id, {teamId:who.value}); toast("Saved."); }catch(e){ toast(dbErr(e)); } };
        const lv = select(null, LEVELS.map(([k, l]) => [k, l]), level(a.access));
        lv.onchange = async () => { try{ await setAccess(a.id, {access:lv.value}); toast(`${a.id} is now ${lv.value === "admin" ? "an admin" : "a team member"}.`); }catch(e){ toast(dbErr(e)); } };
        return h("div",{class:"acc-row"}, h("span",{class:"acc-mail"}, a.id), who, lv,
          a.id === S.myEmail ? h("span",{class:"small muted"},"You") : h("button",{class:"link danger", type:"button", onclick:async () => { try{ await removeAccess(a.id); toast("Removed."); }catch(e){ toast(dbErr(e)); } }},"Remove"));
      }) : [h("div",{class:"empty"},"Nobody added yet.")])),
    missing.length ? h("div",{class:"card pad"}, h("div",{class:"card-h flat"}, h("h3",{},"Not added yet"), h("span",{class:"muted small"},"These teammates can't sign in until you add their email")),
      h("div",{class:"row wrap"}, ...missing.map(t => h("button",{class:"btn sm", type:"button", onclick:() => openAdd(t.id)}, `+ ${t.name}`)))) : null
  ];
}
function openAdd(teamId){
  const email = input("ac-email", teamById(teamId)?.email || "", {type:"email", placeholder:"name@gmail.com"});
  const who = select("ac-team", [["","Not a teammate"], ...teamSorted().map(t => [t.id, t.name])], teamId || "");
  const lv = select("ac-level", LEVELS.map(([k, l]) => [k, l]), "member");
  const msg = h("div",{class:"cmp-status"});
  openDrawer("Add a sign-in", [
    h("p",{class:"small muted", style:"margin:0"},"Use the Google account they'll sign in with. When they sign in, they land on this person's profile with this level."),
    h("div",{class:"fields"}, field("Email", email, true), field("Person", who), field("Level", lv)),
    h("div",{class:"d-actions"}, msg, h("button",{class:"btn primary", type:"button", onclick:async () => {
      const e = email.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){ msg.textContent = "That email doesn't look right."; return; }
      try{ await setAccess(e, {access:lv.value, teamId:who.value}); closeDrawer(); toast(`${e} can sign in now.`); }catch(err){ msg.textContent = dbErr(err); }
    }},"Add"))
  ]);
}
function openPreview(){
  const who = select("pv-as", [["","Me (as a team member)"], ...teamSorted().filter(t => t.id !== S.meId).map(t => [t.id, t.name])], "");
  const first = h("input",{type:"checkbox", id:"pv-first", checked:true});
  openDrawer("Preview as team member", [
    h("p",{class:"small muted", style:"margin:0"},"See the site the way a team member does: no admin buttons, read-only calendar. Pick a person to also see their Home, tasks and notifications. Only you see this, in this browser tab."),
    field("View as", who, true),
    h("label",{class:"check-row"}, first, h("span",{}, h("b",{},"Start from their first visit"), h("br"), h("span",{class:"small muted"},"The sign-in screen, then the welcome step where they add their name and photo. Nothing gets saved."))),
    h("div",{class:"d-actions"}, h("span",{}), h("button",{class:"btn primary", type:"button", onclick:() => setPreview({as:who.value || "", first:first.checked, welcome:first.checked})},"Start preview"))
  ]);
}
function openImport(){
  const file = h("input",{type:"file", id:"im-file", accept:".json,application/json"});
  const msg = h("div",{class:"cmp-status"});
  openDrawer("Import data", [
    h("p",{class:"small muted", style:"margin:0"},"Choose a file from the project's data-export folder. Only the fields in the file change; nothing is deleted."),
    field("Data file", file, true),
    h("div",{class:"d-actions"}, msg, h("button",{class:"btn primary", type:"button", onclick:async () => {
      const f = file.files[0]; if (!f){ msg.textContent = "Choose the file first."; return; }
      try{ const n = await importData(JSON.parse(await f.text()), (d, t) => { msg.textContent = `Imported ${d} of ${t}…`; }); closeDrawer(); toast(`Imported ${n} items.`); }
      catch(e){ msg.textContent = e instanceof SyntaxError ? "That file isn't valid JSON." : dbErr(e); }
    }},"Import"))
  ]);
}

registerView("access", viewAccess);
