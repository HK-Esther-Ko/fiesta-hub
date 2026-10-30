// FIESTA village (experimental): everyone as a little pixel character on Home, dressed up from their profile.
// To take it out: delete this file, its imports in home.js and team.js, and the "village" block in styles.css.
import { S, db, h, avatar, emailOf, isAdmin, realAdmin, teamSorted, teamById, toast, dbErr, openDrawer, closeDrawer,
  today, daysUntil, fmtShort, nextMeeting, allEvents, posts, ownersFor, isDone, taskOwners, BRANDS } from "./core.js";
import { openItem } from "./calendar.js";
import { openTask } from "./requests.js";
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
// hair styles replace whole rows; bob, long and curly add hair down both sides of the face
const side = face => "oh" + face + "ho";
const FRAME = {7:side("hssssssssssh"), 8:side("sssessssesss"), 9:side("sssessssesss"), 10:side("sccssssssccs"), 11:side("ssssssssssss")};
const HAIR = {
  short:{},
  side:{6:".o" + "hhhhhhhssshh" + "o."},
  buzz:{6:".o" + "ssssssssssss" + "o.", 7:".o" + "ssssssssssss" + "o."},
  bob:{...FRAME, 12:".oooooooooooooo."},
  long:{...FRAME, 12:"oh" + "oooooooooooo" + "ho", 13:"oho" + "tttwkkwttt" + "oho", 14:"ohs" + "ttttkktttt" + "sho", 15:".oo" + "tttttttttt" + "oo."},
  curly:{1:"....oooooooo....", 2:"...ohhhhhhhho...", 3:"..ohhhhhhhhhho..", 4:".ohhhhhhhhhhhho.", 5:"ohhhhhhhhhhhhhho", 6:"ohhhhhhhhhhhhhho", ...FRAME, 12:".oooooooooooooo."},
  bun:{0:"......oooo......", 1:".....ohhhho.....", 2:".....ohhhho....."}
};
// layers painted over the figure ("." leaves the cell alone): something on the head, on the face, in the hand,
// at the neck, and the bottoms
const HEAD = {
  none:{},
  cap:{2:"...oooooooooo...", 3:"..obbbbbbbbbbo..", 4:".obbbbbbbbbbbbo.", 5:".obbbbbbbbbbbbbo"},
  beanie:{1:"......obbo......", 2:"...oooooooooo...", 3:"..obbbbbbbbbbo..", 4:".obbbbbbbbbbbbo.", 5:".oyyyyyyyyyyyyo."},
  bow:{2:"..........b.b...", 3:"..........bbb...", 4:"..........b.b..."},
  flower:{3:"...........f....", 4:"..........fyf...", 5:"...........f...."},
  headband:{5:".obbbbbbbbbbbbo."},
  headphones:{2:"....mmmmmmmm....", 3:"..mm........mm..", 4:".m............m.", 5:".m............m.", 6:"m..............m", 7:"mm............mm", 8:"mm............mm", 9:"mm............mm"}
};
const FACE = {
  none:{},
  glasses:{7:"....ggg..ggg....", 8:"....g.gggg.g....", 9:"....g.g..g.g....", 10:"....ggg..ggg...."},
  sunglasses:{8:"....gggggggg....", 9:"....ggg..ggg...."}
};
const HOLD = {
  none:{},
  camera:{14:".....mmmmmm.....", 15:".....mmLLmm....."},
  coffee:{12:".............vv.", 13:".............uu.", 14:".............uu."}
};
const NECK = { tie:{}, bowtie:{13:"......kkkk......", 14:".......tt......."}, none:{13:".......tt.......", 14:".......tt......."} };
const BOTTOM = { pants:{}, skirt:{17:"..oppppppppppo..", 18:"...oo......oo..."} };
const HEAD_COLOR = {cap:"#ea7136", beanie:"#2a9d8f", bow:"#e1578c", headband:"#e1578c", flower:"#ff7aa8"};
export const LOOK = {
  hair:[["short","Short"],["side","Side part"],["buzz","Buzz"],["bob","Bob"],["long","Long"],["curly","Curly"],["bun","Bun"]],
  hairColor:["#151318","#2b2630","#4a2f2a","#7a4632","#a0522d","#c98e45","#e3c47e","#e8e2d8","#9a9ea8","#c0392b","#e1578c","#8e6bbf","#3f7fd0","#2f8a57"],
  skin:["#fde7d6","#f8d9bd","#f0c39c","#e4b48a","#dca27c","#c68a62","#b97a52","#9c6440","#7a4a30","#5a3523"],
  top:["#ea7136","#e1578c","#d64545","#f2c14e","#2f8a57","#2a9d8f","#8fb8de","#1d5075","#5b4a8a","#8a5a3b","#f2f2f4","#2b2d3a"],
  tie:[["tie","Tie"],["bowtie","Bow tie"],["none","None"]],
  bottom:[["pants","Trousers"],["skirt","Skirt"]],
  bottomColor:["#3a3346","#3e5c8a","#b59a6a","#1f1f26","#6b3a5a"],
  head:[["none","None"],["cap","Cap"],["beanie","Beanie"],["bow","Bow"],["flower","Flower"],["headband","Headband"],["headphones","Headphones"]],
  face:[["none","None"],["glasses","Glasses"],["sunglasses","Sunglasses"]],
  hold:[["none","Nothing"],["camera","Camera"],["coffee","Coffee"]]
};
function hash(s){ let x = 7; for (const ch of s || "?") x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x; }
// the starting point in the dress-up drawer; characters saved before the wardrobe grew kept one "acc" for everything
export function lookOf(t){
  const n = hash(t?.id || t?.name), pick = (arr, k) => arr[(n >> k) % arr.length];
  const auto = {hair:pick(LOOK.hair, 1)[0], hairColor:pick(LOOK.hairColor.slice(1, 6), 4), skin:pick(LOOK.skin, 7), top:pick(LOOK.top, 10), tie:"tie",
    bottom:"pants", bottomColor:LOOK.bottomColor[0], head:"none", face:"none", hold:"none"};
  const p = {...(t?.pixel || {})};
  if (p.acc){ const slot = {glasses:"face", camera:"hold", bow:"head", cap:"head"}[p.acc]; if (slot && !p[slot]) p[slot] = p.acc; }
  delete p.acc;
  return {...auto, ...p};
}
const paintOver = (g, layer) => g.map((row, r) => { const o = layer[r]; return o ? [...row].map((ch, i) => o[i] !== "." ? o[i] : ch).join("") : row; });
function grid(L){
  const g = BASE.slice();
  for (const [r, s] of Object.entries(HAIR[L.hair] || {})) g[r] = s;
  return [NECK[L.tie], BOTTOM[L.bottom], HEAD[L.head], FACE[L.face], HOLD[L.hold]].reduce((rows, layer) => paintOver(rows, layer || {}), g);
}
// people who haven't dressed up yet are a plain grey figure with a "?" face, so nobody's look is guessed for them
const MYSTERY_Q = {5:"......qqqq......", 6:"......q..q......", 7:".........q......", 8:"........qq......", 9:"........q.......", 11:"........q......."};
const MYSTERY = {o:"#8d919b", s:"#d3d6dc", e:"#d3d6dc", c:"#d3d6dc", h:"#b4b8c0", t:"#b4b8c0", w:"#d3d6dc", k:"#b4b8c0", p:"#9a9ea8", q:"#ffffff"};
export const isDressed = t => !!t?.pixel;
export function sprite(t, cls, look){
  const mystery = !look && !isDressed(t);
  const L = look || lookOf(t);
  const tie = L.top === "#1d5075" ? "#ea7136" : "#1d5075";
  const C = mystery ? MYSTERY : {o:"#2a2233", e:"#2a2233", g:"#2a2233", s:L.skin, c:"#f59aa5", h:L.hairColor, t:L.top, w:L.top === "#f2f2f4" ? "#d9dce3" : "#ffffff", k:tie,
    p:L.bottomColor, m:"#2b2d3a", L:"#7fb4ff", b:HEAD_COLOR[L.head] || "#e1578c", y:L.head === "flower" ? "#ffd166" : "#e8e2d8", f:HEAD_COLOR.flower, u:"#ffffff", v:"#7a4632"};
  const rows = mystery ? grid({hair:"short", tie:"tie"}).map((row, r) => MYSTERY_Q[r] ? [...row].map((ch, i) => MYSTERY_Q[r][i] === "q" ? "q" : ch).join("") : row) : grid(L);
  // one rect per horizontal run of the same color keeps the svg small
  let rects = "";
  rows.forEach((row, y) => { for (let x = 0; x < 16;){ const ch = row[x]; let w = 1; while (x + w < 16 && row[x + w] === ch) w++;
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
// what each person has going on: what's past due (requests and posts), their other open requests, and today's posts
function doingsOf(t){
  const reqs = S.tasks.filter(x => !x.done && taskOwners(x).includes(t.id)).sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
  const lateReqs = reqs.filter(x => x.due && daysUntil(x.due) < 0);
  const mine = posts().filter(c => ownersFor(c).includes(t.id));
  const latePosts = mine.filter(c => !isDone(c) && c.publishDate && daysUntil(c.publishDate) < 0).sort((a, b) => a.publishDate.localeCompare(b.publishDate));
  const todayPosts = mine.filter(c => c.publishDate === today());
  return {reqs:reqs.length, todo:reqs.filter(x => !lateReqs.includes(x)), lateReqs, latePosts, late:lateReqs.length + latePosts.length,
    todayPosts, allUp:todayPosts.length > 0 && todayPosts.every(isDone)};
}
// one line in the hover card; press it to open the request or post
const doing = (label, extra, go, late) => h("button",{class:"vil-do" + (late ? " late" : ""), type:"button", onclick:go}, h("span",{}, label), extra ? h("small",{}, extra) : null);
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
    w.late ? h("span",{class:"vil-say late", "aria-hidden":"true"}, `! ${w.late}`) : w.reqs ? h("span",{class:"vil-say", "aria-hidden":"true"}, w.reqs) : null,
    h("span",{class:"vil-bob"}, sprite(t), posting ? h("span",{class:"vil-hold", "aria-hidden":"true"},"📱") : w.allUp ? h("span",{class:"vil-hold", "aria-hidden":"true"},"🎉") : null),
    h("span",{class:"vil-name"}, me ? "You" : (t.name || "").split(/\s+/)[0]),
    h("div",{class:"face-pop", role:"tooltip"},
      h("div",{class:"row"}, avatar(t, "md"), h("div",{}, h("b",{}, t.name), h("div",{class:"small muted"}, t.role || "Team"))),
      isDressed(t) ? null : h("div",{class:"small muted"}, me ? "You haven't dressed up yet. Press Dress up to pick your look." : "Hasn't dressed up their character yet."),
      w.late ? h("div",{class:"vil-sec late"}, `Past due · ${w.late}`) : null,
      ...w.latePosts.slice(0, 4).map(c => doing(c.title, `post · ${-daysUntil(c.publishDate)}d past date`, () => openItem(c.id), true)),
      ...w.lateReqs.slice(0, 4).map(x => doing(x.text, `request · ${-daysUntil(x.due)}d late`, () => openTask(x.id), true)),
      w.todo.length ? h("div",{class:"vil-sec"}, `To do · ${w.todo.length}`) : null,
      ...w.todo.slice(0, 3).map(x => doing(x.text, x.due ? `due ${daysUntil(x.due) === 0 ? "today" : fmtShort(x.due)}` : null, () => openTask(x.id))),
      w.todo.length > 3 ? h("div",{class:"small muted"}, `+ ${w.todo.length - 3} more on Requests`) : null,
      !w.late && !w.reqs && !w.todayPosts.length ? h("div",{class:"small muted"},"Nothing waiting. All clear!") : null,
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
        swatch ? null : (["hair","head","face","hold","tie","bottom"].includes(key) ? [sprite(t, "sm", {...L, [key]:v}), o[1]] : o[1]));
      return b; });
    return h("div",{class:"dress-g"}, h("span",{class:"lbl"}, label), h("div",{class:"dress-opts"}, ...btns));
  };
  paint();
  const msg = h("div",{class:"cmp-status"});
  openDrawer("My FIESTA character", [
    h("p",{class:"muted", style:"margin:0"},"This is you in the FIESTA village on Home."),
    preview,
    group("Skin", "skin", LOOK.skin, true), group("Hair", "hair", LOOK.hair), group("Hair color", "hairColor", LOOK.hairColor, true),
    group("Top", "top", LOOK.top, true), group("Neck", "tie", LOOK.tie), group("Bottoms", "bottom", LOOK.bottom), group("Bottoms color", "bottomColor", LOOK.bottomColor, true),
    group("On the head", "head", LOOK.head), group("On the face", "face", LOOK.face), group("In hand", "hold", LOOK.hold),
    h("div",{class:"d-actions"}, h("span",{}), h("button",{class:"btn primary", type:"button", onclick:async () => {
      if (realAdmin() && S.preview){ closeDrawer(); toast("Preview: nothing was saved."); return; }
      try{ await db.collection("team").doc(t.id).update({pixel:{...L}}); closeDrawer(); toast("Looking good!"); }
      catch(e){ msg.textContent = e?.code === "permission-denied" && !isAdmin() ? "Couldn't save yet: an admin needs to publish the updated database rules." : dbErr(e); }
    }},"Save")), msg
  ]);
}
