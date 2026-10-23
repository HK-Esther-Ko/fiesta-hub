# FIESTA Media Hub: UX guide

How the hub is meant to work, why, and what to keep consistent when changing it. Written for whoever maintains the site next.

## Who uses it, and for what

| Person | Comes in to… | Lands on |
|---|---|---|
| Content manager (Esther) | Plan and track posts, check deadlines, enter KPIs | Home → Calendar |
| Media team (Tayo, Gaia, Mindy, Kate) | See what's due from them, find files, check event roles | Home |
| Leadership (Cherie, Ryan, John) | See who does what, give access, glance at KPIs | Home → Event org chart, Analytics |

Most visits are short: "what do I need to do?" and "where is that file?". The design optimizes for those two questions.

## Principles

### 1. Answer "what needs me?" first
The first screen is personal: greeting, three counts (open tasks, posts due in 7 days, drafts to review), then the lists behind them. Team-wide information sits on the right as previews with a "View all" link.
*Why:* role-based dashboards reduce the time to the first useful action; people shouldn't have to scan a shared calendar to find their own work.

### 2. Few menu items, ordered by frequency
Seven items, most used first: Home, Calendar, Analytics, Event org chart, Roles, Team chat, Drive, SOPs. Admin-only items (Access) and Log out sit apart at the bottom.
*Why:* Hick's law: fewer, well-grouped choices are faster to pick from. Rare or risky actions are kept away from everyday ones.

### 3. One place for each fact
A calendar item holds everything about one post: date and time, deadline, brief/caption, owner, working folder and finished-file link, plus its own discussion thread. Nothing is duplicated in another page.
*Why:* duplicated data drifts apart; a single source of truth means nobody asks "which one is right?"

### 4. Notifications: actionable first, and few
The bell has two groups:
- **Needs you:** your posts due within 2 days or overdue, drafts waiting for your review. These stay until resolved.
- **Recent:** @mentions and tasks someone gave you. These clear once seen.

The badge counts only actionable or unseen items.
*Why:* notification fatigue makes people ignore every alert. Only things that need a response earn a badge.

### 5. Status is shown by shape and text, not color alone
Calendar posts: faded = in progress, tinted = scheduled, solid with ✓ = published, red outline = date passed but not published, amber outline = needs review. Pills always carry words ("2d overdue", "Due today").
*Why:* about 1 in 12 men has a color vision deficiency; color plus a second cue keeps status readable for everyone.

### 6. Permissions explain themselves
Team members can open any calendar item but see a read-only view with a note ("Only content managers and admins can change calendar items. Leave a note below instead") and the discussion thread. Buttons they can't use are hidden; the database rules enforce the same limits.
*Why:* hiding content creates confusion; showing it read-only with a reason keeps everyone informed without risk.

### 7. Edit in a side drawer, keep your place
Creating or editing anything opens a drawer on the right. The page behind stays put.
*Why:* keeping context reduces the "where was I?" cost of switching screens.

### 8. Empty states say what to do next
Every empty list names what will appear and how to add the first item ("No pitchers added yet." + "Add a pitcher").
*Why:* a blank area reads as broken; a next step reads as an invitation.

### 9. One card pattern, one primary action per screen
Every section is a white card with a title on the left and a single text action on the right ("View all", "+ Add task"). Each page has at most one filled navy button, top right.
*Why:* consistency (Nielsen heuristic #4) lets people learn the layout once.

### 10. Readable by default
Plus Jakarta Sans at 14.5px+, high-contrast navy on white, FIESTA orange only as a highlight (badges, brand chips), visible keyboard focus, layouts that collapse to one column on phones.

## Page roles at a glance

| Page | Its one job |
|---|---|
| Home | Your tasks, your deadlines, what's coming up |
| Calendar | Plan and track every post; deadlines listed under the grid |
| Analytics | Monthly KPIs (entered by hand) and plan-vs-published from the calendar |
| Event org chart | Who does what at FIESTA / FoundHERs; next meetup's pitchers |
| Roles | The team page: photo, title, responsibilities |
| Team chat | Quick questions, @mentions |
| Drive | Shortcuts to the 4 shared folders |
| SOPs | How each role does its job |
| Access (admins) | Who can sign in, and at what level |

## Next improvements worth considering

1. **Search (Ctrl+K):** jump to any post, person or SOP by name once the calendar grows.
2. **Undo after delete:** a 5-second "Undo" toast instead of a confirm step.
3. **New-member checklist on Home:** add your photo, read the SOP for your role, open the Drive folders.
4. **Monthly KPI ritual:** a reminder on Home on the 1st to enter last month's numbers before the meeting.
5. **Weekly digest:** a Monday summary of each person's week (needs an email service; free tiers exist, e.g. EmailJS).
