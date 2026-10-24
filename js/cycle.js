// How we work: the FIESTA monthly operating cycle and the content system, for onboarding.
// Source: "FIESTA MONTHLY OPERATING CYCLE" and "FIESTA content plan diagrams" (advisor).
import { S, h, registerView, renderMain, ymd, today, nthWeekday } from "./core.js";

// clockwise from FIESTA night
const STAGES = [
  ["T", "FIESTA night", "Close out the event", ["Close check-in, note EventMagic issues for Jon", "Venue close-out and supply inventory", "Thank volunteers and ambassadors", "Save founder info, pitch videos and stage photos"], "Pay photographer and videographer"],
  ["T+1–3", "Days 1–3", "Capture what happened", ["Sync check-ins to Mailchimp, thank-you emails", "Founder and funder follow-up", "Write the internal debrief"], "Curate photos, upload and name videos, pick clips for social"],
  ["T+3", "By Friday", "Open the next cycle", ["Confirm next date, venue, AV", "Create the event in Luma and EventMagic", "Update every calendar with deadlines"], "Add media deadlines to the calendar"],
  ["T+7", "Tuesday after", "Publish the story", ["FIESTA FOCUS goes out with the recap, founders and wins", "Website: recap, founder stories, next date"], "Recap post, founder clips, thank-you posts"],
  ["All month", "Between events", "Run the pipelines", ["Founder pitch pipeline: apply → select → invite → prep", "Funders, sponsors, volunteers and ambassadors", "Founder wins and community intelligence"], "Founder spotlights, interviews and WINs from the calendar"],
  ["T−14", "2 weeks before", "Build the event", ["Confirm founders, funder, sponsor, volunteers", "Confirm food, venue, AV, signage", "Start run-of-show and stage deck"], "Confirm photographer, videographer, social coverage"],
  ["T−7", "1 week before", "Lock everything", ["Finalize pitch order, slides and script", "Share attendee mix with ambassadors"], "Media reminder: join us at FIESTA next week"],
  ["T−3", "Final 72 hours", "Confirm and pack", ["Confirm everyone again, handle cancellations", "QR codes, signage, supplies, food order"], "Brief: shot list, founders to capture, group-photo time"]
];
const PLAN = [
  ["Founder Spotlights", "1 per founder who pitched", "Usually 8–15. All go out before the next FIESTA, so 2–3 a week."],
  ["Founder interview reels", "Usually 7–8 or more", "Spread across the month, between the spotlights."],
  ["Founder WINs", "Once a week", "From real win submissions."],
  ["Promotions", "Before each event", "Poster about 12 days before, reminder 5 days before, final reminder 2 days before."],
  ["Recaps", "After each event", "FIESTA recap the Saturday after; FoundHERs recap the same night."],
  ["Newsletters", "Fixed dates", "FIESTA FOCUS 2nd & 4th Tuesday · FoundHERs HERald 1st Friday."]
];
const PIECES = [["Story reel, 30–60s","Instagram · FIESTA LinkedIn · story page"],["Story carousel, 5–10","Instagram · FIESTA LinkedIn"],["Story page, ~500 words","Website · newsletter feature"],
  ["Pull quote","Newsletter · Cherie LinkedIn · stories"],["3s hook","Next event promo"],["Banked clip","Their win reel, whenever it lands"]];
const CHANNELS = [["FIESTA LinkedIn","Free form and the recap run native. Story reels reposted."],["Cherie LinkedIn","Her newsletter essay as a post, plus one reshare with her take."],
  ["Newsletter","Win reels and carousels become the wins block, plus stills."],["Website","Story pages, the recap gallery, the deep dive as hero video."]];
const BUCKETS = [["Event operations","venue, supplies, food, AV, signage"],["Founder program","applications, approval, pitch workshop, follow-up"],["Funders","sourcing, reverse pitch, introductions"],
  ["Sponsorship","pipeline, sales, fulfillment, renewal"],["Volunteers","recruiting, scheduling, training"],["Ambassadors","welcome, introductions, leadership"],
  ["Registration & data","Luma, EventMagic, attendee data"],["Media","photos, video, asset organization",1],["Social media","calendar, posts, engagement",1],
  ["Newsletter","FIESTA FOCUS, founder wins, recap",1],["Community","introductions, follow-up, partners"],["Leadership","approvals, calendar, metrics, finances"]];

// short two-line labels for the wheel slices, same order as STAGES
const SLICE = [["Close out","the event"],["Capture","what happened"],["Open the","next cycle"],["Publish","the story"],["Run the","pipelines"],["Build","the event"],["Lock","everything"],["Confirm","and pack"]];
// the cycle as a donut of arrow-shaped slices, clockwise from FIESTA night; click a slice to read it
function wheel(){
  const sel = Number.isInteger(S.cycleStage) ? S.cycleStage : 0, n = STAGES.length;
  const R = 48, r = 28, mid = (R + r) / 2, step = 360 / n, tip = 4;
  const pt = (deg, rad) => { const a = (deg - 90) * Math.PI / 180; return `${(50 + rad * Math.cos(a)).toFixed(2)} ${(50 + rad * Math.sin(a)).toFixed(2)}`; };
  const slices = STAGES.map(([k], i) => {
    const a0 = i * step, a1 = a0 + step;
    // pointed end, notched start: each slice tucks into the next one
    const d = `M${pt(a0, R)} A${R} ${R} 0 0 1 ${pt(a1, R)} L${pt(a1 + tip, mid)} L${pt(a1, r)} A${r} ${r} 0 0 0 ${pt(a0, r)} L${pt(a0 + tip, mid)} Z`;
    const am = (a0 + a1) / 2 + tip / 2, [cx, cy] = pt(am, mid).split(" ");
    return `<g class="w-slice${i === sel ? " on" : ""}${k === "T" ? " t0" : ""}" data-i="${i}" role="button" tabindex="0" aria-pressed="${i === sel}" aria-label="${STAGES[i][2]}">
      <path d="${d}"/><text x="${cx}" y="${cy}" text-anchor="middle"><tspan class="w-sk" x="${cx}" dy="-3.2">${k}</tspan><tspan x="${cx}" dy="3.6">${SLICE[i][0]}</tspan><tspan x="${cx}" dy="3.2">${SLICE[i][1]}</tspan></text></g>`;
  }).join("");
  const ring = h("div",{class:"wheel-ring"});
  ring.innerHTML = `<svg viewBox="0 0 100 100">${slices}</svg>`;
  const pick = i => { S.cycleStage = i; renderMain(); setTimeout(() => document.getElementById("hw-wheel")?.scrollIntoView({block:"nearest"}), 0); };
  ring.querySelectorAll(".w-slice").forEach(g => {
    g.addEventListener("click", () => pick(Number(g.dataset.i)));
    g.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); pick(Number(g.dataset.i)); } });
  });
  const [k, when, title, items, media] = STAGES[sel];
  return h("div",{class:"wheel-wrap"},
    h("div",{class:"wheel"}, ring, h("div",{class:"w-center"}, h("b",{},"FIESTA"), h("span",{},"3rd Tuesday"), h("span",{class:"muted small"},"then it starts again"))),
    h("div",{class:"w-detail"},
      h("div",{class:"stage-t"}, h("span",{class:"stage-k"}, k), h("span",{class:"muted small"}, when)),
      h("h3",{}, title),
      h("ul",{class:"checks"}, ...items.map(x => h("li",{}, x))),
      h("div",{class:"stage-media"}, h("span",{class:"lbl"},"Media team"), media),
      h("div",{class:"w-nav"},
        h("button",{class:"btn sm", type:"button", onclick:() => { S.cycleStage = (sel + n - 1) % n; renderMain(); }},"‹ Previous"),
        h("button",{class:"btn sm", type:"button", onclick:() => { S.cycleStage = (sel + 1) % n; renderMain(); }},"Next ›"))));
}
function monthStrip(){
  const now = new Date(), y = now.getFullYear(), m = now.getMonth(), days = new Date(y, m + 1, 0).getDate();
  const mark = {}, put = (d, cls, label) => (mark[ymd(d)] ||= []).push([cls, label]);
  put(nthWeekday(y, m, 1, 2), "fh", "FoundHERs");
  put(nthWeekday(y, m, 3, 2), "fi", "FIESTA");
  put(nthWeekday(y, m, 2, 2), "nl", "Newsletter · FOCUS"); put(nthWeekday(y, m, 4, 2), "nl", "Newsletter · FOCUS");
  put(nthWeekday(y, m, 1, 5), "nl", "Newsletter · HERald");
  const cells = ["S","M","T","W","T","F","S"].map(x => h("div",{class:"ms-dow"}, x));
  for (let i = 0; i < new Date(y, m, 1).getDay(); i++) cells.push(h("div",{class:"ms-blank"}));
  for (let d = 1; d <= days; d++){ const dt = new Date(y, m, d), k = ymd(dt), mk = mark[k] || [];
    cells.push(h("div",{class:"ms-day" + (k === today() ? " today" : "") + (dt.getDay() === 0 || dt.getDay() === 6 ? " wk" : "")},
      h("span",{class:"ms-n"}, d), ...mk.map(([c, l]) => h("span",{class:"ms-tag " + c, title:l}, l)))); }
  return h("div",{class:"ms"}, ...cells);
}
function viewCycle(){
  const label = new Date().toLocaleDateString("en-US",{month:"long", year:"numeric"});
  return [
    h("div",{class:"page-h"}, h("div",{}, h("h2",{},"How we work"), h("p",{class:"sub"},"One FIESTA to the next, and how one night becomes a month of content."))),
    h("section",{class:"card pad", id:"hw-wheel"},
      h("div",{class:"card-h flat"}, h("h3",{},"The monthly cycle"), h("span",{class:"muted small"},"T = FIESTA night. Click a stage.")),
      wheel()),
    h("div",{class:"two-col", id:"hw-plan"},
      h("section",{class:"card pad"}, h("div",{class:"card-h flat"}, h("h3",{},"A month of content"), h("span",{class:"muted small"},"The numbers change with each FIESTA")),
        h("div",{class:"plan-list"}, ...PLAN.map(([t, n, d]) => h("div",{class:"plan-row"}, h("div",{}, h("b",{}, t), h("div",{class:"small muted"}, d)), h("span",{class:"pill"}, n)))),
        h("p",{class:"small muted", style:"margin:12px 0 0"},"“Plan a month” on the Calendar takes these numbers and spaces the posts out for you.")),
      h("section",{class:"card pad"}, h("div",{class:"card-h flat"}, h("h3",{}, `Fixed dates · ${label}`)), monthStrip(),
        h("div",{class:"ms-key"}, h("span",{class:"ms-tag fi"},"FIESTA · 3rd Tue"), h("span",{class:"ms-tag fh"},"FoundHERs · 1st Tue"),
          h("span",{class:"ms-tag nl"},"Newsletter · FIESTA FOCUS · 2nd & 4th Tue"), h("span",{class:"ms-tag nl"},"Newsletter · HERald · 1st Fri")))),
    h("section",{class:"card pad", id:"hw-system"}, h("div",{class:"card-h flat"}, h("h3",{},"One interview, six pieces")),
      h("div",{class:"flow"}, h("div",{class:"flow-src"}, h("b",{},"1 founder interview"), h("span",{},"3–4 min, vertical"), h("span",{},"+ 8 portrait frames")),
        h("div",{class:"flow-out"}, ...PIECES.map(([p, to]) => h("div",{class:"flow-row"}, h("span",{class:"flow-piece"}, p), h("span",{class:"flow-arrow"},"→"), h("span",{class:"flow-to"}, to))))),
      h("p",{class:"small muted", style:"margin:12px 0 0"},"The banked clip compounds: every future win a founder submits already has footage waiting.")),
    h("section",{class:"card pad"}, h("div",{class:"card-h flat"}, h("h3",{},"Instagram makes it, everyone else repackages")),
      h("div",{class:"hub3"},
        h("div",{class:"hub-col"}, h("div",{class:"lbl"},"Made from"), ...["Founder spotlights · 1 per founder","Interview reels","Founder WINs · weekly","Recaps + live stories","Promotions"].map(x => h("div",{class:"hub-pill"}, x))),
        h("div",{class:"hub-mid"}, h("b",{},"Instagram"), h("span",{class:"muted small"},"everything is made here first")),
        h("div",{class:"hub-col"}, h("div",{class:"lbl"},"Repackaged to"), ...CHANNELS.map(([c, d]) => h("div",{class:"hub-card"}, h("b",{}, c), h("span",{class:"muted small"}, d))))),
      h("p",{class:"small muted", style:"margin:12px 0 0"},"Nothing is made twice. How many pieces there are depends on who pitched that month.")),
    h("section",{class:"card pad"}, h("div",{class:"card-h flat"}, h("h3",{},"Who owns what across FIESTA"), h("span",{class:"muted small"},"Media team areas are highlighted")),
      h("div",{class:"buckets"}, ...BUCKETS.map(([b, ex, media]) => h("div",{class:"bucket" + (media ? " media" : "")}, h("b",{}, b), h("span",{class:"small muted"}, ex)))))
  ];
}

registerView("cycle", viewCycle);
