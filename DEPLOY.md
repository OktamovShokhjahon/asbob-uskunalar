# Deploy: backend → Render, frontend → Vercel

Order matters: **backend first** (you need its URL for the frontend), then the
frontend, then go back and tell the backend the frontend's URL (CORS).

```
Browser ──► https://<project>.vercel.app          (frontend/, Next.js on Vercel)
   │
   └──────► https://<service>.onrender.com/api/v1 (backend/, Express on Render)
                     └─ /var/data/app.db + /var/data/uploads (persistent disk)
```

Config files in the repo:

| File | Used by | What it does |
|---|---|---|
| `render.yaml` (repo root) | Render Blueprint | Creates the API service, disk and env vars |
| `frontend/vercel.json` | Vercel | Next.js framework, install/build commands, region |

> Vercel does not use YAML — its config file is `vercel.json`.

---

## Part 1 — Backend on Render

1. Make sure the latest code is pushed to GitHub (`main` branch).
2. Go to <https://dashboard.render.com> and sign in **with GitHub**.
3. Click **New +** → **Blueprint**.
4. Connect the repository **OktamovShokhjahon/asbob-uskunalar**
   (if it's not listed: *Configure account* → give Render access to this repo).
5. Render finds `render.yaml` and shows the service `asbob-uskunalar-api`.
   It asks for two values:
   - **CORS_ORIGIN** — you don't have the Vercel URL yet. Put
     `http://localhost:3000` for now; you'll change it in Part 3.
   - **SUPERADMIN_PASSWORD** — a strong password for the `admin` account.
     Save it somewhere; this is how you log in to `/admin`.
6. Click **Apply**. Render will:
   - build: `npm ci --include=dev && npx prisma generate && npm run build`
   - start: `npx prisma migrate deploy && npx prisma db seed && npm start`
7. Wait until the status is **Live** (first build ~3–5 min).
8. Copy the service URL from the top of the page, e.g.
   `https://asbob-uskunalar-api.onrender.com`.
9. Test it: open `https://asbob-uskunalar-api.onrender.com/api/v1/health`
   → you should see `{"data":{"status":"ok","db":"ok"}}`.

### About cost (important)

`render.yaml` uses `plan: starter` (paid, about $7/month) because the app uses
**SQLite + uploaded images on disk**, and only paid instances can have a
persistent disk. Without the disk, every redeploy/restart **erases all users,
listings and photos**.

**Free option (demo only, data resets):** in `render.yaml` change
`plan: starter` → `plan: free`, delete the whole `disk:` block, and change
`DATABASE_URL` to `file:./prod.db` and `UPLOAD_DIR` to `public/uploads`.
Also note that free services sleep after 15 min idle — the first request
afterwards takes ~1 minute.

---

## Part 2 — Frontend on Vercel

1. Go to <https://vercel.com> and sign in **with GitHub**.
2. Click **Add New…** → **Project**, and **Import** `asbob-uskunalar`.
3. On the configure screen:
   - **Root Directory** → click *Edit* → choose **`frontend`**  ← required
   - Framework Preset: **Next.js** (auto-detected; `vercel.json` sets it too)
4. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://asbob-uskunalar-api.onrender.com/api/v1` |

   (use *your* Render URL from Part 1, step 8, **with `/api/v1` at the end**,
   no trailing slash)
5. Click **Deploy** and wait ~1–2 min.
6. Copy your site URL, e.g. `https://asbob-uskunalar.vercel.app`.

> `NEXT_PUBLIC_*` variables are baked in at build time. If you ever change
> `NEXT_PUBLIC_API_URL`, go to **Deployments → ⋯ → Redeploy**.

---

## Part 3 — Connect them (CORS)

1. Back in Render → your service → **Environment**.
2. Edit **CORS_ORIGIN** → set it to your Vercel URL exactly, without a
   trailing slash: `https://asbob-uskunalar.vercel.app`
   (several allowed? separate with commas:
   `https://asbob-uskunalar.vercel.app,https://mydomain.uz`)
3. **Save Changes** → Render redeploys automatically (~1 min).

---

## Part 4 — Check everything works

1. Open your Vercel URL — the catalog with tools should load.
2. Register a new user, log in, post a listing with a photo.
3. Log in as `admin` with your `SUPERADMIN_PASSWORD` and open `/admin`.
4. If something fails, open the browser DevTools → **Console/Network**:
   - **CORS error** → `CORS_ORIGIN` on Render doesn't match the Vercel URL exactly.
   - **Requests go to `localhost:4000`** → `NEXT_PUBLIC_API_URL` wasn't set
     before the build; set it and Redeploy on Vercel.
   - **500 / 502 from Render** → Render → service → **Logs**.

---

## After that: updates are automatic

Every `git push` to `main` redeploys both:
Render rebuilds the API (and runs new migrations), Vercel rebuilds the site.

## Notes

- The seed runs on every start. It only (re)creates the `admin` user and the
  6 starter tools; user data is not touched. If the admin edits one of those
  6 starter tools, the edit is reset on the next restart — remove
  `&& npx prisma db seed` from `startCommand` after the first deploy if that
  matters.
- Changing `SUPERADMIN_PASSWORD` in Render and restarting updates the admin
  password.
- Custom domain: Vercel → Project → **Settings → Domains**; then add that
  domain to `CORS_ORIGIN` on Render too.
