// Media team meeting: one side drawer with the Meet call and that day's notes doc (anyone on the team can attach it).
import { S, db, h, icon, isAdmin, safeUrl, fmt, fmtShort, nextMeeting, toast, dbErr, openDrawer, closeDrawer, field, input, select } from "./core.js";

export const meetEvery = c => +c?.every === 7 ? "week" : +c?.every === 28 ? "4 weeks" : "2 weeks";

export function openMeetingSchedule(){
  const c = S.meetCfg || {};
  const anchor = input("ms-anchor", c.anchor, {type:"date"}), every = select("ms-every", [["7","Every week"],["14","Every 2 weeks"],["28","Every 4 weeks"]], String(c.every || 14));
  const time = input("ms-time", c.time, {placeholder:"e.g. 2–2:30 PM"}), link = input("ms-link", c.link, {type:"url", placeholder:"Meet / Zoom link"});
  const msg = h("div",{class:"cmp-status"});
  openDrawer("Meeting schedule", [
    h("div",{class:"fields"}, field("A meeting date", anchor), field("Repeats", every), field("Time", time), field("Google Meet link", link, true)),
    h("div",{class:"d-actions"}, msg, h("button",{class:"btn primary", type:"button", onclick:async () => {
      if (!anchor.value){ msg.textContent = "Pick a meeting date."; return; }
      try{ await db.doc("config/meetings").set({...c, anchor:anchor.value, every:+every.value, time:time.value.trim(), link:link.value.trim()}); closeDrawer(); toast("Saved."); }catch(e){ msg.textContent = dbErr(e); }
    }},"Save"))
  ]);
}

// one link as a wide tile; greyed out with "No link yet" when it isn't set
function tile(u, ic, title, sub){
  return h(u ? "a" : "div",{class:"mt-link" + (u ? "" : " off"), href:u || null, target:u ? "_blank" : null, rel:u ? "noopener" : null},
    h("span",{class:"folder-ic"}, icon(ic, 20)), h("div",{class:"mt-b"}, h("b",{}, title), h("span",{class:"small muted"}, sub)),
    h("span",{class:"folder-go"}, u ? "Open ↗" : "No link yet"));
}
export function openMeeting(day){
  const c = S.meetCfg || {}, d = day || nextMeeting();
  if (!d){ if (isAdmin()) openMeetingSchedule(); return; }
  const notes = c.notes || {};
  const notesIn = input("mt-notes", notes[d], {type:"url", placeholder:"Paste the Google Docs link (Share → Copy link)"}), msg = h("div",{class:"cmp-status"});
  openDrawer("Media team meeting", [
    h("dl",{class:"facts"}, h("div",{}, h("dt",{},"When"), h("dd",{}, fmt(d) + (c.time ? " · " + c.time : ""))), h("div",{}, h("dt",{},"Repeats"), h("dd",{}, "Every " + meetEvery(c)))),
    h("div",{class:"mt-links"},
      tile(safeUrl(c.link), "video", "Join Google Meet", "The video call"),
      tile(safeUrl(notes[d]), "sops", `Meeting doc for ${fmtShort(d)}`, "Agenda and notes everyone can open")),
    h("div",{class:"fields"}, field(`Meeting doc link for ${fmtShort(d)}`, notesIn, true)),
    h("div",{class:"d-actions"}, isAdmin() ? h("button",{class:"link", type:"button", onclick:openMeetingSchedule},"Edit schedule & Meet link") : h("span",{}),
      h("button",{class:"btn primary", type:"button", onclick:async () => {
        const u = notesIn.value.trim();
        if (u && !safeUrl(u)){ msg.textContent = "Paste a full link that starts with https://"; return; }
        try{ await db.doc("config/meetings").update({notes:{[d]:u}}); closeDrawer(); toast(u ? "Meeting doc linked." : "Link removed."); }catch(e){ msg.textContent = dbErr(e); }
      }},"Save link")), msg
  ]);
}
