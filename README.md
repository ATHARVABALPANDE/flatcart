# FlatCart

A shared shopping list for flatmates. Everyone adds the items they need, and whenever
someone checks Blinkit/Zepto/Instamart/BigBasket, they type in the price and in-stock
status they see for each item. The app uses that crowd-sourced pricing to show, per
store, how much a full order would cost and which items it's missing, then suggests the
cheapest way to cover everything in the fewest stores (factoring in each store's
delivery fee and free-delivery threshold, which are editable per household).

Note: Blinkit/Zepto/etc. don't provide public APIs for prices, stock, or placing
orders, so none of this is automated — it's a way to combine what everyone has already
seen while browsing, and make it fast to actually place the order in the real app.

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

- The backend as a Docker web service (runs `prisma migrate deploy` on boot), pointed at
  your existing Neon database
- The frontend as a static site

Steps:

1. Push this repo to GitHub.
2. In Render, click **New > Blueprint**, connect the repo, and it will read `render.yaml`.
3. It will prompt you for `DATABASE_URL` and `DIRECT_URL` (marked `sync: false`) — paste in
   your Neon pooled and direct connection strings.
4. After the first deploy, update the frontend's `VITE_API_URL` and backend's `CORS_ORIGIN`
   env vars in the Render dashboard to match the actual generated `*.onrender.com` URLs
   (they reference each other, so the first deploy needs one manual round-trip), then
   trigger a redeploy.
5. Share the frontend URL with your flatmates. Each person signs up, then either creates
   a household (gets an invite code) or joins one with a code a flatmate shares.

Render's free web services spin down after inactivity and take ~30-60s to wake back up
on the next request — fine for a flat's shared app, just expect a brief delay after idle
periods.

## Store deep links

`frontend/src/stores.js` builds a search URL per store from the item name. These are
best-effort based on each site's current search URL pattern and may need updating if a
store changes its site.
