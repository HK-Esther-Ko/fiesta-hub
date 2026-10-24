// Drive: shortcuts to the shared Google Drive folders, in three groups.
import { S, db, h, icon, isAdmin, registerView, safeUrl, toast, dbErr, openDrawer, closeDrawer, field, input } from "./core.js";

export const DRIVE = [
  ["Content", [
    ["photos","FIESTA & FoundHERs event photos","Original photos and videos from every event."],
    ["production","Content production","Carousels, reels, recaps and interview videos in progress and finished."],
    ["newsletterImages","Newsletter images","Cover and feature images for FIESTA FOCUS and HERald."]]],
  ["Meetings & pitching", [
    ["meetings","Meetings","Notes, recordings and company files from team meetings."],
    ["pitching","Pitching list","Founders pitching at each FIESTA, uploaded by the organizers."]]],
  ["Brand", [
    ["brandKit","Brand kit","Logos, colors, fonts and templates."]]]
];
export const CHANNELS = [
  ["fiestaSite","FIESTA website","https://www.fiesta.community/"],
  ["foundhersSite","FoundHERs website","https://foundhers.community/"],
  ["igFiesta","FIESTA Instagram",""], ["igFoundhers","FoundHERs Instagram",""], ["liFiesta","FIESTA LinkedIn",""]
];
export const channelUrl = (k, def) => safeUrl(S.links[k]) || def || null;

function viewDrive(){
  return [
    h("div",{class:"page-h"}, h("div",{}, h("h2",{},"Team Drive"), h("p",{class:"sub"},"Shortcuts to the shared Google Drive folders. Upload in Drive; these open the right place.")),
      isAdmin() ? h("button",{class:"btn", type:"button", onclick:openLinks},"Edit links") : null),
    ...DRIVE.map(([group, items]) => h("section",{class:"team-sec"}, h("div",{class:"sec-h"}, h("h3",{}, group)),
      h("div",{class:"drive-grid"}, ...items.map(([k, title, desc]) => { const u = safeUrl(S.links[k]);
        return h(u ? "a" : "div",{class:"card folder" + (u ? "" : " off"), href:u || null, target:u ? "_blank" : null, rel:u ? "noopener" : null},
          h("span",{class:"folder-ic"}, icon("drive", 22)),
          h("div",{class:"folder-b"}, h("h3",{}, title), h("p",{}, desc)),
          h("span",{class:"folder-go"}, u ? "Open ↗" : "No link yet"));
      }))))
  ];
}
function openLinks(){
  const all = [...DRIVE.flatMap(([, items]) => items.map(([k, l]) => [k, l, ""])), ...CHANNELS];
  const inputs = all.map(([k, l, def]) => [k, l, input("lnk-" + k, S.links[k] || def, {type:"url", placeholder:"https://…"})]);
  const msg = h("div",{class:"cmp-status"});
  openDrawer("Links", [
    h("p",{class:"small muted", style:"margin:0"},"In Google Drive, right-click a folder → Share → Copy link, and paste it here. Channel links show on Home."),
    h("div",{class:"form-sec"},"Drive folders"),
    h("div",{class:"fields"}, ...inputs.slice(0, 6).map(([, l, i]) => field(l, i, true))),
    h("div",{class:"form-sec"},"Our channels"),
    h("div",{class:"fields"}, ...inputs.slice(6).map(([, l, i]) => field(l, i, true))),
    h("div",{class:"d-actions"}, msg, h("button",{class:"btn primary", type:"button", onclick:async () => {
      const data = {}; inputs.forEach(([k, , i]) => data[k] = i.value.trim());
      try{ await db.doc("config/links").set(data); closeDrawer(); toast("Links saved."); }catch(e){ msg.textContent = dbErr(e); }
    }},"Save"))
  ]);
}

registerView("drive", viewDrive);
