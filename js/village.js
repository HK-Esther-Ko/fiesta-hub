// FIESTA village (experimental): everyone as a little pixel character on Home, dressed up from their profile.
// To take it out: delete this file, its imports in home.js and team.js, and the "village" block in styles.css.
import { S, db, h, avatar, emailOf, isAdmin, realAdmin, teamSorted, teamById, toast, dbErr, openDrawer, closeDrawer,
  today, daysUntil, nextMeeting, allEvents, posts, ownersFor, isDone, taskOwners, BRANDS } from "./core.js";
import { openChat, dmThread } from "./chat.js";
import { openMeeting } from "./meeting.js";

/* ---------- sprite: 16 x 19 cells ---------- */
// o outline · e eye · s skin · c cheek · h hair · t top · w collar · k tie · p trousers
const BASE = [
  "................",
  "................",
  "................",
  "...oooooooooo...",
  "..ohhhhhhhhhho..",
  ".ohhhhhhhhhhhho.",
  ".ohhhhhhhhhhhho.",
  ".ohssssssssssho.",
  ".osssessssessso.",
  ".osssessssessso.",
  ".osccssssssccso.",
  ".osssssssssssso.",
  "..oooooooooooo..",
  "..otttwkkwttto..",
  ".osttttkkttttso.",
  "..otttttttttto..",
  "..oppppppppppo..",
  "..oppppooppppo..",
  "..ooooo..ooooo.."
];
// hair styles replace whole rows; bob and long add hair down both sides of the face
const side = face => "oh" + face + "ho";
const FRAME = {7:side("hssssssssssh"), 8:side("sssessssesss"), 9:side("sssessssesss"), 10:side("sccssssssccs"), 11:side("ssssssssssss")};
const HAIR = {
  short:{},
  side:{6:".o" + "hhhhhhhssshh" + "o."},
  bob:{...FRAME, 12:".oooooooooooooo."},
  long:{...FRAME, 12:"oh" + "oooooooooooo" + "ho", 13:"oho" + "tttwkkwttt" + "oho", 14:"ohs" + "ttttkktttt" + "sho", 15:".oo" + "tttttttttt" + "oo."},
  bun:{0:"......oooo......", 1:".....ohhhho.....", 2:".....ohhhho....."}
};
// accessories paint over the sprite ("." leaves the cell alone)
const ACC = {
  none:{},
  glasses:{7:"....ggg..ggg....", 8:"....g.gggg.g....", 9:"....g.g..g.g....", 10:"....ggg..ggg...."},
  camera:{14:".....mmmmmm.....", 15:".....mmLLmm....."},
  bow:{2:"..........b.b...", 3:"..........bbb...", 4:"..........b.b..."},
  cap:{2:"...oooooooooo...", 3:"..obbbbbbbbbbo..", 4:".obbbbbbbbbbbbo.", 5:".obbbbbbbbbbbbbo"}
};
export const LOOK = {
  hair:[["short","Short"],["side","Side part"],["bob","Bob"],["long","Long"],["bun","Bun"]],
  hairColor:["#2b2630","#4a2f2a","#7a4632","#a0522d","#c98e45","#3b3a6b","#e1578c"],
  skin:["#f8d9bd","#f0c39c","#dca27c","#b97a52","#86553a"],
  top:["#ea7136","#e1578c","#1d5075","#2f8a57","#5b4a8a","#8d8f99","#2b2d3a"],
  tie:[["tie","Tie"],["none","No tie"]],
  acc:[["none","None"],["glasses","Glasses"],["camera","Camera"],["bow","Bow"],["cap","Cap"]]
};
function hash(s){ let x = 7; for (const ch of s || "?") x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x; }
// people who haven't picked yet still get a steady, unique-ish look
export function lookOf(t){
  const n = hash(t?.id || t?.name), pick = (arr, k) => arr[(n >> k) % arr.length];
  const auto = {hair:pick(LOOK.hair, 1)[0], hairColor:pick(LOOK.hairColor.slice(0, 5), 4), skin:pick(LOOK.skin.slice(0, 3), 7), top:pick(LOOK.top, 10), tie:"tie", acc:"none"};
  return {...auto, ...(t?.pixel || {})};
}
function grid(L){
  const g = BASE.slice();
  for (const [r, s] of Object.entries(HAIR[L.hair] || {})) g[r] = s;
  return g.map((row, r) => { const o = (ACC[L.acc] || {})[r]; return o ? [...row].map((ch, i) => o[i] !== "." ? o[i] : ch).join("") : row; });
}
export function sprite(t, cls, look){
  const L = look || lookOf(t);
  const tie = L.top === "#1d5075" ? "#ea7136" : "#1d5075";
  const C = {o:"#2a2233", e:"#2a2233", g:"#2a2233", s:L.skin, c:"#f59aa5", h:L.hairColor, t:L.top, w:"#ffffff", k:L.tie === "none" ? L.top : tie,
    p:"#3a3346", m:"#2b2d3a", L:"#7fb4ff", b:L.acc === "cap" ? "#ea7136" : "#e1578c"};
  // one rect per horizontal run of the same color keeps the svg small
  let rects = "";
  grid(L).forEach((row, y) => { for (let x = 0; x < 16;){ const ch = row[x]; let w = 1; while (x + w < 16 && row[x + w] === ch) w++;
    if (C[ch]) rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${C[ch]}"/>`; x += w; } });
  const el = h("span",{class:"px" + (cls ? " " + cls : ""), "aria-hidden":"true"});
  el.innerHTML = `<svg viewBox="0 0 16 19" shape-rendering="crispEdges">${rects}</svg>`;
  return el;
}

/* ---------- the village on Home ---------- */
// event days: a string of little flags along the top edge of the card, and two balloons
const GARLAND = `<svg class="vil-garland" viewBox="0 0 320 12" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true"><rect class="v-string" x="0" y="1" width="320" height="1"/>` +
  [...Array(27)].map((_, i) => `<rect class="v-pen p${i % 3}" x="${2 + i * 12}" y="2" width="6" height="5"/><rect class="v-pen p${i % 3}" x="${3.5 + i * 12}" y="7" width="3" height="3"/>`).join("") + `</svg>`;
const SCENE = `<svg class="vil-bg" viewBox="0 0 320 90" preserveAspectRatio="xMidYMax slice" shape-rendering="crispEdges" aria-hidden="true">
  <rect class="v-sun" x="276" y="10" width="12" height="12"/>
  <g class="v-cloud"><rect x="34" y="14" width="26" height="6"/><rect x="40" y="10" width="12" height="4"/></g>
  <g class="v-cloud"><rect x="176" y="22" width="20" height="5"/><rect x="181" y="18" width="9" height="4"/></g>
  <g class="v-hall" transform="translate(18 44)"><title>Media team meeting</title><rect class="v-roof" x="0" y="0" width="34" height="6"/><rect class="v-roof" x="4" y="-5" width="26" height="5"/><rect class="v-wall" x="3" y="6" width="28" height="20"/><rect class="v-door" x="14" y="14" width="7" height="12"/><rect class="v-win" x="6" y="10" width="5" height="5"/><rect class="v-win" x="23" y="10" width="5" height="5"/></g>
  <g transform="translate(232 38)"><rect class="v-roof2" x="0" y="0" width="40" height="7"/><rect class="v-roof2" x="5" y="-6" width="30" height="6"/><rect class="v-wall" x="3" y="7" width="34" height="25"/><rect class="v-door" x="16" y="18" width="8" height="14"/><rect class="v-win" x="7" y="12" width="6" height="6"/><rect class="v-win" x="27" y="12" width="6" height="6"/></g>
  <g transform="translate(70 46)"><rect class="v-leaf" x="0" y="0" width="14" height="14"/><rect class="v-leaf" x="3" y="-4" width="8" height="4"/><rect class="v-trunk" x="5" y="14" width="4" height="10"/></g>
  <g transform="translate(212 52)"><rect class="v-leaf" x="0" y="0" width="10" height="10"/><rect class="v-trunk" x="3" y="10" width="4" height="8"/></g>
  <g transform="translate(120 36)"><rect class="v-pole" x="0" y="0" width="2" height="34"/><rect class="v-flag" x="2" y="1" width="18" height="9"/></g>
  <rect class="v-grass" x="0" y="70" width="320" height="20"/><rect class="v-path" x="0" y="74" width="320" height="6"/>
</svg>`;
export function village(){
  const people = teamSorted();
  if (!people.length) return null;
  const d = today(), meetDay = nextMeeting() === d, events = allEvents().filter(e => e.date === d);
  const wrap = h("div",{class:"card vil" + (meetDay ? " meet" : "") + (events.length ? " party" : ""),
    style:events.length ? `--flag:${(BRANDS[events[0].brand] || {}).c || "var(--accent)"}` : null});
  wrap.innerHTML = SCENE + (events.length ? GARLAND + `<span class="vil-balloon b1" aria-hidden="true">🎈</span><span class="vil-balloon b2" aria-hidden="true">🎈</span>` : "");
  const hall = wrap.querySelector(".v-hall");
  hall.addEventListener("click", () => openMeeting());
  // today's news: the meeting and any event, as chips in the sky
  const news = [
    meetDay ? h("button",{class:"vil-chip meet", type:"button", onclick:() => openMeeting(d)}, "📅 Media team meeting today" + (S.meetCfg?.time ? " · " + S.meetCfg.time : "")) : null,
    ...events.map(e => h("span",{class:"vil-chip", style:`--c:${(BRANDS[e.brand] || {}).c || "var(--accent)"}`}, `🎉 ${e.name} today`))
  ].filter(Boolean);
  wrap.append(news.length ? h("div",{class:"vil-news"}, ...news) : "", h("div",{class:"vil-row"}, ...people.map(villager)));
  return wrap;
}
// what each person has going on: open requests (any late?) and posts going up today
function doingsOf(t){
  const reqs = S.tasks.filter(x => !x.done && taskOwners(x).includes(t.id));
  const late = reqs.filter(x => x.due && daysUntil(x.due) < 0).length;
  const mine = posts().filter(c => c.publishDate === today() && ownersFor(c).includes(t.id));
  return {reqs:reqs.length, late, todayPosts:mine, allUp:mine.length > 0 && mine.every(isDone)};
}
// keep the hover card inside the window for people near the left or right edge
function fit(ev){
  const pop = ev.currentTarget.querySelector(".face-pop"); pop.style.marginLeft = "0px";
  const r = pop.getBoundingClientRect(), vw = document.documentElement.clientWidth;
  pop.style.marginLeft = (r.right > vw - 12 ? vw - 12 - r.right : r.left < 12 ? 12 - r.left : 0) + "px";
}
// one person: hover or tab to them for their role, email and a message button
function villager(t, i){
  const me = t.id === S.meId, mail = emailOf(t), w = doingsOf(t);
  const posting = w.todayPosts.length && !w.allUp;
  return h("div",{class:"vil-p" + (me ? " me" : "") + (w.allUp ? " cheer" : ""), tabindex:"0", style:`--i:${i}`, onpointerenter:fit, onfocusin:fit},
    w.late ? h("span",{class:"vil-say late", "aria-hidden":"true"},"!") : w.reqs ? h("span",{class:"vil-say", "aria-hidden":"true"}, w.reqs) : null,
    h("span",{class:"vil-bob"}, sprite(t), posting ? h("span",{class:"vil-hold", "aria-hidden":"true"},"📱") : w.allUp ? h("span",{class:"vil-hold", "aria-hidden":"true"},"🎉") : null),
    h("span",{class:"vil-name"}, me ? "You" : (t.name || "").split(/\s+/)[0]),
    h("div",{class:"face-pop", role:"tooltip"},
      h("div",{class:"row"}, avatar(t, "md"), h("div",{}, h("b",{}, t.name), h("div",{class:"small muted"}, t.role || "Team"))),
      w.reqs ? h("div",{class:"small" + (w.late ? " vil-late" : "")}, `${w.reqs} open request${w.reqs === 1 ? "" : "s"}${w.late ? ` · ${w.late} past due` : ""}`) : null,
      w.todayPosts.length ? h("div",{class:"small"}, (w.allUp ? "Posted today: " : "Posting today: ") + w.todayPosts.map(c => c.title).join(", ")) : null,
      mail ? h("a",{class:"small", href:"mailto:" + mail}, mail) : null,
      me ? h("button",{class:"btn sm", type:"button", onclick:openCharacter},"Dress up")
        : S.meId ? h("button",{class:"btn sm", type:"button", onclick:() => openChat(dmThread(S.meId, t.id))},"Message") : null));
}

/* ---------- dress-up ---------- */
export function openCharacter(){
  const t = teamById(S.meId);
  if (!t){ toast("Your account isn't linked to a team card yet. Ask an admin."); return; }
  const L = lookOf(t), preview = h("div",{class:"dress-prev"});
  const paint = () => preview.replaceChildren(sprite(t, "xl", L));
  const group = (label, key, opts, swatch) => {
    const btns = opts.map(o => { const v = Array.isArray(o) ? o[0] : o;
      const b = h("button",{type:"button", class:swatch ? "sw" : "sw-opt", "aria-pressed":String(L[key] === v), "aria-label":Array.isArray(o) ? o[1] : v, title:Array.isArray(o) ? o[1] : null,
        style:swatch ? `--c:${v}` : null, onclick:() => { L[key] = v; btns.forEach(x => x.setAttribute("aria-pressed", String(x === b))); paint(); }},
        swatch ? null : (key === "hair" || key === "acc" ? [sprite(t, "sm", {...L, [key]:v}), o[1]] : o[1]));
      return b; });
    return h("div",{class:"dress-g"}, h("span",{class:"lbl"}, label), h("div",{class:"dress-opts"}, ...btns));
  };
  paint();
  const msg = h("div",{class:"cmp-status"});
  openDrawer("My FIESTA character", [
    h("p",{class:"muted", style:"margin:0"},"This is you in the FIESTA village on Home."),
    preview,
    group("Hair", "hair", LOOK.hair), group("Hair color", "hairColor", LOOK.hairColor, true), group("Skin", "skin", LOOK.skin, true),
    group("Outfit", "top", LOOK.top, true), group("Tie", "tie", LOOK.tie), group("Extra", "acc", LOOK.acc),
    h("div",{class:"d-actions"}, h("span",{}), h("button",{class:"btn primary", type:"button", onclick:async () => {
      if (realAdmin() && S.preview){ closeDrawer(); toast("Preview: nothing was saved."); return; }
      try{ await db.collection("team").doc(t.id).update({pixel:{...L}}); closeDrawer(); toast("Looking good!"); }
      catch(e){ msg.textContent = e?.code === "permission-denied" && !isAdmin() ? "Couldn't save yet: an admin needs to publish the updated database rules." : dbErr(e); }
    }},"Save")), msg
  ]);
}
