// Home: what's coming up, this week's content, my work, and quick team / channel / KPI glances.
import { S, db, h, icon, avatar, isAdmin, registerView, setView, ymd, parse, today, addDays, daysUntil, fmt, fmtShort, BRANDS, PLATFORMS, posts, isDone,
  ownersFor, nameOf, initials, teamSorted, nextEventOf, upcomingSpecials, nextMeeting, meetingsBetween, allEvents, toast, dbErr, openDrawer, closeDrawer, field, input, select, card, linkBtn } from "./core.js";
import { openItem } from "./calendar.js";
import { openTask, taskRow } from "./requests.js";
import { kpiRows, change, num, signed, monthLabel } from "./analytics.js";
import { CHANNELS, channelUrl } from "./drive.js";

function ring(done, total){
  const r = 30, c = 2 * Math.PI * r, p = total ? done / total : 0, el = h("div",{class:"ring"});
  el.innerHTML = `<svg viewBox="0 0 76 76" width="76" height="76" aria-hidden="true"><circle cx="38" cy="38" r="${r}" class="ring-bg"/><circle cx="38" cy="38" r="${r}" class="ring-fg" stroke-dasharray="${(c*p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 38 38)"/></svg>`;
  el.append(h("div",{class:"ring-n"}, total ? `${Math.round(p * 100)}%` : "—")); return el;
}
function openMeetingSchedule(){
  const c = S.meetCfg || {};
  const anchor = input("ms-anchor", c.anchor, {type:"date"}), every = select("ms-every", [["7","Every week"],["14","Every 2 weeks"],["28","Every 4 weeks"]], String(c.every || 14));
  const time = input("ms-time", c.time, {placeholder:"e.g. 10 AM"}), link = input("ms-link", c.link, {type:"url", placeholder:"Meet / Zoom link"});
  const msg = h("div",{class:"cmp-status"});
  openDrawer("Team meeting", [
    h("div",{class:"fields"}, field("A meeting date", anchor), field("Repeats", every), field("Time", time), field("Link", link, true)),
    h("div",{class:"d-actions"}, msg, h("button",{class:"btn primary", type:"button", onclick:async () => {
      if (!anchor.value){ msg.textContent = "Pick a meeting date."; return; }
      try{ await db.doc("config/meetings").set({anchor:anchor.value, every:+every.value, time:time.value.trim(), link:link.value.trim()}); closeDrawer(); toast("Saved."); }catch(e){ msg.textContent = dbErr(e); }
    }},"Save"))
  ]);
}
function countdowns(){
  const tile = (label, date, sub, dot, onclick) => h("button",{class:"cd", type:"button", onclick, disabled:!onclick},
    h("div",{class:"cd-l"}, h("i",{class:"dot", style:`background:${dot}`}), label),
    h("div",{class:"cd-n"}, date ? (daysUntil(date) === 0 ? "Today" : `${daysUntil(date)} days`) : "—"),
    h("div",{class:"cd-s"}, date ? fmt(date) + (sub ? " · " + sub : "") : sub));
  const fi = nextEventOf("fiesta"), fh = nextEventOf("foundhers"), sp = upcomingSpecials()[0], m = nextMeeting();
  return h("div",{class:"cds"},
    tile("Team meeting", m, m ? (S.meetCfg?.time || "") : (isAdmin() ? "Set the schedule" : "Not scheduled"), "var(--accent)", isAdmin() ? openMeetingSchedule : (S.meetCfg?.link ? () => window.open(S.meetCfg.link, "_blank") : null)),
    tile("FIESTA", fi?.date, "3rd Tuesday", "var(--fiesta)", () => { S.chartId = "fiesta"; setView("team"); }),
    tile("FoundHERs", fh?.date, "1st Tuesday", "var(--foundhers)", () => { S.chartId = "foundhers"; setView("team"); }),
    sp ? tile(sp.name, sp.date, "", "var(--muted)", null) : null);
}
function weekStrip(){
  const t0 = parse(today()), mon = addDays(t0, -((t0.getDay() + 6) % 7));
  const days = [...Array(7)].map((_, i) => ymd(addDays(mon, i)));
  const all = posts(), meet = new Set(meetingsBetween(days[0], days[6])), evs = allEvents();
  return h("div",{class:"week"}, ...days.map(d => {
    const items = all.filter(c => c.publishDate === d).sort((a, b) => (a.platform === "Newsletter" ? -1 : 0) - (b.platform === "Newsletter" ? -1 : 0));
    return h("div",{class:"wk" + (d === today() ? " today" : "")},
      h("div",{class:"wk-h"}, h("span",{class:"wk-d"}, parse(d).toLocaleDateString("en-US",{weekday:"short"})), h("span",{class:"wk-n"}, parse(d).getDate())),
      meet.has(d) ? h("div",{class:"wk-ev meet"}, "Team meeting") : null,
      ...evs.filter(e => e.date === d).map(e => h("div",{class:"wk-ev", style:`--c:${(BRANDS[e.brand] || {}).c || "var(--muted)"}`}, e.name)),
      ...items.map(c => h("button",{class:"wk-post st-" + c.status + (c.platform === "Newsletter" ? " nl" : ""), type:"button", style:`--c:${BRANDS[c.brand].c}`, title:c.title, onclick:() => openItem(c.id)},
        icon(PLATFORMS[c.platform].icon, 11), h("span",{class:"wk-t"}, c.title), h("span",{class:"wk-o"}, ownersFor(c).map(id => initials(nameOf(id))).join("+")))),
      !items.length && !meet.has(d) ? h("div",{class:"wk-empty"}, "—") : null);
  }));
}
function viewHome(){
  const me = S.team.find(t => t.id === S.meId);
  if (!me) return [h("div",{class:"hello"}, h("h1",{},"Welcome!"), h("p",{},"Your account isn't linked to a team card yet. Ask an admin to add your email on the Access page."))];
  const mine = S.tasks.filter(t => t.ownerId === me.id), open = mine.filter(t => !t.done).sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
  const doneRecent = mine.filter(t => t.done && (t.doneAt || "") >= ymd(addDays(parse(today()), -30))).length;
  const myPosts = posts().filter(c => ownersFor(c).includes(me.id) && !isDone(c) && c.deadline && daysUntil(c.deadline) <= 7);
  const k = kpiRows(), last = k[k.length - 1], prev = k[k.length - 2];
  const kp = (label, key, fmtv) => { const d = last && prev ? change(last[key], prev[key]) : null;
    return h("div",{class:"mk"}, h("div",{class:"lbl"}, label), h("div",{class:"mk-n"}, fmtv(last?.[key])), d ? h("div",{class:"kpi-d " + (d.up ? "up" : "down")}, `${d.up ? "▲" : "▼"} ${d.text}`) : h("div",{class:"kpi-d muted"}, " ")); };
  const published = posts().filter(isDone).sort((a, b) => (b.publishDate || "").localeCompare(a.publishDate || "")).slice(0, 3);
  return [
    h("div",{class:"hello"}, h("h1",{}, `Hi ${me.name.split(/\s+/)[0]}`),
      h("p",{}, open.length || myPosts.length ? `${open.length} open task${open.length === 1 ? "" : "s"} and ${myPosts.length} post${myPosts.length === 1 ? "" : "s"} due this week.` : "You're all caught up.")),
    countdowns(),
    card("This week's content", linkBtn("Open calendar", () => setView("calendar")), weekStrip()),
    h("div",{class:"grid2"},
      card("My work", linkBtn("+ Add my task", () => openTask(null)),
        h("div",{class:"work"}, ring(doneRecent, doneRecent + open.length), h("div",{}, h("div",{class:"big"}, open.length), h("div",{class:"muted small"}, `open · ${doneRecent} done in the last 30 days`))),
        h("div",{class:"list"}, ...(open.length ? open.slice(0, 4).map(t => taskRow(t)) : [h("div",{class:"empty"},"Nothing waiting on you.")])),
        open.length > 4 ? h("div",{class:"more"}, linkBtn(`See all ${open.length}`, () => { S.reqFilter = "mine"; setView("requests"); })) : null),
      card("Instagram this month", linkBtn("Analytics", () => setView("analytics")),
        last ? h("div",{class:"mks"}, h("div",{class:"small muted mk-month"}, monthLabel(last.id, true)),
          kp("Growth", "igNewFollowers", signed), kp("Shares", "igShares", num), kp("Link clicks", "igLinkClicks", num)) : h("div",{class:"empty"},"No KPIs entered yet."))),
    h("div",{class:"grid2"},
      card("Our channels", null,
        h("div",{class:"chan"}, ...CHANNELS.map(([key, label, def]) => { const u = channelUrl(key, def);
          return u ? h("a",{class:"chan-btn", href:u, target:"_blank", rel:"noopener"}, icon(/^ig/.test(key) ? "instagram" : /^li/.test(key) ? "linkedin" : "link", 16), label) : null; })),
        published.length ? h("div",{class:"list"}, h("div",{class:"lbl pad-x"},"Recently published"), ...published.map(c => h("button",{class:"item slim", type:"button", onclick:() => openItem(c.id)},
          h("span",{class:"pf", style:`--c:${BRANDS[c.brand].c}`}, icon(PLATFORMS[c.platform].icon, 14)), h("div",{class:"item-b"}, h("div",{class:"t"}, c.title), h("div",{class:"meta"}, `${c.platform} · ${fmtShort(c.publishDate)}`))))) : null),
      card("Team", linkBtn("View all", () => { S.teamTab = "roles"; setView("team"); }),
        h("div",{class:"faces"}, ...teamSorted().map(t => h("div",{class:"face"}, avatar(t, "md"), h("span",{}, (t.name || "").split(/\s+/)[0]))))))
  ];
}

registerView("home", viewHome);
