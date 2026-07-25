# LeadForge

Digital Heroes Full Stack Development qualification task (Role 04/16).

- `backend/` — Express + TypeScript API. See `backend/README.md` for API contract and architecture rationale.
- `WALKTHROUGH.md` — step-by-step tour of the running app (also usable as a Loom script).
- `DEPLOYMENT.md` — steps to get this live: Postgres (Neon) + backend (Render) + frontend (Vercel).
- `frontend/` — React + Vite + TypeScript app (public capture form + authenticated internal app).
- `task-b/` — Task B deliverables: assessment, migration plan, and a real before/after refactor with passing tests.
- `LeadForge_SRS.docx` — the SRS this build follows, with the decision log explaining every architecture choice.

## Quickest path to running both

```bash
cd backend && npm install && npm run build && npm start   # :4000
cd frontend && npm install && npm run dev                  # :5173
```

Demo admin login: `admin@leadforge.dev` / `digital!herosco`
