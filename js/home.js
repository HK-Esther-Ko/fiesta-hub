// Home: this month's KPIs, this week's content, my work, and quick team / channel glances.
import { S, db, h, icon, avatar, isAdmin, registerView, setView, ymd, parse, today, addDays, daysUntil, fmtShort, BRANDS, PLATFORMS, posts, isDone,
  ownersFor, nameOf, initials, teamSorted, isMyTask, meetingsBetween, allEvents, toast, dbErr, openDrawer, closeDrawer, field, input, select, card, linkBtn } from "./core.js";
import { openItem } from "./calendar.js";
import { openTask, taskRow } from "./requests.js";
import { kpiRows, change, num, signed, monthLabel } from "./analytics.js";
import { CHANNELS, channelUrl } from "./drive.js";

function ring(done, total){
  const r = 30, c = 2 * Math.PI * r, p = total ? done / total : 0, el = h("div",{class:"ring"});
  el.innerHTML = `<svg viewBox="0 0 76 76" width="76" height="76" aria-hidden="true"><circle cx="38" cy="38" r="${r}" class="ring-bg"/><circle cx="38" cy="38" r="${r}" class="ring-fg" stroke-dasharray="${(c*p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 38 38)"/></svg>`;
  el.append(h("div",{class:"ring-n"}, total ? `${Math.round(p * 100)}%` : "—")); return el;
}
export function openMeetingSchedule(){
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
function kpiStrip(){
  const k = kpiRows(), last = k[k.length - 1], prev = k[k.length - 2];
  const tile = (n, label, key, fmtv) => { const d = last && prev ? change(last[key], prev[key]) : null;
    return h("button",{class:"kt", type:"button", onclick:() => setView("analytics")},
      h("div",{class:"kt-h"}, h("span",{class:"kpi-n"}, n), h("span",{class:"kt-l"}, label)),
      h("div",{class:"kt-n"}, last ? fmtv(last[key]) : "—"),
      h("div",{class:"kt-s"}, d ? h("span",{class:d.up ? "up" : "down"}, `${d.up ? "▲" : "▼"} ${d.text}`) : null, last ? ` ${monthLabel(last.id, true)}` : " No numbers yet")); };
  return h("div",{class:"kts"},
    tile("1", "Growth · new followers", "igNewFollowers", signed),
    tile("2", "Shares", "igShares", num),
    tile("3", "Conversion · link clicks", "igLinkClicks", num));
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
        icon(PLATFORMS[c.platform].icon, 12), h("span",{class:"wk-t"}, c.title), h("span",{class:"wk-o"}, ownersFor(c).map(id => initials(nameOf(id))).join("+")))),
      !items.length && !meet.has(d) ? h("div",{class:"wk-empty"}, "—") : null);
  }));
}
function viewHome(){
  const me = S.team.find(t => t.id === S.meId);
  if (!me) return [h("div",{class:"hello"}, h("h1",{},"Welcome!"), h("p",{},"Your account isn't linked to a team card yet. Ask an admin to add your email on the Access page."))];
  const mine = S.tasks.filter(isMyTask), open = mine.filter(t => !t.done).sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
  const doneRecent = mine.filter(t => t.done && (t.doneAt || "") >= ymd(addDays(parse(today()), -30))).length;
  const myPosts = posts().filter(c => ownersFor(c).includes(me.id) && !isDone(c) && c.deadline && daysUntil(c.deadline) <= 7);
  const published = posts().filter(isDone).sort((a, b) => (b.publishDate || "").localeCompare(a.publishDate || "")).slice(0, 3);
  const chans = CHANNELS.map(([key, label, def]) => [key, label, channelUrl(key, def)]).filter(([, , u]) => u);
  return [
    h("div",{class:"hello"}, h("h1",{}, `Hi ${me.name.split(/\s+/)[0]}`),
      h("p",{}, open.length || myPosts.length ? `${open.length} open task${open.length === 1 ? "" : "s"} and ${myPosts.length} post${myPosts.length === 1 ? "" : "s"} due this week.` : "You're all caught up.")),
    kpiStrip(),
    card("This week's content", h("div",{class:"row tight"}, isAdmin() ? linkBtn("Meeting schedule", openMeetingSchedule) : null, linkBtn("Open calendar", () => setView("calendar"))), weekStrip()),
    h("div",{class:"grid2"},
      card("My work", linkBtn("+ Add my task", () => openTask(null)),
        h("div",{class:"work"}, ring(doneRecent, doneRecent + open.length), h("div",{}, h("div",{class:"big"}, open.length), h("div",{class:"muted small"}, `open · ${doneRecent} done in the last 30 days`))),
        h("div",{class:"list"}, ...(open.length ? open.slice(0, 4).map(t => taskRow(t)) : [h("div",{class:"empty"},"Nothing waiting on you.")])),
        open.length > 4 ? h("div",{class:"more"}, linkBtn(`See all ${open.length}`, () => { S.reqFilter = "mine"; setView("requests"); })) : null),
      h("div",{class:"stack"},
        card("Our channels", null,
          h("div",{class:"chan"}, ...chans.map(([key, label, u]) => h("a",{class:"chan-btn", href:u, target:"_blank", rel:"noopener"}, icon(/^ig/.test(key) ? "instagram" : /^li/.test(key) ? "linkedin" : "link", 16), label))),
          published.length ? h("div",{class:"list"}, h("div",{class:"lbl pad-x"},"Recently published"), ...published.map(c => h("button",{class:"item slim", type:"button", onclick:() => openItem(c.id)},
            h("span",{class:"pf", style:`--c:${BRANDS[c.brand].c}`}, icon(PLATFORMS[c.platform].icon, 14)), h("div",{class:"item-b"}, h("div",{class:"t"}, c.title), h("div",{class:"meta"}, `${c.platform} · ${fmtShort(c.publishDate)}`))))) : null),
        card("Team", linkBtn("View all", () => { S.teamTab = "roles"; setView("team"); }),
          h("div",{class:"faces"}, ...teamSorted().map(t => h("div",{class:"face"}, avatar(t, "md"), h("span",{}, (t.name || "").split(/\s+/)[0])))))))
  ];
}

registerView("home", viewHome);
