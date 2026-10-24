// Analytics: monthly KPIs per platform (Instagram first). Numbers are entered by hand once a month.
import { S, db, h, isAdmin, registerView, renderMain, pad, toast, dbErr, openDrawer, closeDrawer, deleteButton, field, input, textarea } from "./core.js";

export const METRICS = [
  ["igNewFollowers","New followers","Insights → Followers → follows minus unfollows for the month"],
  ["igShares","Shares","Insights → Interactions → Shares"],
  ["igSaves","Saves","Insights → Interactions → Saves"],
  ["igProfileVisits","Profile visits","Insights → Profile activity → Profile visits"],
  ["igLinkClicks","Bio link clicks","Insights → Profile activity → External link taps"],
  ["igViews","Total views","Insights → Views"],
  ["igInteractions","Total interactions","Insights → Interactions"]
];
export const monthLabel = (ym, long) => new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1).toLocaleDateString("en-US", long ? {month:"long", year:"numeric"} : {month:"short"});
export const num = v => v == null ? "—" : Math.round(v).toLocaleString("en-US");
export const signed = v => v == null ? "—" : `${v > 0 ? "+" : ""}${Math.round(v).toLocaleString("en-US")}`;
export function kpiRows(){
  return (S.kpis || []).map(r => {
    const x = {...r};
    if (x.igNewFollowers == null && x.igGrowth != null) x.igNewFollowers = x.igGrowth;
    if (x.igLinkClicks != null && x.igProfileVisits) x.igClickRate = +((x.igLinkClicks / x.igProfileVisits) * 100).toFixed(1);
    return x;
  }).sort((a, b) => a.id.localeCompare(b.id));
}
export function change(cur, prev){
  if (cur == null || prev == null || !prev) return null;
  const p = (cur - prev) / Math.abs(prev) * 100; return {up:p >= 0, text:`${p >= 0 ? "+" : ""}${p.toFixed(1)}%`};
}
const deltaEl = (cur, prev, label) => { const d = change(cur, prev); return d ? h("div",{class:"kpi-d " + (d.up ? "up" : "down")}, `${d.up ? "▲" : "▼"} ${d.text} vs ${label}`) : h("div",{class:"kpi-d muted"}, label ? `No ${label} number to compare` : "Pick a month to compare"); };

// single-series line, 2px stroke, 8px markers, crosshair + tooltip
export function lineChart(rows, key, size){
  const pts = rows.filter(r => typeof r[key] === "number");
  if (pts.length < 2) return h("div",{class:"empty"},"Needs two months of numbers.");
  const W = size?.w || 680, H = size?.h || 220, L = 44, R = 14, T = 14, B = 28;
  const vals = pts.map(p => p[key]); let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi){ lo -= 1; hi += 1; }
  const pv = (hi - lo) * 0.15; lo = lo < 0 ? lo - pv : Math.max(0, lo - pv); hi += pv;
  const x = i => L + (W - L - R) * (i / (pts.length - 1)), y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const ticks = [0, 1, 2, 3].map(i => lo + (hi - lo) * i / 3);
  const ax = v => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K` : String(Math.round(v));
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const wrap = h("div",{class:"lc"});
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Monthly trend">
    ${ticks.map(t => `<line x1="${L}" x2="${W-R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" class="lc-grid"/><text x="${L-8}" y="${(y(t)+4).toFixed(1)}" text-anchor="end" class="lc-axis">${ax(t)}</text>`).join("")}
    ${pts.map((p, i) => `<text x="${x(i).toFixed(1)}" y="${H-8}" text-anchor="middle" class="lc-axis">${monthLabel(p.id)}</text>`).join("")}
    <path d="${path} L${x(pts.length-1).toFixed(1)},${H-B} L${x(0).toFixed(1)},${H-B} Z" class="lc-area"/><path d="${path}" class="lc-line"/>
    ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p[key]).toFixed(1)}" r="4" class="lc-dot${i === pts.length-1 ? " end" : ""}"/>`).join("")}
    <line class="lc-cross" y1="${T}" y2="${H-B}" x1="0" x2="0" visibility="hidden"/>
    <rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" fill="transparent" class="lc-hit"/></svg>`;
  const tip = h("div",{class:"lc-tip", hidden:true}); wrap.append(tip);
  const svg = wrap.querySelector("svg"), cross = wrap.querySelector(".lc-cross"), hit = wrap.querySelector(".lc-hit");
  hit.addEventListener("pointermove", ev => {
    const r = svg.getBoundingClientRect(), sx = (ev.clientX - r.left) * W / r.width;
    const i = Math.max(0, Math.min(pts.length - 1, Math.round((sx - L) / ((W - L - R) / (pts.length - 1)))));
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
    tip.replaceChildren(h("div",{class:"small muted"}, monthLabel(pts[i].id, true)), h("b",{}, num(pts[i][key])));
    tip.hidden = false; tip.style.left = Math.min(Math.max(x(i) * r.width / W, 60), r.width - 60) + "px"; tip.style.top = (y(pts[i][key]) * r.height / H) + "px";
  });
  hit.addEventListener("pointerleave", () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); });
  return wrap;
}

function viewAnalytics(){
  const rows = kpiRows();
  const cur = rows.find(r => r.id === S.kpiMonth) || rows[rows.length - 1];
  const idx = rows.indexOf(cur);
  const cmp = S.kpiCompare === "none" ? null : (rows.find(r => r.id === S.kpiCompare && r.id !== cur?.id) || rows[idx - 1]);
  const vs = cmp ? monthLabel(cmp.id) : "";
  const monthSel = (val, onPick, exclude, allowNone) => { const s = h("select",{"aria-label":"Month", onchange:ev => onPick(ev.target.value)},
    ...(allowNone ? [h("option",{value:""},"No comparison")] : []), ...rows.slice().reverse().filter(r => r.id !== exclude).map(r => h("option",{value:r.id}, monthLabel(r.id, true)))); s.value = val || ""; return s; };
  const kpi = (n, title, why, key, unit, sub) => h("section",{class:"card kpi"},
    h("div",{class:"kpi-h"}, h("span",{class:"kpi-n"}, n), h("h3",{}, title)), h("p",{class:"kpi-why"}, why),
    h("div",{class:"kpi-big"}, key === "igNewFollowers" ? signed(cur?.[key]) : num(cur?.[key]), h("span",{class:"kpi-unit"}, unit)),
    sub ? h("div",{class:"kpi-sub"}, sub) : null,
    cmp ? h("div",{class:"kpi-vs"}, `${vs}: ${key === "igNewFollowers" ? signed(cmp[key]) : num(cmp[key])}`) : null,
    deltaEl(cur?.[key], cmp?.[key], vs));
  const overall = (title, key) => h("section",{class:"card kpi slim"}, h("h3",{}, title),
    h("div",{class:"kpi-big"}, num(cur?.[key])), cmp ? h("div",{class:"kpi-vs"}, `${vs}: ${num(cmp[key])}`) : null, deltaEl(cur?.[key], cmp?.[key], vs));
  return [
    h("div",{class:"page-h"}, h("div",{}, h("h2",{},"Analytics"), h("p",{class:"sub"},"Growth, shares and conversion are the baseline for judging every content experiment.")),
      isAdmin() ? h("button",{class:"btn primary", type:"button", onclick:() => openKpi(null)},"+ Add a month") : null),
    h("div",{class:"tabs"}, ...[["instagram","Instagram"],["linkedin","LinkedIn"],["newsletter","Newsletter"]].map(([k, l]) =>
      h("button",{class:"tab", type:"button", "aria-selected":String(k === "instagram"), disabled:k !== "instagram"}, l, k !== "instagram" ? h("span",{class:"soon"},"Soon") : null))),
    !rows.length ? h("div",{class:"card empty-big"}, h("h3",{},"No months yet"), h("p",{class:"muted"},"Add last month's numbers from Instagram Insights to start the dashboard."),
      isAdmin() ? h("button",{class:"btn primary", type:"button", onclick:() => openKpi(null)},"+ Add a month") : null) : null,
    cur ? h("div",{class:"compare-bar"}, h("span",{class:"lbl"},"Month"), monthSel(cur.id, v => { S.kpiMonth = v; S.kpiCompare = ""; renderMain(); }),
      h("span",{class:"lbl"},"compared with"), monthSel(cmp?.id, v => { S.kpiCompare = v || "none"; renderMain(); }, cur.id, true)) : null,
    cur ? h("div",{class:"sec-h"}, h("h3",{},"Monthly KPIs")) : null,
    cur ? h("div",{class:"kpis"},
      kpi("1","Growth","Month-over-month follower growth.","igNewFollowers"," new followers"),
      kpi("2","Shares","How often content is shared. Shares and saves drive organic reach.","igShares"," shares", cur.igSaves != null ? `${num(cur.igSaves)} saves` : null),
      kpi("3","Conversion","Bio link clicks that move people to the FIESTA website.","igLinkClicks"," link clicks", cur.igClickRate != null ? `${cur.igClickRate}% of ${num(cur.igProfileVisits)} profile visits` : null)) : null,
    cur ? h("div",{class:"sec-h"}, h("h3",{},"Overall")) : null,
    cur ? h("div",{class:"kpis two"}, overall("Total views","igViews"), overall("Total interactions","igInteractions")) : null,
    rows.length >= 2 ? h("div",{class:"sec-h"}, h("h3",{},"Trends")) : null,
    rows.length >= 2 ? h("div",{class:"kpis"}, ...[["igNewFollowers","Growth"],["igShares","Shares"],["igLinkClicks","Conversion"]].map(([k, t]) =>
      h("section",{class:"card"}, h("div",{class:"card-h"}, h("h3",{}, t)), h("div",{class:"pad-x"}, lineChart(rows, k, {w:340, h:180}))))) : null,
    cur ? h("div",{class:"card"}, h("div",{class:"card-h"}, h("h3",{}, `Experiments · ${monthLabel(cur.id, true)}`), isAdmin() ? h("button",{class:"link", type:"button", onclick:() => openKpi(cur.id)},"Edit") : null),
      h("div",{class:"exp"}, h("div",{}, h("div",{class:"lbl"},"What we tested"), h("p",{}, cur.experiment || "Nothing logged.")),
        h("div",{}, h("div",{class:"lbl"},"What we learned / try next"), h("p",{}, cur.notes || "—")))) : null,
    rows.length ? h("details",{class:"card fold"}, h("summary",{}, "All months"),
      h("div",{class:"tbl-scroll"}, h("table",{class:"tbl"},
        h("thead",{}, h("tr",{}, h("th",{},"Month"), ...METRICS.map(([, l]) => h("th",{}, l)), h("th",{},"Click rate"), isAdmin() ? h("th",{}) : null)),
        h("tbody",{}, ...rows.slice().reverse().map(r => h("tr",{}, h("td",{}, h("b",{}, monthLabel(r.id, true))),
          ...METRICS.map(([k]) => h("td",{class:"mono"}, k === "igNewFollowers" ? signed(r[k]) : num(r[k]))), h("td",{class:"mono"}, r.igClickRate == null ? "—" : r.igClickRate + "%"),
          isAdmin() ? h("td",{}, h("button",{class:"link", type:"button", onclick:() => openKpi(r.id)},"Edit")) : null)))))) : null
  ];
}
function openKpi(id){
  const r = id ? (S.kpis || []).find(x => x.id === id) || {} : {};
  const now = new Date(), pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = input("kp-month", id || `${pm.getFullYear()}-${pad(pm.getMonth() + 1)}`, {type:"month"}); month.disabled = !!id;
  const inputs = METRICS.map(([k, l, hint]) => [k, l, hint, input("kp-" + k, r[k] == null ? "" : String(r[k]), {inputmode:"numeric", placeholder:"e.g. 120"})]);
  const exp = textarea("kp-exp", r.experiment, 2, "New formats or ideas tried this month");
  const notes = textarea("kp-notes", r.notes, 3, "What the numbers say, and what to try next");
  const msg = h("div",{class:"cmp-status"});
  openDrawer(id ? `Instagram · ${monthLabel(id, true)}` : "Add a month", [
    h("p",{class:"small muted", style:"margin:0"},"Set the Insights date range to the whole month, then copy each total."),
    h("div",{class:"fields"}, field("Month", month, true),
      ...inputs.map(([k, l, hint, i]) => h("div",{class:"field"}, h("label",{for:i.id}, l), i, h("span",{class:"hint"}, hint))),
      field("What we tested", exp, true), field("What we learned / try next", notes, true)),
    h("div",{class:"d-actions"}, id ? deleteButton(() => db.collection("kpis").doc(id).delete()) : h("span",{}),
      h("button",{class:"btn primary", type:"button", onclick:async () => {
        if (!/^\d{4}-\d{2}$/.test(month.value)){ msg.textContent = "Pick a month."; return; }
        const data = {month:month.value, experiment:exp.value.trim(), notes:notes.value.trim(), updatedAt:new Date().toISOString()};
        for (const [k, l, , i] of inputs){ const v = i.value.replace(/[,\s]/g, ""); if (v === "") continue; if (isNaN(+v)){ msg.textContent = `${l} needs a number.`; return; } data[k] = +v; }
        try{ await db.collection("kpis").doc(month.value).set(data); S.kpiMonth = month.value; closeDrawer(); toast("Saved."); }catch(e){ msg.textContent = dbErr(e); }
      }}, "Save"))
  ]);
}

registerView("analytics", viewAnalytics);
