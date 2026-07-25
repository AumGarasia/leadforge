# Deploying LeadForge

Free-tier stack matching the SRS: Postgres on Neon, backend on Render, frontend on Vercel.
Roughly 20-30 minutes end to end.

## 1. Push to GitHub

```bash
cd leadforge
git init
git add .
git commit -m "LeadForge — Digital Heroes Full Stack Development task"
```
Create a new **public** repo on GitHub (the brief requires a public repo link), then:
```bash
git remote add origin https://github.com/<you>/leadforge.git
git branch -M main
git push -u origin main
```

## 2. Provision Postgres — Neon (free tier)

1. Go to [neon.tech](https://neon.tech) → sign up → **New Project**.
2. Name it `leadforge`, pick a region close to wherever your backend will run.
3. Once created, copy the **connection string** from the dashboard — it looks like:
   `postgresql://user:password@ep-xxxx.region.aws.neon.tech/leadforge?sslmode=require`
4. Keep that tab open — you'll paste it into Render in the next step as `DATABASE_URL`.

You don't need to run any migration manually — `ensureSchema()` runs the DDL automatically the
first time the backend boots against this connection string.

## 3. Deploy the backend — Render (free tier)

1. Go to [render.com](https://render.com) → **New** → **Web Service** → connect your GitHub repo.
2. Configure:
   - **Root directory:** `backend`
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
   - **Instance type:** Free
3. Add environment variables (Render dashboard → Environment):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from Step 2 |
   | `JWT_SECRET` | a long random string — generate one with `openssl rand -hex 32` |
   | `SEED_ADMIN_EMAIL` | your choice, e.g. `admin@leadforge.dev` |
   | `SEED_ADMIN_PASSWORD` | a real password, not the repo default |
   | `PORT` | `4000` (Render sets its own `PORT` too; the app already reads `process.env.PORT`) |

4. Deploy. Watch the logs for `LeadForge API listening on :<port>` and `Seeded admin user: ...`.
5. Copy the Render URL (e.g. `https://leadforge-api.onrender.com`) — you'll need it for Step 4.
6. **Seed demo data against production**, from your own machine, pointed at Neon:
   ```bash
   cd backend
   DATABASE_URL="<the same Neon connection string>" npm run seed
   ```
   This runs the same seed script from `WALKTHROUGH.md`, just against the live database instead
   of your local one — so the deployed app has the 4-person team and 12 leads on it, not an
   empty screen, the first time a reviewer opens it.

> Free-tier note: Render's free web services spin down after inactivity and take ~30-60s to
> wake on the next request. Mention this in your submission notes so a reviewer isn't confused
> by a slow first load — it's expected, not a bug.

## 4. Deploy the frontend — Vercel (free tier)

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import the same GitHub repo.
2. Configure:
   - **Root directory:** `frontend`
   - **Framework preset:** Vite (auto-detected)
3. Add one environment variable:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | the Render backend URL from Step 3, e.g. `https://leadforge-api.onrender.com` |

4. Deploy. Vercel gives you a URL like `https://leadforge.vercel.app`.

## 5. Verify the live deployment

```bash
# Health check
curl https://<your-render-url>/health

# Login as seeded admin
curl -X POST https://<your-render-url>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<your SEED_ADMIN_EMAIL>","password":"<your SEED_ADMIN_PASSWORD>"}'
```
Then open the Vercel URL in a browser and walk through `WALKTHROUGH.md` against the live app —
every step in it should behave identically to local, since nothing but the database driver
changed.

## 6. What to put in your submission

- **Live URL:** the Vercel frontend URL (this is what a reviewer clicks).
- **Repo:** the GitHub URL from Step 1.
- **Credentials per role**, as the brief requires — use the seeded ones:

  | Role | Email | Password |
  |---|---|---|
  | Admin | value of `SEED_ADMIN_EMAIL` | value of `SEED_ADMIN_PASSWORD` |
  | Member | `sam@leadforge.dev` | `MemberPass123` |

  (Change the member password too if you want to be strict about it — edit `TEAM` in
  `backend/src/scripts/seed.ts` before running `npm run seed` against production.)

## If something doesn't come up

- **Backend 502/503 on first load:** free-tier cold start — wait ~30-60s and retry.
- **Frontend loads but API calls fail (CORS or network error in browser console):** double-check
  `VITE_API_URL` in Vercel has no trailing slash and matches the Render URL exactly, then
  redeploy the frontend (env var changes need a redeploy to take effect on Vercel).
- **Login fails on the deployed app but works locally:** you probably seeded against local
  SQLite instead of the Neon `DATABASE_URL` — rerun the seed command in Step 3.6 with
  `DATABASE_URL` explicitly set.
- **`ensureSchema` errors on boot:** almost always a malformed `DATABASE_URL` — Neon's string
  must include `?sslmode=require`; the driver also force-enables SSL for any non-localhost host,
  so a plain `postgresql://...` without `sslmode` still works, but copying the string exactly
  from Neon's dashboard is the safest bet.
