# FIESTA Media Hub

The FIESTA media team's internal site: content calendar, deadlines, events and role charts, meetings and to-dos, team chat with @mentions, Drive folder links, SOPs and the team page.

- **Hosting:** GitHub Pages (static files, free)
- **Sign-in and data:** Firebase Auth (Google sign-in) + Cloud Firestore, on the free Spark plan
- **No build step:** plain HTML/CSS/JS modules; edit a file, push, done

## Files

| File | What it is |
|---|---|
| `index.html` | Page shell: sign-in gate, header, menu |
| `app.js` | All screens and logic |
| `firebase.js` | Firestore/Auth wrapper and access helpers |
| `config.js` | Firebase project keys and bootstrap admin emails (**edit this**) |
| `firestore.rules` | Database security rules (**paste into Firebase**) |
| `styles.css` | Design tokens (FIESTA brand palette) and layout |
| `assets/` | Logo |

Not committed (see `.gitignore`): `data-export/` (team data for the first import), `claude-artifact/` (the earlier Claude prototype), `brand/` (source brand files).

## Access levels

Set per email on the **Access** page (admins only). Enforced by `firestore.rules`, not just the UI.

| Level | Can do |
|---|---|
| Admin | Everything, including the Access page |
| Content manager | Edit the content calendar, plus everything a team member can do |
| Team member | View the calendar; manage their own tasks, chat, events, SOPs, roles |

Only emails on the Access list (or in `ADMIN_EMAILS`) can sign in.

## First-time setup

1. **Firebase project.** console.firebase.google.com → Add project (Analytics off).
2. **Google sign-in.** Build → Authentication → Get started → Sign-in method → Google → Enable → Save.
3. **Database.** Build → Firestore Database → Create database → Production mode.
   Then **Rules** tab → paste `firestore.rules` → put your admin email(s) in `bootstrapAdmin()` (lowercase) → Publish.
4. **Web app keys.** Project settings → General → Your apps → Web (`</>`) → Register → copy the `firebaseConfig` values into `config.js`. Put the same admin email(s) in `ADMIN_EMAILS`.
5. **GitHub Pages.** Repo Settings → Pages → Deploy from a branch → `main` / root → Save. The site appears at `https://<user>.github.io/<repo>/`.
6. **Allow the domain.** Firebase → Authentication → Settings → Authorized domains → add `<user>.github.io`.
7. **Load the team's data.** Sign in as an admin → Access → Import data → choose `data-export/hub-data.json`.
8. **Add people.** Access → + Add email for each teammate, with their level.

## Handing over to a new owner

1. **GitHub:** Settings → Collaborators → add them, or Settings → General → Transfer ownership.
2. **Firebase:** Project settings → Users and permissions → Add member → Owner.
3. Add their email to `ADMIN_EMAILS` (config.js) and `bootstrapAdmin()` (firestore.rules, then Publish). Optionally remove the previous owner's.
4. On the Access page, make them Admin.

## Notes

- Email (mentions, reminders, meeting to-dos) opens the sender's own mail app with the message filled in. Nothing is sent from a server.
- Headshots are resized to 480px and stored on the teammate's record (the free plan has no file storage).
- FIESTA meetups default to the 3rd Wednesday and FoundHERs to the 1st Tuesday of each month; change on Events → "<series> defaults".
- Firestore free tier: 50k reads / 20k writes per day, plenty for a team this size.
