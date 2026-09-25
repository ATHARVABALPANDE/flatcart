# FlatCart

A shared shopping cart for flatmates. Everyone in the flat adds items they need,
grouped by which quick-commerce store they'd come from (Blinkit, Zepto, Instamart,
BigBasket, or Other). Whoever's placing an order opens the "Open in Blinkit/Zepto/..."
link for each item (jumps straight to that item's search on the store's site), adds it
in the real app, then marks the store's list as ordered so everyone sees it's done.

Note: Blinkit/Zepto/etc. don't provide public APIs for adding items to a cart or
placing orders, so this app can't place the order automatically — it just makes the
manual process fast and keeps everyone in sync on who needs what.

## Structure

- `backend/` — Node.js + Express + Prisma + PostgreSQL API (JWT auth, households, cart)
- `frontend/` — React + Vite single-page app

## Running locally

You need a PostgreSQL database. Easiest options: install Postgres locally, run one via
Docker (`docker run -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=flatcart -p 5432:5432 postgres`),
or use a free hosted instance (e.g. [Neon](https://neon.tech) or [Supabase](https://supabase.com)).

### Backend

```
cd backend
cp .env.example .env   # fill in DATABASE_URL and a random JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run dev
```

Runs on http://localhost:4000.

### Frontend

```
cd frontend
cp .env.example .env   # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev
```

Runs on http://localhost:5173.

## Deploying (Render)

`render.yaml` at the repo root is a Render Blueprint that provisions:

- A free PostgreSQL database
- The backend as a Docker web service (runs `prisma migrate deploy` on boot)
- The frontend as a static site

Steps:

1. Push this repo to GitHub.
2. In Render, click **New > Blueprint**, connect the repo, and it will read `render.yaml`.
3. After the first deploy, update the frontend's `VITE_API_URL` and backend's `CORS_ORIGIN`
   env vars in the Render dashboard to match the actual generated `*.onrender.com` URLs
   (they reference each other, so the first deploy needs one manual round-trip), then
   trigger a redeploy.
4. Share the frontend URL with your flatmates. Each person signs up, then either creates
   a household (gets an invite code) or joins one with a code a flatmate shares.

Render's free web services spin down after inactivity and take ~30-60s to wake back up
on the next request — fine for a flat's shared app, just expect a brief delay after idle
periods.

## Store deep links

`frontend/src/stores.js` builds a search URL per store from the item name. These are
best-effort based on each site's current search URL pattern and may need updating if a
store changes its site.
