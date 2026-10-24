// Content calendar: what goes live, where and when. Production deadlines are listed under the grid.
import { S, db, h, icon, isAdmin, registerView, renderMain, setView, save, ymd, parse, pad, today, addDays, daysUntil, fmt, fmtShort, monthName, firstOfMonth,
  safeUrl, hourOf, BRANDS, PLATFORMS, STATUS, statusLabel, normItem, posts, isDone, isLate, ownersFor, OWNER_RULES, brandChip, statusPill, deadlinePill,
  allEvents, seriesById, nameOf, firstName, teamById, toast, dbErr, openDrawer, closeDrawer, deleteButton, field, input, select, textarea, sendEmail, HUB_URL, initials } from "./core.js";
import { threadList, composer, updateThreads } from "./chat.js";
import { prepSection } from "./requests.js";

const visible = () => posts().filter(c => !S.brandOff.has(c.brand) && !S.platformOff.has(c.platform));
const ownerTag = c => ownersFor(c).map(id => initials(nameOf(id))).join(" + ");

function filters(){
  const tog = (set, k, label, c, ic) => h("button",{class:"fchip", type:"button", style:c ? `--c:${c}` : null, "aria-pressed":String(!set.has(k)),
    onclick:() => { set.has(k) ? set.delete(k) : set.add(k); renderMain(); }}, ic ? icon(ic, 14) : h("i",{class:"fdot"}), label);
  return h("div",{class:"filters"},
    h("div",{class:"fgroup"}, h("span",{class:"flabel"},"Brand"), ...Object.entries(BRANDS).map(([k, B]) => tog(S.brandOff, k, B.label, B.c))),
    h("div",{class:"fgroup"}, h("span",{class:"flabel"},"Platform"), ...Object.entries(PLATFORMS).map(([k, P]) => tog(S.platformOff, k, P.label, null, P.icon))));
}
function chip(c){
  return h("button",{class:`ev st-${c.status}` + (c.platform === "Newsletter" ? " nl" : "") + (isLate(c) ? " late" : ""), type:"button",
    style:`--c:${BRANDS[c.brand].c}`, title:`${c.title} · ${c.platform} ${c.format} · ${statusLabel(c.status)}${c.deadline ? " · due " + fmtShort(c.deadline) : ""}`, onclick:() => openItem(c.id)},
    icon(PLATFORMS[c.platform].icon, 12), h("span",{class:"ev-t"}, c.title), h("span",{class:"ev-o"}, ownerTag(c)));
}

function viewCalendar(){
  const m = S.month, y = m.getFullYear(), mo = m.getMonth();
  const start = new Date(y, mo, 1 - m.getDay());
  const items = visible(), byDay = {}, evDay = {};
  for (const c of items) if (c.publishDate) (byDay[c.publishDate] ||= []).push(c);
  for (const k in byDay) byDay[k].sort((a, b) => (a.platform === "Newsletter" ? -1 : 0) - (b.platform === "Newsletter" ? -1 : 0) || hourOf(a.time) - hourOf(b.time));
  for (const e of allEvents()) if (!S.brandOff.has(e.brand)) (evDay[e.date] ||= []).push(e);
  const weeks = Math.ceil((m.getDay() + new Date(y, mo + 1, 0).getDate()) / 7);
  const cells = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => h("div",{class:"dow"}, d));
  for (let i = 0; i < weeks * 7; i++){
    const d = addDays(start, i), key = ymd(d);
    cells.push(h("div",{class:"day" + (d.getMonth() !== mo ? " out" : "") + (key === today() ? " today" : "")},
      h("span",{class:"dnum"}, d.getDate()),
      ...(evDay[key] || []).map(e => h("div",{class:"evt", style:`--c:${(BRANDS[e.brand] || {}).c || "var(--muted)"}`}, h("span",{class:"evt-k"},"Event"), e.name)),
      ...(byDay[key] || []).map(chip)));
  }
  const inMonth = items.filter(c => (c.publishDate || "").slice(0, 7) === `${y}-${pad(mo + 1)}`);
  const late = inMonth.filter(isLate).length;
  return [
    h("div",{class:"page-h"},
      h("div",{class:"cal-nav"}, h("h2",{}, m.toLocaleDateString("en-US",{month:"long", year:"numeric"})),
        h("div",{class:"seg"},
          h("button",{type:"button", "aria-label":"Previous month", onclick:() => { S.month = new Date(y, mo - 1, 1); renderMain(); }},"‹"),
          h("button",{type:"button", onclick:() => { S.month = firstOfMonth(new Date()); renderMain(); }},"Today"),
          h("button",{type:"button", "aria-label":"Next month", onclick:() => { S.month = new Date(y, mo + 1, 1); renderMain(); }},"›"))),
      isAdmin() ? h("div",{class:"row"}, h("button",{class:"btn", type:"button", onclick:openPlanner},"Plan a month"), h("button",{class:"btn primary", type:"button", onclick:() => openItem(null)},"+ New post")) : null),
    filters(),
    h("div",{class:"st-sum"}, ...STATUS.map(([k, l]) => h("span",{class:"st st-" + k}, h("i",{}), `${l} · ${inMonth.filter(c => c.status === k).length}`)),
      late ? h("span",{class:"st late"}, h("i",{}), `${late} past date, not published`) : null),
    h("div",{class:"card cal-wrap"}, h("div",{class:"cal"}, cells)),
    ...deadlineSections(items)
  ];
}
export function itemRow(c){
  return h("button",{class:"item", type:"button", onclick:() => openItem(c.id)},
    h("span",{class:"pf", style:`--c:${BRANDS[c.brand].c}`}, icon(PLATFORMS[c.platform].icon, 16)),
    h("div",{class:"item-b"}, h("div",{class:"t"}, c.title), h("div",{class:"meta"}, `${c.brand} · ${c.format}${c.publishDate ? " · live " + fmtShort(c.publishDate) : ""} · ${ownersFor(c).map(firstName).join(", ")}`)),
    h("div",{class:"when"}, statusPill(c.status), deadlinePill(c)));
}
function deadlineSections(items){
  const open = items.filter(c => !isDone(c) && c.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const overdue = open.filter(c => daysUntil(c.deadline) < 0), week = open.filter(c => { const n = daysUntil(c.deadline); return n >= 0 && n <= 7; });
  const later = open.filter(c => daysUntil(c.deadline) > 7);
  return [
    h("div",{class:"sec-h"}, h("h3",{},"Production deadlines"), h("span",{class:"muted small"},"When each post has to be finished, before it goes live")),
    h("div",{class:"dl-grid"},
      h("div",{class:"card"}, h("div",{class:"card-h"}, h("h3",{}, "Overdue"), h("span",{class:"count bad"}, overdue.length)), h("div",{class:"list"}, ...(overdue.length ? overdue.map(itemRow) : [h("div",{class:"empty"},"Nothing overdue.")]))),
      h("div",{class:"card"}, h("div",{class:"card-h"}, h("h3",{}, "Next 7 days"), h("span",{class:"count"}, week.length)), h("div",{class:"list"}, ...(week.length ? week.map(itemRow) : [h("div",{class:"empty"},"Nothing due this week.")])))),
    later.length ? h("details",{class:"card fold"}, h("summary",{}, `Later · ${later.length}`), h("div",{class:"list"}, ...later.map(itemRow))) : null
  ];
}

/* ---------- one post ---------- */
function facts(c){
  const final = safeUrl(c.finalUrl);
  return h("dl",{class:"facts"},
    h("div",{}, h("dt",{},"Goes live"), h("dd",{}, c.publishDate ? fmt(c.publishDate) + (c.time ? " · " + c.time : "") : "Not scheduled")),
    h("div",{}, h("dt",{},"Production deadline"), h("dd",{}, c.deadline ? [fmt(c.deadline), " ", deadlinePill(c)] : "Not set")),
    h("div",{}, h("dt",{},"Where"), h("dd",{}, `${c.brand} · ${c.platform} · ${c.format}`)),
    h("div",{}, h("dt",{},"Owner"), h("dd",{}, ownersFor(c).map(nameOf).join(", "))),
    h("div",{class:"wide"}, h("dt",{},"Content"), h("dd",{style:"white-space:pre-wrap"}, c.notes || "No brief yet.")),
    h("div",{class:"wide"}, h("dt",{},"Finished file"), h("dd",{}, final ? h("a",{href:final, target:"_blank", rel:"noopener"},"Open finished file ↗") : "Not uploaded yet.")));
}
function discussion(c){
  return h("section",{class:"d-thread"}, h("div",{class:"d-sec"}, h("h3",{},"Discussion")), threadList(c.id), composer(c.id));
}
export function openItem(id){
  const raw = id ? S.content.find(x => x.id === id) : null;
  if (id && !raw) return;
  const c = raw ? normItem(raw) : {brand:"FIESTA", platform:"Instagram", format:"Carousel", time:"12 PM", status:"todo"};
  if (!isAdmin()){
    const drive = safeUrl(c.driveUrl);
    openDrawer(c.title, [h("div",{class:"row"}, brandChip(c.brand), statusPill(c.status)), facts(c),
      drive ? h("a",{class:"btn", href:drive, target:"_blank", rel:"noopener"},"Working folder ↗") : null, prepSection(c), discussion(c)]);
    updateThreads(); return;
  }
  const f = {
    title: input("it-title", c.title, {placeholder:"e.g. Founder Spotlight #3: Maidin"}),
    brand: select("it-brand", Object.keys(BRANDS), c.brand),
    platform: select("it-platform", Object.keys(PLATFORMS), c.platform),
    format: select("it-format", PLATFORMS[c.platform].formats, c.format),
    publishDate: input("it-pub", c.publishDate, {type:"date"}),
    time: input("it-time", c.time, {placeholder:"12 PM"}),
    deadline: input("it-due", c.deadline, {type:"date"}),
    notes: textarea("it-notes", c.notes, 4, "What the post says: featured founder, key points, caption draft…"),
    driveUrl: input("it-drive", c.driveUrl, {type:"url", placeholder:"Drive folder with raw files and drafts"}),
    finalUrl: input("it-final", c.finalUrl, {type:"url", placeholder:"Drive link to the finished file"})
  };
  f.platform.onchange = () => { const fm = PLATFORMS[f.platform.value].formats; f.format.replaceChildren(...fm.map(x => h("option",{value:x}, x))); paintOwner(); };
  let status = c.status;
  const seg = h("div",{class:"seg status-seg", role:"group", "aria-label":"Progress"}, ...STATUS.map(([k, l]) => h("button",{type:"button", class:"st-" + k, "aria-pressed":String(status === k), onclick:async ev => {
    status = k; seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === ev.currentTarget)));
    if (id){ try{ await db.collection("content").doc(id).update({status:k, updatedAt:new Date().toISOString()}); toast(`Marked ${l}.`); }catch(e){ toast(dbErr(e)); } }
  }}, h("i",{}), l)));
  const ownerTxt = h("div",{class:"owner-fixed"});
  const paintOwner = () => { ownerTxt.textContent = ownersFor({platform:f.platform.value, title:f.title.value, type:c.type}).map(nameOf).join(", ") + "  ·  set automatically"; };
  f.title.addEventListener("input", paintOwner); paintOwner();
  const msg = h("div",{class:"cmp-status"});
  openDrawer(id ? "Edit post" : "New post", [
    h("div",{class:"field full"}, h("span",{class:"lbl"},"Progress"), seg),
    h("div",{class:"fields"},
      field("Title", f.title, true), field("Brand", f.brand), field("Platform", f.platform), field("Format", f.format),
      field("Goes live (date)", f.publishDate), field("Time", f.time), field("Production deadline", f.deadline),
      h("div",{class:"field full"}, h("span",{class:"lbl"},"Owner"), ownerTxt),
      field("Content brief & caption", f.notes, true), field("Working folder", f.driveUrl, true), field("Finished file", f.finalUrl, true)),
    h("div",{class:"d-actions"}, id ? deleteButton(() => db.collection("content").doc(id).delete()) : h("span",{}),
      h("button",{class:"btn primary", type:"button", onclick:async () => {
        const title = f.title.value.trim(); if (!title){ msg.textContent = "Give it a title."; return; }
        const data = {title, brand:f.brand.value, platform:f.platform.value, format:f.format.value, publishDate:f.publishDate.value, time:f.time.value.trim(),
          deadline:f.deadline.value, notes:f.notes.value.trim(), driveUrl:f.driveUrl.value.trim(), finalUrl:f.finalUrl.value.trim(), status,
          ownerIds:ownersFor({platform:f.platform.value, title, type:c.type}), updatedAt:new Date().toISOString()};
        try{ if (id) await db.collection("content").doc(id).update(data); else await db.collection("content").add({...data, createdAt:data.updatedAt});
          closeDrawer(); toast(id ? "Saved." : "Added to the calendar."); }catch(e){ msg.textContent = dbErr(e); }
      }}, id ? "Save changes" : "Add to calendar")), msg,
    id ? prepSection(c) : null, id ? discussion(c) : null
  ]);
  updateThreads();
}

/* ---------- plan a month ---------- */
// Instagram pattern from the existing calendar; newsletters on their fixed days
const GROUP = {spotlight:"Founder Spotlight", interview:"Interview reel", wins:"Founder WINs", recap:"Recap", promo:"Promotion",
  focus:"FIESTA FOCUS", fhInterview:"FoundHERs interview", fhPromo:"FoundHERs promotion", fhCarousel:"Gathering carousel", herald:"FoundHERs HERald"};
function buildPlan({n, names, start, end, nextEvent, eventDate, lead, fhDate, fhN}){
  const out = [];
  const add = (group, brand, platform, format, d, time, title, type) => out.push({group, brand, platform, format, type, publishDate:ymd(d), time, title, deadline:ymd(addDays(d, -lead))});
  const s = parse(start), e = parse(end), range = lim => { const a = []; for (let d = s; d <= lim; d = addDays(d, 1)) a.push(d); return a; };
  const win = range(e), long = range(addDays(s, 120)), tag = k => names[k-1] ? `: ${names[k-1]}` : "";
  let k = 0;
  for (const d of long){ if (k >= n) break; if ([1,3,5].includes(d.getDay())){ k++; add("spotlight","FIESTA","Instagram","Carousel", d, "12 PM", `Founder Spotlight #${k}${tag(k)}`, "Founder Spotlight"); } }
  k = 0;
  for (const d of long){ if (k >= n) break; if ([2,4].includes(d.getDay())){ k++; add("interview","FIESTA","Instagram","Reel", d, "6 PM", `Founder Interview #${k}${tag(k)}`, "Interview reel"); } }
  const sat = win.find(d => d.getDay() === 6);
  if (sat) add("recap","FIESTA","Instagram","Reel", sat, "11 AM", `${monthName(eventDate)} FIESTA Recap`, "Event recap");
  let w = 0;
  for (const d of win) if (d.getDay() === 2){ w++; add("wins","FIESTA","Instagram","Carousel", d, "3 PM", `Founder WINs #${w}`, "Founder WINs"); }
  // FIESTA FOCUS: 2nd & 4th Tuesday; HERald: 1st Friday
  for (const d of win){
    const nth = Math.ceil(d.getDate() / 7);
    if (d.getDay() === 2 && (nth === 2 || nth === 4)) add("focus","FIESTA","Newsletter","Newsletter", d, "", "FIESTA FOCUS", "Newsletter");
    if (d.getDay() === 5 && nth === 1) add("herald","FoundHERs","Newsletter","Newsletter", d, "", "FoundHERs HERald", "Newsletter");
  }
  if (nextEvent){
    const ne = parse(nextEvent), mn = monthName(nextEvent);
    for (const [o, ti, fm] of [[-12, `${mn} FIESTA Promotion`, "Carousel"], [-5, `${mn} FIESTA Reminder`, "Story"], [-2, "Final FIESTA Reminder", "Story"]]){
      const d = addDays(ne, o); if (d >= s) add("promo","FIESTA","Instagram", fm, d, "6 PM", ti, "Promotion");
    }
  }
  k = 0;
  for (const d of long){ if (k >= fhN) break; if (d.getDay() === 5){ k++; add("fhInterview","FoundHERs","Instagram","Reel", d, "6 PM", `FoundHERs Founder Interview #${k}`, "Interview reel"); } }
  if (fhDate){
    const G = parse(fhDate), mn = monthName(fhDate);
    const fh = (o, group, fm, time, title, type) => { const d = addDays(G, o); if (d >= s) add(group, "FoundHERs", "Instagram", fm, d, time, title, type); };
    fh(-6, "fhPromo", "Carousel", "6 PM", `${mn} Gathering Promotion`, "Promotion");
    fh(0, "recap", "Reel", "Evening", `${mn} Gathering Recap`, "Event recap");
    fh(6, "fhCarousel", "Carousel", "6 PM", "Gathering Carousel #1", "Gathering carousel");
    fh(13, "fhCarousel", "Carousel", "6 PM", "Gathering Carousel #2", "Gathering carousel");
  }
  return out.sort((a, b) => a.publishDate.localeCompare(b.publishDate) || hourOf(a.time) - hourOf(b.time));
}
function openPlanner(){
  const evs = allEvents(), fiestas = evs.filter(e => e.seriesId === "fiesta").sort((a, b) => a.date.localeCompare(b.date));
  if (!fiestas.length){ toast("The FIESTA schedule isn't set up yet."); return; }
  const fhs = evs.filter(e => e.seriesId === "foundhers").sort((a, b) => a.date.localeCompare(b.date));
  const pick = fiestas.filter(e => e.date <= today()).pop() || fiestas[0];
  const evSel = select("pl-event", fiestas.map(e => [e.id, `FIESTA · ${fmt(e.date)}`]), pick.id);
  const nSel = select("pl-n", [8,9,10,11,12,13,14,15].map(x => [String(x), `${x} founders`]), "12");
  const fhNSel = select("pl-fhn", [0,1,2,3,4].map(x => [String(x), String(x)]), "2");
  const nextIn = input("pl-next", "", {type:"date"}), fhIn = input("pl-fh", "", {type:"date"});
  const startIn = input("pl-start", "", {type:"date"}), endIn = input("pl-end", "", {type:"date"});
  const leadSel = select("pl-lead", [1,2,3,5,7].map(x => [String(x), `${x} day${x > 1 ? "s" : ""} before`]), "2");
  const msg = h("div",{class:"cmp-status"}), out = h("div",{class:"preview"});
  const load = () => {
    const ev = fiestas.find(e => e.id === evSel.value), next = fiestas.find(e => e.date > ev.date);
    nextIn.value = next ? next.date : ""; startIn.value = ymd(addDays(parse(ev.date), 1));
    endIn.value = next ? ymd(addDays(parse(next.date), -1)) : ymd(addDays(parse(ev.date), 28));
    fhIn.value = (fhs.find(e => e.date >= startIn.value) || {}).date || ""; out.replaceChildren();
  };
  evSel.onchange = load; load();
  const preview = h("button",{class:"btn primary", type:"button", onclick:() => {
    const ev = fiestas.find(e => e.id === evSel.value);
    if (!startIn.value || !endIn.value || endIn.value < startIn.value){ msg.textContent = "Check the dates: the end has to be after the start."; return; }
    const plan = buildPlan({n:+nSel.value, names:[], start:startIn.value, end:endIn.value, nextEvent:nextIn.value, eventDate:ev.date, lead:+leadSel.value, fhDate:fhIn.value, fhN:+fhNSel.value});
    const exists = new Set(S.content.map(c => c.publishDate + "|" + (c.title || "").toLowerCase()));
    const boxes = plan.map(p => { const cb = h("input",{type:"checkbox", "aria-label":"Include " + p.title}); cb.checked = !exists.has(p.publishDate + "|" + p.title.toLowerCase()); return cb; });
    const create = h("button",{class:"btn primary", type:"button", onclick:async () => {
      const picks = plan.filter((_, i) => boxes[i].checked); if (!picks.length){ msg.textContent = "Nothing selected."; return; }
      create.disabled = true; msg.textContent = `Creating ${picks.length} posts…`;
      const now = new Date().toISOString();
      try{ for (const p of picks){ const {group, ...rest} = p; await db.collection("content").add({...rest, status:"todo", ownerIds:ownersFor(p), notes:"", driveUrl:"", finalUrl:"", createdAt:now, updatedAt:now}); } }
      catch(e){ msg.textContent = dbErr(e); create.disabled = false; return; }
      const byOwner = {}; for (const p of picks) for (const o of ownersFor(p)) (byOwner[o] ||= []).push(p);
      if (S.meId){ try{ await db.collection("messages").add({thread:"general", text:Object.keys(byOwner).map(o => "@" + nameOf(o)).join(" ") + ` ${picks.length} posts are on the calendar for next month. Check yours and fix anything that's off.`, authorId:S.meId, mentions:Object.keys(byOwner), createdAt:now}); }catch(e){} }
      closeDrawer(); toast(`Created ${picks.length} posts.`); S.month = firstOfMonth(parse(picks[0].publishDate)); setView("calendar");
    }}, "Create posts");
    out.replaceChildren(
      h("div",{class:"small"}, h("b",{}, `${plan.length} posts`), " · already-planned posts are unchecked"),
      h("div",{class:"plan-scroll"}, h("table",{class:"tbl"},
        h("thead",{}, h("tr",{}, h("th",{}), h("th",{},"Live"), h("th",{},"Post"), h("th",{},"Due"), h("th",{},"Owner"))),
        h("tbody",{}, ...plan.map((p, i) => h("tr",{}, h("td",{}, boxes[i]), h("td",{class:"mono"}, `${fmtShort(p.publishDate)} ${p.time}`),
          h("td",{}, h("div",{class:"row tight"}, h("span",{class:"pf sm", style:`--c:${BRANDS[p.brand].c}`}, icon(PLATFORMS[p.platform].icon, 12)), p.title), h("div",{class:"small muted"}, `${p.brand} · ${p.format} · ${GROUP[p.group]}`)),
          h("td",{class:"mono"}, fmtShort(p.deadline)), h("td",{}, ownersFor(p).map(firstName).join(", "))))))),
      h("div",{class:"d-actions"}, h("span",{}), create));
    msg.textContent = "";
  }}, "Preview plan");
  openDrawer("Plan a month", [
    h("p",{class:"muted", style:"margin:0"},"Builds next month's posts for FIESTA and FoundHERs from the usual schedule. Founder posts scale with how many founders pitched."),
    h("div",{class:"form-sec"}, "FIESTA"),
    h("div",{class:"fields"}, field("Meetup the content is about", evSel, true), field("Founders who pitched", nSel), field("Next FIESTA (for promotion)", nextIn)),
    h("div",{class:"form-sec"}, "FoundHERs"),
    h("div",{class:"fields"}, field("Gathering date", fhIn), field("Interview reels", fhNSel)),
    h("div",{class:"form-sec"}, "Dates"),
    h("div",{class:"fields"}, field("Plan from", startIn), field("Plan until", endIn), field("Production deadline", leadSel)),
    h("dl",{class:"facts"}, h("div",{class:"wide"}, h("dt",{},"Owners (set automatically)"),
      h("dd",{}, OWNER_RULES.map(([l,, ids]) => `${l} → ${ids.map(id => teamById(id)?.name || id).join(", ")}`).join("  ·  ")))),
    preview, msg, out
  ]);
}

registerView("calendar", viewCalendar);
