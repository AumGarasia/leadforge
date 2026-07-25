# LeadForge — Application Walkthrough

A guided tour through the app, in the order it makes sense to demo it (public form →
admin view → permission boundaries → API). Written so it doubles as a Loom/screen-recording
script if you want one — each section is roughly 20-30 seconds of screen time.

---

## 0. Before you start

```bash
cd backend && npm install && npm run build && npm start   # http://localhost:4000
cd frontend && npm install && npm run dev                  # http://localhost:5173
```

On first boot, the backend seeds one admin account:

| Role  | Email                  | Password      |
|-------|-------------------------|----------------|
| Admin | `admin@leadforge.dev`   | `digital!herosco` |

There's no seeded Member account by default — creating one live from the Team page (Step 4
below) is itself part of the demo, and it's a more honest way to show the RBAC system than a
pre-baked fixture would be.

**Faster option:** if you'd rather not click through empty screens first, run
`npm run seed` in `backend/` before starting the server. It fills the database with a 4-person
team and 12 leads spread across every stage, notes, and a real activity trail — then you can
skip straight to Step 3 and everything below still applies, just against fuller data. It prints
all the demo logins (1 admin, 3 members) when it finishes. `npm run seed -- --reset` wipes and
reseeds if you want to start over.

---

## 1. Public lead capture (unauthenticated)

Open **http://localhost:5173/** — this is the public-facing form, the surface a real prospect
would land on. No login, no LeadForge branding visible beyond the footer credit.

- Fill in name, email, company, message → **Submit**.
- You'll see a plain confirmation screen. Nothing about internal pipeline state is exposed here
  — that's deliberate: this route only ever writes, it never reads back.

**What this proves:** `POST /api/public/leads` works end-to-end, is rate-limited (10/min/IP),
and validates input server-side (try submitting an invalid email to see the 400).

---

## 2. Sign in as Admin

Go to **http://localhost:5173/login** and sign in with the admin credentials above.

You land on **/leads** — the internal app. Notice the nav bar now shows **Leads** and **Team**
(the Team link only appears for Admins — first visible sign of role-based UI).

---

## 3. Leads list

- The lead you just submitted in Step 1 is at the top, stage **NEW**, unassigned.
- Use the **stage filter** dropdown to narrow the list — try filtering to `NEW` to isolate it.
- If you have 15+ leads, the pager at the bottom becomes active — this is backed by real
  server-side pagination (`?page=&limit=`), not a client-side slice.

Click into the lead's name to open its detail page.

---

## 4. Lead detail — stage, notes, assignment

On the detail page as Admin, you can:

- **Change stage** via the dropdown top-right — try moving it to `CONTACTED`. Scroll down to
  **Activity** and you'll see a new `STAGE_CHANGED` entry appear immediately, with the from/to
  values — this is the append-only activity trail (FR-6).
- Try moving it to **LOST** — you'll be prompted for a reason. Cancel the prompt and the stage
  won't change; this enforces the "lost leads need a reason" rule server-side, not just in the UI.
- **Add a note** in the box below Notes — it appears immediately, timestamped and attributed.
- As Admin, you can do this on *any* lead, assigned to you or not — that's the permission
  boundary you'll see flip in Step 6.

---

## 5. Team page — create a Member

Click **Team** in the nav. You'll see the current user list (just Admin so far).

- Fill in the "Add team member" form — name, email, a temp password, role `Member` → **Add**.
- The new user appears in the table immediately.

This is also the moment to point out: this page redirects non-admins away client-side, *and*
the underlying `POST /api/users` route independently rejects non-admin tokens with a 403 — the
UI check is a convenience, not the actual security boundary.

---

## 6. Sign in as Member — watch permissions change

**Sign out**, then log in as the Member account you just created.

- Nav bar: **Team** link is gone. This user cannot see or reach admin-only pages.
- **Leads list**: still fully visible — Members get pipeline-wide read access by design (so a
  rep can see what teammates are working, per the SRS's assumption).
- Open a lead **not** assigned to this Member (e.g. the one Admin was editing in Step 4):
  - The stage dropdown is gone; you'll see *"This lead is assigned to someone else — you have
    read-only access."*
  - Try hitting the API directly for this lead's stage endpoint with this user's token (see
    Section 8) — you'll get a `403 FORBIDDEN`, proving the block isn't just a hidden button.

---

## 7. Self-claim an unassigned lead

Still as Member, go back to **Leads**, filter to `NEW`, and open an unassigned lead (or submit
a fresh one via the public form in another tab first).

- Click **Claim this lead**. The stage dropdown and note box now appear — this Member can now
  edit it, because ownership just transferred to them.
- Open the same lead in a second browser (or incognito) as a *different* Member and try to claim
  it again — you'll get `400 ALREADY_ASSIGNED`, since claim is a race-safe, single-owner
  operation.

---

## 8. API directly (for reviewers who want to see past the UI)

```bash
# Public capture
curl -X POST http://localhost:4000/api/public/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Jordan Prospect","email":"jordan@prospect.com"}'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@leadforge.dev","password":"ChangeMe123!"}'
# → copy data.accessToken from the response into $TOKEN below

# Unauthenticated access is rejected
curl -i http://localhost:4000/api/leads   # expect 401

# Authenticated list
curl http://localhost:4000/api/leads -H "Authorization: Bearer $TOKEN"
```

Full endpoint reference, request/response shapes, and error codes: `backend/README.md`.

---

## What each step maps to, for quick rubric cross-reference

| Walkthrough step | Proves |
|---|---|
| 1 | Public capture (FR-1), server-side validation, rate limiting |
| 2–3 | Auth (FR-2), paginated/filterable list (FR-4) |
| 4 | Stage lifecycle + activity trail (FR-6), lost-reason business rule |
| 5 | Admin user management (FR-3) |
| 6 | Ownership-based permission enforcement, client *and* server (FR-10) |
| 7 | Self-claim flow (FR-8), race-safety on assignment |
| 8 | Documented JSON API (FR-9), consistent error shape |

---

## If something doesn't behave as described

- Backend not responding → confirm it's running on :4000 and `VITE_API_URL` in
  `frontend/.env` points at it.
- "Admin" login fails → the seed only runs if no user exists yet with `SEED_ADMIN_EMAIL`;
  delete `backend/dev.db` and restart if you've since changed the schema or seed values.
- Claim/assign behaving oddly across two browser sessions → make sure you're not reusing the
  same access token in both (each login issues a fresh one).
