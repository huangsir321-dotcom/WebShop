# FORME — Global Fashion Commerce Platform

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/YOUR_GITHUB_USERNAME/forme-commerce-platform)

A responsive, editorial-style fashion storefront bundled with an Express API, PostgreSQL/Prisma data model, and admin console. Built as a deployable development baseline; external merchant services still require merchant credentials and market-specific configuration.

## What's included

### Storefront (`public/`)
- Responsive fashion storefront for clothing, shoes, bags and accessories
- Product search, category filters, sorting, product cards and wishlist
- Shopping bag with quantity controls and browser persistence
- Currency display selector (fixed illustrative rates; **not** for settlement)
- Demo checkout screen, newsletter interaction and responsive mobile navigation
- Editorial typography, large imagery, motion, reduced-motion support

### API (`server/src/index.js`)
- Health endpoint and public product/category endpoints
- Admin login with bcrypt password hashes, JWT authentication and role checks
- Admin product CRUD/archive, order status/tracking updates, customer list, inventory adjustment, coupons, reporting and audit log endpoints
- Checkout order creation with server-side product price lookup, inventory reservation in a transaction, and optional coupon validation
- Security headers, request logging, input validation, consistent API errors

### Data model (`server/prisma/schema.prisma`)
Admins/roles, customers, category tree, products, SKU variants, multi-location inventory, inventory movements, orders/order items, coupons, payment events, shipping rates, audit logs and the home page content (a single `Homepage` row).

## Deploy

The repository carries everything needed to run it somewhere else:

| File | What it does |
|---|---|
| `Dockerfile` | Builds the API + storefront into one image |
| `docker-compose.yml` | That image plus a PostgreSQL 16 database |
| `render.yaml` | Render blueprint — a web service and a managed database |
| `.github/workflows/ci.yml` | Runs the unit tests and builds the image on every push |

**Render (one click).** Press the button at the top of this file, sign in
with GitHub, and Render creates the service and the database. It asks for
three values: `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `CORS_ORIGIN`. The admin
account is created on the first boot with those credentials, and the
database schema is applied automatically on every start.

**Any Docker host.** `docker compose up --build` brings the whole site up on
<http://localhost:4000>. On a server, put a reverse proxy in front of it and
terminate TLS there.

[`DEPLOY.md`](DEPLOY.md) has the step-by-step version in Chinese, including
what to change before exposing the app and what the free tiers limit.

## Run locally

> This checkout runs the **local v3 stack** (port 4100, its own PostgreSQL
> cluster on 5433, everything on the F: drive). Start it with `./start.sh`
> (Git Bash) or `start.cmd`. The full Chinese operating manual — starting,
> stopping, signing in, adding images, changing products, changing the home
> page, command reference, troubleshooting — is in
> [`public/images/README.txt`](public/images/README.txt); the English
> environment notes are in [`SETUP.md`](SETUP.md).

Requirements: Node.js 22+, Docker Desktop (for PostgreSQL), and npm.

1. Copy `.env.example` to `.env` and set a long random `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. Change the development database password for non-local environments.
2. Start PostgreSQL: `docker compose up -d db`
3. Install dependencies: `npm install`
4. Generate Prisma client: `npm run prisma:generate`
5. Create tables: `npm run db:push`
6. Seed demo catalog: `npm run seed`
7. Start API and storefront: `npm run dev`
8. Open `http://localhost:4000`. API health: `http://localhost:4000/health`.

To run the API in Docker, ensure `.env` exists first, then run `docker compose up --build`. The compose database host is `db`; the example DATABASE_URL is intended for local host execution, so for Compose set `DATABASE_URL=postgresql://forme:YOUR_PASSWORD@db:5432/forme?schema=public`.

## Cross-border operations added in v0.4

- `/api/integrations/status` explicitly reports provider readiness.
- `POST /api/store/shipping-quote` returns only merchant estimates if configured; it does not call a carrier.
- `POST /api/store/tax-quote` uses active manual tax rules only; no rule means unconfigured/zero estimate and must not be used as live tax advice.
- `POST /api/store/returns` records a return request after order/email/item validation.
- Admin endpoints cover return review, refund request records, shipment records and manual tax-rule management. Creating a refund record does not transfer funds; shipment records do not purchase labels.
- Payment adapter deliberately returns HTTP 503 until a provider implementation, credentials and verified webhooks are built and tested.
- English, Simplified Chinese, French, German and Spanish locale selector is present, but storefront translation coverage is partial.
- `npm test` runs unit tests for the disabled payment boundary and shipping/tax estimate behavior.

## Key API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Service health |
| GET | `/api/store/categories` | Public categories |
| GET | `/api/store/products` | Public product listing/search |
| GET | `/api/store/products/:slug` | Public product details |
| GET | `/api/store/homepage` | Public home page content (hero + story) |
| POST | `/api/store/checkout` | Creates an unpaid order and reserves configured SKU stock; does not charge a payment method |
| POST | `/api/auth/login` | Admin login |
| GET | `/api/admin/dashboard` | Dashboard metrics |
| GET/POST/PATCH/DELETE | `/api/admin/products` | Product operations (DELETE archives) |
| GET/PATCH | `/api/admin/homepage` | Read / update the home page content |
| POST | `/api/admin/homepage/reset` | Restore the default home page content |
| GET/PATCH | `/api/admin/orders` | List/update orders |
| GET | `/api/admin/customers` | Customer listing/search |
| GET/POST | `/api/admin/inventory` | Inventory listing/adjustment (POST adjustment uses `/:id/adjust`) |
| GET/POST | `/api/admin/coupons` | Coupon listing/creation |
| GET | `/api/admin/reports/summary` | Revenue/order/product summary |
| GET | `/api/admin/audit` | Admin audit trail |

Admin routes require `Authorization: Bearer <token>`. API JSON schemas are validated using Zod.

## Implementation status and honest launch boundary

**Included in code:** storefront prototype, admin API, data model, authentication/roles, catalog and inventory management endpoints, order status management, coupon CRUD, reports, audit trail, transactional order record creation and stock reservation.

**Not live / requires additional work before taking real orders:** payment gateway integration and signed webhooks; shipping-rate quote, labels and tracking integrations; tax/VAT/GST and duties calculation; real-time FX; production email delivery; account self-service and password reset; complete admin web UI coverage for every API function; SKU/variant management UI; product-image storage/CDN; automated integration/security/accessibility/load tests; monitoring/backups and deployment hardening. The current storefront checkout is explicitly a demo and is not connected to the order API yet. The API checkout creates unpaid orders only and must not be presented as a paid checkout.

No payment or shipping provider is represented as connected. Provider selection depends on the legal entity's registration country, target markets, currencies and payout eligibility.


See [`docs/IMPLEMENTATION-STATUS.md`](docs/IMPLEMENTATION-STATUS.md) for a detailed implementation matrix, non-connected integrations, and required launch gates.
