// Home: the FIESTA village, this month's KPIs, this week's content, my work, and quick team / channel glances.
import { S, h, icon, avatar, isAdmin, registerView, setView, ymd, parse, today, addDays, daysUntil, fmt, fmtShort, safeUrl, nextMeeting, BRANDS, PLATFORMS, posts, isDone,
  ownersFor, emailOf, teamSorted, isMyTask, card, linkBtn } from "./core.js";
import { openItem, weekAgenda } from "./calendar.js";
import { openTask, taskRow } from "./requests.js";
import { kpiRows, change, num, signed, monthLabel } from "./analytics.js";
import { CHANNELS, channelUrl } from "./drive.js";
import { openChat, dmThread } from "./chat.js";
import { openMeeting, openMeetingSchedule, meetEvery } from "./meeting.js";
import { village, openCharacter } from "./village.js";

function ring(done, total){
  const r = 30, c = 2 * Math.PI * r, p = total ? done / total : 0, el = h("div",{class:"ring"});
  el.innerHTML = `<svg viewBox="0 0 76 76" width="76" height="76" aria-hidden="true"><circle cx="38" cy="38" r="${r}" class="ring-bg"/><circle cx="38" cy="38" r="${r}" class="ring-fg" stroke-dasharray="${(c*p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 38 38)"/></svg>`;
  el.append(h("div",{class:"ring-n"}, total ? `${Math.round(p * 100)}%` : "—")); return el;
}
const short = v => v == null ? "—" : Math.abs(v) >= 10000 ? `${(v / 1000).toFixed(0)}K` : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(Math.round(v));
// shared hover tooltip for the small charts: month + value
function hoverTip(wrap, marks, at){
  const tip = h("div",{class:"lc-tip", hidden:true}); wrap.append(tip);
  marks.forEach((m, i) => {
    m.addEventListener("pointerenter", () => { const [x, y, label, val] = at(i), r = wrap.getBoundingClientRect();
      tip.replaceChildren(h("div",{class:"small muted"}, label), h("b",{}, val)); tip.hidden = false;
      tip.style.left = Math.min(Math.max(x * r.width, 50), r.width - 50) + "px"; tip.style.top = y * r.height + "px"; wrap.classList.add("hov"); m.classList.add("on"); });
    m.addEventListener("pointerleave", () => { tip.hidden = true; m.classList.remove("on"); });
  });
}
// last six months as a 2px line over a light area, the latest month marked
function sparkline(rows, key, fmtv){
  const pts = rows.filter(r => typeof r[key] === "number").slice(-6);
  if (pts.length < 2) return h("div",{class:"spark empty-spark"},"Trend shows after two months");
  const W = 240, H = 56, P = 6, vals = pts.map(p => p[key]);
  let lo = Math.min(...vals), hi = Math.max(...vals); if (lo === hi){ lo -= 1; hi += 1; }
  const x = i => P + (W - 2 * P) * i / (pts.length - 1), y = v => P + (H - 2 * P) * (1 - (v - lo) / (hi - lo));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const wrap = h("div",{class:"spark"});
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${line} L${x(pts.length - 1)},${H} L${x(0)},${H} Z" class="sp-area"/><path d="${line}" class="sp-line" vector-effect="non-scaling-stroke"/></svg>`;
  // markers and hit areas sit in HTML so they stay round when the svg stretches
  const marks = pts.map((p, i) => { const m = h("span",{class:"sp-hit" + (i === pts.length - 1 ? " end" : ""), style:`left:${x(i) / W * 100}%; top:${y(p[key]) / H * 100}%`}, h("i")); wrap.append(m); return m; });
  hoverTip(wrap, marks, i => [x(i) / W, y(pts[i][key]) / H, monthLabel(pts[i].id, true), fmtv(pts[i][key])]);
  return wrap;
}
function kpiStrip(rows){
  const last = rows[rows.length - 1], prev = rows[rows.length - 2];
  const tile = (n, label, key, fmtv, sub) => { const d = last && prev ? change(last[key], prev[key]) : null;
    return h("div",{class:"kt"},
      h("div",{class:"kt-h"}, h("span",{class:"kpi-n"}, n), h("span",{class:"kt-l"}, label)),
      h("div",{class:"kt-row"}, h("div",{class:"kt-n"}, last ? fmtv(last[key]) : "—"),
        d ? h("span",{class:"delta " + (d.up ? "up" : "down")}, `${d.up ? "▲" : "▼"} ${d.text}`) : null),
      h("div",{class:"kt-s"}, sub(last)),
      sparkline(rows, key, fmtv)); };
  return h("div",{class:"kts"},
    tile("1", "Growth · new followers", "igNewFollowers", signed, () => "Follows minus unfollows"),
    tile("2", "Shares", "igShares", num, l => l?.igSaves != null ? `+ ${num(l.igSaves)} saves` : "Times posts were sent on"),
    tile("3", "Conversion · link clicks", "igLinkClicks", num, l => l?.igClickRate != null ? `${l.igClickRate}% of ${num(l.igProfileVisits)} profile visits` : "Bio link taps"));
}
// views per month as bars (latest in full color), with interactions alongside as a number
function reachCard(rows){
  const pts = rows.filter(r => typeof r.igViews === "number").slice(-6), last = rows[rows.length - 1], prev = rows[rows.length - 2];
  const stat = (label, key) => { const d = last && prev ? change(last[key], prev[key]) : null;
    return h("div",{class:"reach-stat"}, h("span",{class:"kt-l"}, label), h("div",{class:"kt-row"}, h("b",{class:"reach-n"}, last ? short(last[key]) : "—"),
      d ? h("span",{class:"delta " + (d.up ? "up" : "down")}, `${d.up ? "▲" : "▼"} ${d.text}`) : null)); };
  const bars = h("div",{class:"bars"});
  if (pts.length){
    const hi = Math.max(...pts.map(p => p.igViews)) || 1;
    const cols = pts.map((p, i) => h("div",{class:"bar-col" + (i === pts.length - 1 ? " end" : "")},
      h("div",{class:"bar-track"}, h("div",{class:"bar", style:`height:${Math.max(4, p.igViews / hi * 100)}%`})), h("span",{class:"bar-m"}, monthLabel(p.id))));
    bars.append(...cols);
    hoverTip(bars, cols, i => [(i + .5) / pts.length, 1 - pts[i].igViews / hi * .8 - .2, monthLabel(pts[i].id, true), `${num(pts[i].igViews)} views`]);
  } else bars.append(h("div",{class:"empty"},"No numbers yet"));
  return h("div",{class:"card pad reach"},
    h("div",{class:"reach-side"}, h("h3",{},"Overall reach"), stat("Total views", "igViews"), stat("Total interactions", "igInteractions")),
    h("div",{class:"reach-chart"}, h("div",{class:"lbl"},"Views by month"), bars));
}
// a teammate's face; hover or tab to it for their role, email and a message button
function face(t){
  const mail = emailOf(t);
  // keep the card inside the window for faces near the right or left edge
  const fit = ev => { const pop = ev.currentTarget.querySelector(".face-pop"); pop.style.marginLeft = "0px";
    const r = pop.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    pop.style.marginLeft = (r.right > vw - 12 ? vw - 12 - r.right : r.left < 12 ? 12 - r.left : 0) + "px"; };
  return h("div",{class:"face", tabindex:"0", onpointerenter:fit, onfocusin:fit}, avatar(t, "md"), h("span",{}, (t.name || "").split(/\s+/)[0]),
    h("div",{class:"face-pop", role:"tooltip"}, h("div",{class:"row"}, avatar(t, "md"), h("div",{}, h("b",{}, t.name), h("div",{class:"small muted"}, t.role || "Team"))),
      mail ? h("a",{class:"small", href:"mailto:" + mail}, mail) : null,
      t.id !== S.meId ? h("button",{class:"btn sm", type:"button", onclick:() => openChat(dmThread(S.meId, t.id))},"Message") : null));
}
// the media team meeting, at the top of Home only on meeting days
function meetingBar(){
  const d = nextMeeting(); if (!d || d !== today()) return null;
  const c = S.meetCfg, link = safeUrl(c.link), n = daysUntil(d);
  return h("div",{class:"meet-bar"}, h("span",{class:"meet-ic"}, icon("video", 18)),
    h("div",{class:"meet-b"}, h("b",{},"Media team meeting"), h("span",{class:"muted"}, `${n === 0 ? "Today" : n === 1 ? "Tomorrow" : fmt(d)}${c.time ? " · " + c.time : ""} · every ${meetEvery(c)}`)),
    h("button",{class:"btn sm", type:"button", onclick:() => openMeeting(d)},"Notes & Drive"),
    link ? h("a",{class:"btn sm primary", href:link, target:"_blank", rel:"noopener"},"Join Google Meet") : null);
}
// a clear band between Home sections
const section = (title, sub, action, ...body) => h("section",{class:"home-sec"},
  h("div",{class:"home-sec-h"}, h("div",{}, h("h2",{}, title), sub ? h("p",{}, sub) : null), action || null), ...body);
// "FIESTA website" → FIESTA / Website, so every tile reads brand first
function chanTile([key, label, u]){
  const [brand, ...kind] = label.split(" "), fh = /foundhers/i.test(key);
  return h("a",{class:"chan-btn", href:u, target:"_blank", rel:"noopener", style:`--c:var(--${fh ? "foundhers" : "fiesta"})`},
    h("span",{class:"chan-ic"}, icon(/^ig/.test(key) ? "instagram" : /^li/.test(key) ? "linkedin" : "link", 16)),
    h("span",{class:"chan-l"}, h("b",{}, brand), h("span",{}, kind.join(" ").replace(/^./, x => x.toUpperCase()))), h("span",{class:"chan-go", "aria-hidden":"true"},"↗"));
}
function viewHome(){
  const me = S.team.find(t => t.id === S.meId);
  if (!me) return [h("div",{class:"hello"}, h("h1",{},"Welcome!"), h("p",{},"Your account isn't linked to a team card yet. Ask an admin to add your email on the Access page."))];
  const mine = S.tasks.filter(isMyTask), open = mine.filter(t => !t.done).sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
  const doneRecent = mine.filter(t => t.done && (t.doneAt || "") >= ymd(addDays(parse(today()), -30))).length;
  const myPosts = posts().filter(c => ownersFor(c).includes(me.id) && !isDone(c) && c.deadline && daysUntil(c.deadline) <= 7);
  const published = posts().filter(isDone).sort((a, b) => (b.publishDate || "").localeCompare(a.publishDate || "")).slice(0, 3);
  const rows = kpiRows();
  const chans = CHANNELS.map(([key, label, def]) => [key, label, channelUrl(key, def)]).filter(([, , u]) => u);
  return [
    h("div",{class:"hello"}, h("h1",{}, `Hi ${me.name.split(/\s+/)[0]}`),
      h("p",{}, open.length || myPosts.length ? `${open.length} open task${open.length === 1 ? "" : "s"} and ${myPosts.length} post${myPosts.length === 1 ? "" : "s"} due this week.` : "You're all caught up.")),
    meetingBar(),
    section("FIESTA village", "Everyone on the team. Click yourself to dress up, or a teammate to message them.", linkBtn("Dress up my character", openCharacter), village()),
    section("Performance", rows.length ? `Instagram · ${monthLabel(rows[rows.length - 1].id, true)}${rows.length > 1 ? " vs " + monthLabel(rows[rows.length - 2].id) : ""}` : "Instagram · add this month's numbers on Analytics",
      linkBtn("Open analytics", () => setView("analytics")), kpiStrip(rows), reachCard(rows)),
    section("This week", "What goes live Monday to Sunday", h("div",{class:"row tight"}, isAdmin() ? linkBtn("Meeting schedule", openMeetingSchedule) : null, linkBtn("Open calendar", () => setView("calendar"))),
      h("div",{class:"card week-card"}, weekAgenda(posts(), 0))),
    section("My work & team", null, null, h("div",{class:"grid2"},
      card("My work", linkBtn("+ Add my task", () => openTask(null)),
        h("div",{class:"work"}, ring(doneRecent, doneRecent + open.length), h("div",{}, h("div",{class:"big"}, open.length), h("div",{class:"muted small"}, `open · ${doneRecent} done in the last 30 days`))),
        h("div",{class:"list"}, ...(open.length ? open.slice(0, 4).map(t => taskRow(t)) : [h("div",{class:"empty"},"Nothing waiting on you.")])),
        open.length > 4 ? h("div",{class:"more"}, linkBtn(`See all ${open.length}`, () => { S.reqFilter = "mine"; setView("requests"); })) : null),
      h("div",{class:"stack"},
        card("Our channels", null,
          h("div",{class:"chan"}, ...chans.map(chanTile)),
          published.length ? h("div",{class:"list chan-recent"}, h("div",{class:"lbl pad-x"},"Recently published"), ...published.map(c => h("button",{class:"item slim", type:"button", onclick:() => openItem(c.id)},
            h("span",{class:"pf", style:`--c:${BRANDS[c.brand].c}`}, icon(PLATFORMS[c.platform].icon, 14)), h("div",{class:"item-b"}, h("div",{class:"t"}, c.title), h("div",{class:"meta"}, `${c.platform} · ${fmtShort(c.publishDate)}`))))) : null),
        card("Team", linkBtn("View all", () => { S.teamTab = "roles"; setView("team"); }),
          h("div",{class:"faces"}, ...teamSorted().map(face))))))
  ];
}

registerView("home", viewHome);
