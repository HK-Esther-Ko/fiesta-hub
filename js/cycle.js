// How we work: the FIESTA monthly operating cycle and the content system, for onboarding.
// Source: "FIESTA MONTHLY OPERATING CYCLE" and "FIESTA content plan diagrams" (advisor).
import { S, h, registerView, ymd, pad, today, nthWeekday, addDays, fmtShort } from "./core.js";

const STAGES = [
  ["T", "FIESTA night", "Close out the event", ["Close check-in, note EventMagic issues for Jon", "Venue close-out and supply inventory", "Thank volunteers and ambassadors", "Save founder info, pitch videos and stage photos"], "Pay photographer and videographer"],
  ["T+1–3", "Days 1–3", "Capture what happened", ["Sync check-ins to Mailchimp, thank-you emails", "Founder and funder follow-up", "Write the internal debrief"], "Curate photos, upload and name videos, pick clips for social"],
  ["T+3", "By Friday", "Open the next cycle", ["Confirm next date, venue, AV", "Create the event in Luma and EventMagic", "Update every calendar with deadlines"], "Add media deadlines to the calendar"],
  ["T+7", "Tuesday after", "Publish the story", ["FIESTA FOCUS goes out with the recap, founders and wins", "Website: recap, founder stories, next date"], "Recap post, founder clips, thank-you posts"],
  ["All month", "Between events", "Run the pipelines", ["Founder pitch pipeline: apply → select → invite → prep", "Funders, sponsors, volunteers and ambassadors", "Founder wins and community intelligence"], "5 Instagram posts a week from the content calendar"],
  ["T−14", "2 weeks before", "Build the event", ["Confirm founders, funder, sponsor, volunteers", "Confirm food, venue, AV, signage", "Start run-of-show and stage deck"], "Confirm photographer, videographer, social coverage"],
  ["T−7", "1 week before", "Lock everything", ["Finalize pitch order, slides and script", "Share attendee mix with ambassadors"], "Media reminder: join us at FIESTA next week"],
  ["T−3", "Final 72 hours", "Confirm and pack", ["Confirm everyone again, handle cancellations", "QR codes, signage, supplies, food order"], "Brief: shot list, founders to capture, group-photo time"]
];
const WEEK = [["Mon","WIN","carousel"],["Tue","STORY","reel"],["Wed","FREE FORM","reel or carousel"],["Thu","STORY","carousel"],["Fri","WIN","reel"]];
const PIECES = [["Story reel, 30–60s","Instagram · FIESTA LinkedIn · story page"],["Story carousel, 5–10","Instagram · FIESTA LinkedIn"],["Story page, ~500 words","Website · newsletter feature"],
  ["Pull quote","Newsletter · Cherie LinkedIn · stories"],["3s hook","Next event promo"],["Banked clip","Their win reel, whenever it lands"]];
const CHANNELS = [["FIESTA LinkedIn","Free form and the recap run native. Story reels reposted."],["Cherie LinkedIn","Her newsletter essay as a post, plus one reshare with her take."],
  ["Newsletter","Win reels and carousels become the wins block. 5 stills."],["Website","Story pages, the recap gallery, the deep dive as hero video."]];
const BUCKETS = [["Event operations","venue, supplies, food, AV, signage"],["Founder program","applications, approval, pitch workshop, follow-up"],["Funders","sourcing, reverse pitch, introductions"],
  ["Sponsorship","pipeline, sales, fulfillment, renewal"],["Volunteers","recruiting, scheduling, training"],["Ambassadors","welcome, introductions, leadership"],
  ["Registration & data","Luma, EventMagic, attendee data"],["Media","photos, video, asset organization",1],["Social media","calendar, posts, engagement",1],
  ["Newsletter","FIESTA FOCUS, founder wins, recap",1],["Community","introductions, follow-up, partners"],["Leadership","approvals, calendar, metrics, finances"]];

function monthStrip(){
  const now = new Date(), y = now.getFullYear(), m = now.getMonth(), days = new Date(y, m + 1, 0).getDate();
  const mark = {};
  const put = (d, cls, label) => (mark[ymd(d)] ||= []).push([cls, label]);
  put(nthWeekday(y, m, 1, 2), "fh", "FoundHERs");
  put(nthWeekday(y, m, 3, 2), "fi", "FIESTA");
  put(nthWeekday(y, m, 2, 2), "nl", "FOCUS"); put(nthWeekday(y, m, 4, 2), "nl", "FOCUS");
  put(nthWeekday(y, m, 1, 5), "nl", "HERald");
  const cells = ["S","M","T","W","T","F","S"].map(x => h("div",{class:"ms-dow"}, x));
  for (let i = 0; i < new Date(y, m, 1).getDay(); i++) cells.push(h("div",{class:"ms-blank"}));
  for (let d = 1; d <= days; d++){ const dt = new Date(y, m, d), k = ymd(dt), mk = mark[k] || [];
    cells.push(h("div",{class:"ms-day" + (k === today() ? " today" : "") + (dt.getDay() === 0 || dt.getDay() === 6 ? " wk" : "")},
      h("span",{class:"ms-n"}, d), ...mk.map(([c, l]) => h("span",{class:"ms-tag " + c}, l)))); }
  return h("div",{class:"ms"}, ...cells);
}
function viewCycle(){
  const label = new Date().toLocaleDateString("en-US",{month:"long", year:"numeric"});
  return [
    h("div",{class:"page-h"}, h("div",{}, h("h2",{},"How we work"), h("p",{class:"sub"},"One FIESTA to the next, and how one night becomes a month of content."))),
    h("section",{class:"card pad"},
      h("div",{class:"card-h flat"}, h("h3",{},"The monthly cycle"), h("span",{class:"muted small"},"T = FIESTA night, the 3rd Tuesday")),
      h("ol",{class:"cycle"}, ...STAGES.map(([t, when, title, items, media], i) => h("li",{class:"stage" + (t === "T" ? " now" : "")},
        h("div",{class:"stage-t"}, h("span",{class:"stage-k"}, t), h("span",{class:"muted small"}, when)),
        h("h4",{}, title), h("ul",{}, ...items.map(x => h("li",{}, x))),
        h("div",{class:"stage-media"}, h("span",{class:"lbl"},"Media"), media)))),
      h("p",{class:"small muted", style:"margin:12px 0 0"},"…and then the whole cycle starts again.")),
    h("div",{class:"two-col"},
      h("section",{class:"card pad"}, h("div",{class:"card-h flat"}, h("h3",{},"Our week on Instagram"), h("span",{class:"muted small"},"5 posts a week, 20 a month")),
        h("div",{class:"week5"}, ...WEEK.map(([d, k, f]) => h("div",{class:"w5"}, h("div",{class:"w5-d"}, d), h("span",{class:"tag t-" + k.toLowerCase().replace(" ","")}, k), h("div",{class:"small muted"}, f)))),
        h("p",{class:"small muted", style:"margin:12px 0 0"},"Weeks 1–3 come off the previous FIESTA night. Capture nights are FIESTA and Round Rock.")),
      h("section",{class:"card pad"}, h("div",{class:"card-h flat"}, h("h3",{}, `Fixed dates · ${label}`)), monthStrip(),
        h("div",{class:"ms-key"}, h("span",{class:"ms-tag fi"},"FIESTA · 3rd Tue"), h("span",{class:"ms-tag fh"},"FoundHERs · 1st Tue"), h("span",{class:"ms-tag nl"},"FOCUS · 2nd & 4th Tue · HERald · 1st Fri")))),
    h("section",{class:"card pad"}, h("div",{class:"card-h flat"}, h("h3",{},"One interview, six pieces")),
      h("div",{class:"flow"}, h("div",{class:"flow-src"}, h("b",{},"1 founder interview"), h("span",{},"3–4 min, vertical"), h("span",{},"+ 8 portrait frames")),
        h("div",{class:"flow-out"}, ...PIECES.map(([p, to]) => h("div",{class:"flow-row"}, h("span",{class:"flow-piece"}, p), h("span",{class:"flow-arrow"},"→"), h("span",{class:"flow-to"}, to))))),
      h("p",{class:"small muted", style:"margin:12px 0 0"},"The banked clip compounds: every future win a founder submits already has footage waiting. That's why a night captures eight interviews for four story slots.")),
    h("section",{class:"card pad"}, h("div",{class:"card-h flat"}, h("h3",{},"Instagram makes it, everyone else repackages")),
      h("div",{class:"hub3"},
        h("div",{class:"hub-col"}, h("div",{class:"lbl"},"Made from"), ...["Story reel ×4","Story carousel ×4","Win reel ×4","Win carousel ×4","Free form ×4","Recap + 12 stories"].map(x => h("div",{class:"hub-pill"}, x))),
        h("div",{class:"hub-mid"}, h("b",{},"Instagram"), h("span",{class:"lbl"},"20 posts a month"), h("span",{class:"muted small"},"everything is made here first")),
        h("div",{class:"hub-col"}, h("div",{class:"lbl"},"Repackaged to"), ...CHANNELS.map(([c, d]) => h("div",{class:"hub-card"}, h("b",{}, c), h("span",{class:"muted small"}, d))))),
      h("p",{class:"small muted", style:"margin:12px 0 0"},"Nothing is made twice. The weekly slot count is the only number that has to hold.")),
    h("section",{class:"card pad"}, h("div",{class:"card-h flat"}, h("h3",{},"Who owns what across FIESTA"), h("span",{class:"muted small"},"Media team buckets are highlighted")),
      h("div",{class:"buckets"}, ...BUCKETS.map(([b, ex, media]) => h("div",{class:"bucket" + (media ? " media" : "")}, h("b",{}, b), h("span",{class:"small muted"}, ex)))))
  ];
}

registerView("cycle", viewCycle);
