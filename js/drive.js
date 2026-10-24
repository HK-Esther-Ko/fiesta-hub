// Drive: shortcuts to the shared Google Drive folders, in three groups.
// Every folder except the brand kit has one link per year (stored as "<key>@<year>").
import { S, db, h, icon, isAdmin, registerView, renderMain, safeUrl, toast, dbErr, openDrawer, closeDrawer, field, input } from "./core.js";

export const DRIVE = [
  ["Content", [
    ["photos","FIESTA & FoundHERs event photos","Original photos and videos from every event."],
    ["production","Content production","Carousels, reels, recaps and interview videos in progress and finished."],
    ["newsletterImages","Newsletter images","Cover and feature images for FIESTA FOCUS and HERald."]]],
  ["Meetings & pitching", [
    ["meetings","Meetings","Notes, recordings and company files from team meetings."],
    ["pitching","Pitching list","Founders pitching at each FIESTA, uploaded by the organizers."]]],
  ["Brand", [
    ["brandKit","Brand kit","Logos, colors, fonts and templates.", true]]]
];
export const CHANNELS = [
  ["fiestaSite","FIESTA website","https://www.fiesta.community/"],
  ["foundhersSite","FoundHERs website","https://foundhers.community/"],
  ["igFiesta","FIESTA Instagram",""], ["igFoundhers","FoundHERs Instagram",""], ["liFiesta","FIESTA LinkedIn",""]
];
export const channelUrl = (k, def) => safeUrl(S.links[k]) || def || null;

const FIRST_YEAR = 2026;
function years(){
  const ys = new Set([FIRST_YEAR, new Date().getFullYear(), new Date().getFullYear() + 1]);
  for (const k of Object.keys(S.links || {})){ const m = k.match(/@(\d{4})$/); if (m) ys.add(+m[1]); }
  return [...ys].filter(y => y >= FIRST_YEAR).sort();
}
const curYear = () => years().includes(S.driveYear) ? S.driveYear : Math.max(FIRST_YEAR, Math.min(new Date().getFullYear(), years().slice(-1)[0]));
// links saved before years existed count as 2026
const linkFor = (k, fixed, y) => fixed ? S.links[k] : (S.links[`${k}@${y}`] || (y === FIRST_YEAR ? S.links[k] : ""));

function viewDrive(){
  const y = curYear();
  return [
    h("div",{class:"page-h"}, h("div",{}, h("h2",{},"Team Drive"), h("p",{class:"sub"},"Shortcuts to the shared Google Drive folders. Upload in Drive; these open the right place.")),
      isAdmin() ? h("button",{class:"btn", type:"button", onclick:() => openLinks(y)},`Edit ${y} links`) : null),
    h("div",{class:"seg", role:"group", "aria-label":"Year"}, ...years().map(yr => h("button",{type:"button", "aria-pressed":String(yr === y), onclick:() => { S.driveYear = yr; renderMain(); }}, String(yr)))),
    ...DRIVE.map(([group, items]) => h("section",{class:"team-sec"}, h("div",{class:"sec-h"}, h("h3",{}, group), group === "Brand" ? h("span",{class:"muted small"},"Same for every year") : null),
      h("div",{class:"drive-grid"}, ...items.map(([k, title, desc, fixed]) => { const u = safeUrl(linkFor(k, fixed, y));
        return h(u ? "a" : "div",{class:"card folder" + (u ? "" : " off"), href:u || null, target:u ? "_blank" : null, rel:u ? "noopener" : null},
          h("span",{class:"folder-ic"}, icon("drive", 22)),
          h("div",{class:"folder-b"}, h("h3",{}, fixed ? title : `${title} · ${y}`), h("p",{}, desc)),
          h("span",{class:"folder-go"}, u ? "Open ↗" : "No link yet"));
      })))),
    // the whole marketing Drive is hard to find things in, so it stays a small link under the shortcuts
    safeUrl(S.links.marketingRoot) ? h("p",{class:"drive-all"}, "Can't find it here? ", h("a",{href:safeUrl(S.links.marketingRoot), target:"_blank", rel:"noopener"},"Open the full marketing Drive ↗")) : null
  ];
}
function openLinks(y){
  const folders = [...DRIVE.flatMap(([, items]) => items).map(([k, l, , fixed]) => [fixed ? k : `${k}@${y}`, fixed ? l : `${l} · ${y}`, linkFor(k, fixed, y)]),
    ["marketingRoot", "Full marketing Drive (small link at the bottom, every year)", S.links.marketingRoot]];
  const all = [...folders, ...CHANNELS.map(([k, l, def]) => [k, l, S.links[k] || def])];
  const inputs = all.map(([k, l, v]) => [k, l, input("lnk-" + k.replace("@", "-"), v, {type:"url", placeholder:"https://…"})]);
  const msg = h("div",{class:"cmp-status"});
  openDrawer(`Links · ${y}`, [
    h("p",{class:"small muted", style:"margin:0"},`In Google Drive, right-click a folder → Share → Copy link, and paste it here. These are the ${y} folders; switch years on the Drive page to edit another year.`),
    h("div",{class:"form-sec"}, `Drive folders · ${y}`),
    h("div",{class:"fields"}, ...inputs.slice(0, folders.length).map(([, l, i]) => field(l, i, true))),
    h("div",{class:"form-sec"},"Our channels"),
    h("div",{class:"fields"}, ...inputs.slice(folders.length).map(([, l, i]) => field(l, i, true))),
    h("div",{class:"d-actions"}, msg, h("button",{class:"btn primary", type:"button", onclick:async () => {
      const data = {...S.links}; inputs.forEach(([k, , i]) => data[k] = i.value.trim());
      try{ await db.doc("config/links").set(data); closeDrawer(); toast("Links saved."); }catch(e){ msg.textContent = dbErr(e); }
    }},"Save"))
  ]);
}

registerView("drive", viewDrive);
