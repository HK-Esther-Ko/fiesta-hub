// FIESTA Media Team: sends request emails from a Google account, free (Gmail allows about 100 a day).
// Setup (about 5 minutes):
// 1. Go to script.google.com while signed in to the account that should send the emails → New project.
// 2. Paste this whole file, fill in KEY and TEAM below, then Save.
// 3. Deploy → New deployment → type "Web app" → Execute as: Me → Who has access: Anyone → Deploy → allow access.
// 4. Copy the web app URL into EMAIL_HOOK.url in config.js, and KEY into EMAIL_HOOK.key. Push.
// Only the addresses in TEAM can ever receive mail, so the URL can't be used to email anyone else.

const KEY = "change-me-to-any-long-random-word";
const TEAM = [
  // everyone's contact email, lowercase, e.g. "gaia@gmail.com"
];

function doPost(e) {
  const d = JSON.parse(e.postData.contents || "{}");
  if (d.key !== KEY) return ContentService.createTextOutput("bad key");
  const to = (d.to || []).map(x => String(x).trim().toLowerCase()).filter(x => TEAM.includes(x));
  if (!to.length) return ContentService.createTextOutput("no team recipients");
  MailApp.sendEmail({
    to: to.join(","),
    subject: "[FIESTA Media Team] " + String(d.subject || "").slice(0, 150),
    body: String(d.body || "").slice(0, 4000),
    name: "FIESTA Media Team"
  });
  return ContentService.createTextOutput("sent");
}
