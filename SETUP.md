# FORME v3 — local setup (F: drive only)

Everything this project needs runs from the **F:** drive. Nothing is downloaded to
or written on **C:** — not Node.js, not PostgreSQL, not the npm cache, not temp
files, not the database.

## What this folder is

A fashion e-commerce starter, three parts in one repo:

| Part | Where | What it is |
|---|---|---|
| Storefront | `public/` | Editorial-style shop front (home page, catalogue, bag, demo checkout). Served by the API itself. |
| Admin console | `public/admin/` | Sign-in + dashboard, catalogue, orders, inventory, customers, coupons, reports. |
| API | `server/src/index.js` | Express 5 API: catalogue, checkout with transactional stock reservation, admin CRUD, JWT auth, audit log. |
| Data model | `server/prisma/schema.prisma` | 25 Prisma models — orders, SKUs, multi-location inventory, coupons, returns, refunds, shipments, tax rules. |

The payment, shipping and tax adapters are **deliberately disabled** — they report
"not configured" rather than pretending to charge a card. See
[`docs/IMPLEMENTATION-STATUS.md`](docs/IMPLEMENTATION-STATUS.md).

## Where things live

| Thing | Location |
|---|---|
| Node.js 24 + npm 11 | `F:/WebShop/.toolchain/node` |
| PostgreSQL 16 binaries | `F:/WebShop/.toolchain/pgsql` |
| **v3's own database cluster** | `F:/tools/pgdata` (port **5433**) |
| npm cache | `F:/WebShop/.toolchain/npm-cache` |
| temp files | `F:/WebShop/.toolchain/tmp` |
| `node_modules` | `F:/.../forme-commerce-platform/node_modules` |
| API log | `F:/tools/logs/api-v3.log` |

### Why a second PostgreSQL cluster

`F:/WebShop/.toolchain/pgdata` (port 5432) belongs to the **older** version of this
project that still runs on this machine. v3's Prisma schema is a superset of that
one, so pointing v3 at the same tables would rewrite them and break the running
app. v3 therefore owns a separate cluster on port 5433. Nothing is shared.

## Running it

```bash
./start.sh          # Git Bash
start.cmd           # Windows CMD
```

`start.sh` starts PostgreSQL if it is down, then the API. Stop it with
`./stop.sh` / `stop.cmd`.

| URL | |
|---|---|
| Storefront | http://localhost:4100 |
| Admin console | http://localhost:4100/admin/ |
| API health | http://localhost:4100/health |

Admin sign-in (development placeholders, also in `.env`):

```
admin@example.com
ChangeThisPassword123!
```

> Change `ADMIN_PASSWORD` and `JWT_SECRET` in `.env` before this is exposed to
> anything other than localhost.

## Ports in use

| Port | Who |
|---|---|
| 4000 | the older version of this project (separate repo, still running) |
| 4100 | **v3** — this folder |
| 5432 | the older project's PostgreSQL cluster |
| 5433 | **v3's** PostgreSQL cluster |
| 8080 | the older project's static file server |

To move v3 to port 4000, stop whatever holds it and change `PORT` in `.env`.

## Manual setup (from scratch)

```bash
source ./env.sh        # puts node + postgres on PATH, keeps npm/temp on F:
npm install
npm run prisma:generate
npm run db:push        # creates the tables in the 5433 cluster
npm run seed           # 4 categories, 5 products, SKUs, inventory
npm run seed:demo      # optional: 8 customers, 16 orders, 4 coupons
npm test               # 4 unit tests
npm run dev            # API with --watch
```

If the database is not running:

```bash
"$PGHOME/bin/pg_ctl" -D F:/tools/pgdata -l F:/tools/pgdata/server.log \
  -o "-p 5433 -h localhost" start
```

## Images

All product, hero and story images live in **`public/images/`**. Drop a file in
there and reference it as `/images/<file>` — `express.static` serves `public/`
directly, so no rebuild and no server restart is needed.

| What | Where to change it |
|---|---|
| Product cards, cart, checkout | Admin → Products → Edit → **Image** field → `/images/<file>` |
| Homepage hero | Admin → Homepage → **Hero image** → `/images/<file>` |
| "Our story" photo | Admin → Homepage → **Story image** → `/images/<file>` |

The admin field accepts a local path (`/images/tee.jpg`) or an external
`https://` URL. The API validates it: only `http(s)://…` or a `/…` path
without `..` segments is accepted.

More detail, and the full Chinese operating manual (starting, stopping,
signing in, changing products, changing the home page, command reference,
troubleshooting): **`public/images/README.txt`**.

## The catalogue lives in the database

The storefront is **not** a static mockup any more. `public/app.js` fetches
`GET /api/store/products?limit=100` and `GET /api/store/categories` and builds
the grid, the filter buttons and the nav links from that response. The admin
console is the single source of truth: add a product, change its image, or
reorder it there, and the storefront follows.

- `Product.position` (default `9999`) is the curated storefront order. The
  admin product form has a **Position** field for it.
- `Product.tags[0]` becomes the corner badge (`bestseller` → `BESTSELLER`).
- The colour shown under the product name comes from the first
  `ProductVariant.color`.
- `Product.basePrice` is a `Decimal`, so it arrives as a string and is
  converted with `Number()`.
- The cart and the wishlist are keyed by product **slug** (not the old
  numeric id), and entries that are no longer in the catalogue are dropped on
  load.
- The category order follows the curated product order (Clothing, Shoes, Bags,
  Accessories), not alphabetical order.

Run `npm run seed` to restore the 12 demo products with their images,
positions, tags and colours.

## Homepage settings

The home page is editable in the admin console: **Admin → Homepage**. The
hero image, the story image and all the headline copy on the home page are
stored in the database, so the admin console is the single source of truth
here as well.

| Where | What |
|---|---|
| `Homepage` (Prisma model, one row with `id = 1`) | the editable content |
| `GET /api/store/homepage` | public read, used by the storefront |
| `PATCH /api/admin/homepage` | authenticated write (ADMIN / MANAGER) |
| `POST /api/admin/homepage/reset` | puts the default copy and images back |
| `server/src/services/homepage.js` | the schema, the defaults and the db helpers |
| `public/app.js` → `loadHomepage()` | fetches the content and applies it to the DOM |
| `public/index.html` | the static markup, used as the fallback |

- The markup in `public/index.html` is the **fallback**: if the API cannot be
  reached, the home page still renders with its built-in copy and images.
- Leaving an image field empty in the admin keeps the default image
  (`/images/hero.jpg` and `/images/story.jpg`).
- "Restore defaults" resets the content but never touches your files in
  `public/images/`.
- `npm run seed` only **creates** the row if it is missing, so re-seeding
  never overwrites what you typed in the admin console.

## Notes on this setup

- `env.sh` / `env.cmd` point every cache, temp dir and toolchain path at F:.
- `start.sh` reads `PORT` and `DATABASE_URL` from `.env`, so `.env` stays the one
  place to change them.
- `public/admin/admin.js` resolves its API base from `window.location.origin`
  instead of a hardcoded `http://localhost:4000`, so the admin console follows
  whatever port the API runs on. Set `localStorage.formeApiUrl` to override.
- `package.json` carries a `prisma.schema` entry so `npm run prisma:*` works from
  the project root.

## Not connected yet

Payment gateway + signed webhooks, carrier shipping rates/labels/tracking,
tax/VAT/GST and duties, live FX, transactional email, customer self-service and
password reset, image storage/CDN, and deployment hardening. The storefront
checkout is a demo and does not create an order.
