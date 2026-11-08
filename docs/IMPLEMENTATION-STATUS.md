# FORME implementation and launch readiness

Last reviewed: 2026-10-25. This is a codebase status document, not a legal, tax, security or production-readiness certification.

## Implemented in this repository

- Responsive editorial storefront and browser-persisted demo cart/wishlist.
- Lightweight storefront interface localization selector for English, Simplified Chinese, French, German and Spanish. Translation coverage is partial; product catalog, checkout, email templates, SEO and legal pages still need locale-aware content management.
- Express API, PostgreSQL/Prisma data model, JWT admin auth, bcrypt password hashes, role checks, Zod input validation, Helmet, CORS allow-list, request body limits, login attempt throttling and audit trail.
- Product/category endpoints and admin product, order, customer, inventory, coupon and reporting endpoints.
- Transactional unpaid order creation with stock reservation in the existing checkout API. It does not collect money. Stock reservation expiry/release worker is not implemented.
- Return request intake and admin status updates; refund request records; shipment records for own warehouse, supplier dropship and overseas warehouse; shipping estimate adapter; reviewed-rule-only tax estimate adapter; integration readiness endpoint.
- Docker Compose for PostgreSQL and API; automated unit tests for payment/shipping/tax adapter boundaries.

## Explicitly NOT connected or NOT production-complete

- Payment provider checkout, signature-verified webhooks, reconciliation, chargebacks and execution of refunds. `PAYMENT_PROVIDER` is informational only; adapter deliberately returns 503 until a real provider implementation and merchant credentials are added.
- Carrier live rates, label purchase, pickup scheduling, address validation, live tracking webhooks, customs forms, duties/tariffs or supplier APIs. Shipping estimate env values are merchant estimates, not carrier quotes.
- Tax/VAT/GST determination, tax registration logic, economic nexus, exemptions, tax remittance, duty calculation or legal review. Tax rules are manual configuration only and default inactive.
- Production email/SMS, customer login/password reset, account deletion/export workflows, consent management platform, full CMS, media storage/CDN, full admin UI for returns/refunds/shipments/tax rules, supplier purchase orders, split shipments and partial fulfillment.
- Full locale coverage and localized product data; accurate live FX/settlement conversion; region-specific legal policy content; accessibility audit; load/penetration testing; operational monitoring, disaster recovery, backups restore tests and production deployment review.
- End-to-end integration tests with PostgreSQL and a sandbox payment/shipping provider.

## Required launch gates

1. Establish the legal merchant entity and verify provider eligibility, payout bank, beneficial-owner/KYC requirements and target-market restrictions.
2. Obtain legal/tax advice for the entity and markets; determine tax collection registrations, consumer cancellation/returns rights, privacy/cookie rules, product labeling, import duties, sanctions/export controls and record-retention requirements.
3. Implement a selected payment provider using official SDKs, signature-verified webhooks, idempotency, reconciliation and sandbox-to-live test plan. Never store PAN/CVV.
4. Implement selected shipping/3PL provider, real quotes/labels/tracking and customs data; test split shipments and supplier fulfillment.
5. Implement tax engine or approved tax service; define whether prices are tax-inclusive, destination rules, rounding and exemptions.
6. Add reservation expiry/release worker, order cancellation/restock, refund state machine, retry-safe webhook processing, email templates and customer order lookup.
7. Run Prisma schema validation, migration tests, API tests against disposable PostgreSQL, browser E2E tests, accessibility checks and security/load tests.
8. Configure TLS, secrets manager, non-default database credentials, least-privilege DB user, production CORS, rate limiting shared across instances, backups/restore, logs/alerts and incident response.

## Environment configuration

Copy `.env.example` to `.env`; generate unique long secrets. Do not commit `.env`. `ADMIN_PASSWORD` is only for first-time bootstrap and should be removed/rotated after provisioning. Set `NODE_ENV=production`, `JWT_SECRET` (32+ random chars), a production database URL, exact `CORS_ORIGIN`, and provider credentials only after the related adapter is implemented and verified. Never expose provider secrets to the browser.
