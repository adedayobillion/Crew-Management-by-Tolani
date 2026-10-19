# Crew Management Agency — Railway test build

This package contains the website plus a Node.js/Express API backed by PostgreSQL. It is suitable for a **test deployment** on Railway. It is not yet a production payment marketplace.

## Included

- Express backend and PostgreSQL schema created automatically on startup.
- Seeded illustrative crew profiles for test bookings.
- `GET /api/health` database health check.
- `GET /api/config` public commission/payment status.
- `GET /api/professionals` database-backed profile API.
- `POST /api/bookings` stores booking requests and calculates all prices server-side.
- `POST /api/crew-applications` stores crew applications.
- Token-protected admin API endpoints for viewing booking/application submissions and changing booking status.
- Website booking and crew application forms now submit to the API.
- 10% client service fee, 10% crew commission, full-day date ranges, and half-day bookings at 50% of the daily rate.
- Overtime terms are captured as proposed terms; they must be agreed by client and crew before a booking is confirmed.
- Crew payout policy is after project completion, subject to provider capability and the platform's dispute/refund policy.

## Deploy to Railway

1. Extract the ZIP on your computer.
2. Create a new Railway project and choose **Deploy from GitHub repo** (recommended). Push this folder to a new GitHub repository, then select that repository in Railway. Alternatively, use Railway's supported CLI deployment flow from this folder.
3. In Railway, add a **PostgreSQL** database service to the project.
4. In the web service Variables, add `DATABASE_URL` by referencing the PostgreSQL service's `DATABASE_URL` variable. Railway may offer an “Add Reference” picker.
5. Add `CMA_ADMIN_TOKEN` as a long, random secret. Do not put it in the HTML, Git repository, or share it publicly.
6. Keep `PAYMENTS_ENABLED=false`. The Bachs.io payment integration is not implemented yet.
7. Deploy. Railway runs `npm start` automatically. Open the generated public domain.
8. Test `https://YOUR-DOMAIN/api/health`; it should return `ok: true` and `database: "connected"`.

Node.js 20+ is required. Railway will install packages using `package.json`. The app binds to `0.0.0.0` and uses Railway's `PORT` variable.

## Admin API (test use)

Send the secret in the `x-admin-token` header. Never embed this token in the public website.

- `GET /api/admin/bookings` — list the latest booking requests.
- `GET /api/admin/applications` — list crew applications.
- `PATCH /api/admin/bookings/CMA-REFERENCE/status` with JSON `{"status":"awaiting_terms"}` — update a booking status. Allowed values: `awaiting_review`, `awaiting_terms`, `confirmed`, `in_progress`, `completion_review`, `completed`, `disputed`, `cancelled`, `refunded`.

Example health test:

```bash
curl https://YOUR-DOMAIN/api/health
```

Example admin request (run locally, keep token private):

```bash
curl -H "x-admin-token: $CMA_ADMIN_TOKEN" https://YOUR-DOMAIN/api/admin/bookings
```

## Booking API behaviour

The server ignores client-submitted prices and looks up the professional's stored rate. For a full-day booking, the number of days includes both start and end dates. A half-day is 0.5 of the daily rate and uses a single date. The server stores an immutable price snapshot: base rate, 10% client fee, 10% crew commission, client total, crew net and gross agency commission. Currency is NGN and amounts are stored as integer naira for this prototype.

Booking requests are **not confirmed bookings**. Payment status is `not_configured`; no payment is collected. The local demo dashboard only shows requests submitted in the current browser session; use the protected admin API to see persisted submissions across sessions.

## Important limitations before public use

- No user login or role-based customer/crew accounts yet. Public booking and application submission endpoints are rate-limited but do not authenticate submitters. Treat this as a controlled test environment and do not collect highly sensitive information.
- The admin API is token protected, but a proper admin UI, token rotation, audit logs, and stronger operational controls are still needed.
- Bachs.io checkout, webhook signature verification, refunds, disputes, and crew payout integration are **not implemented**. Do not set `PAYMENTS_ENABLED=true` as that flag alone does not enable payments.
- Before collecting real money, confirm Bachs sandbox/live credentials and support for marketplace delayed transfers/payouts. A browser redirect is not proof of payment; verified provider webhooks must be the source of truth. Never claim escrow unless both provider and legal arrangements support it.
- Replace seeded profiles, names, rates, and ratings with verified real data before public launch. Add privacy/terms/cancellation policies and obtain appropriate legal review.

## Environment variables

See `.env.example`. `DATABASE_URL` and `CMA_ADMIN_TOKEN` are required for a Railway deployment. `PORT` is supplied by Railway.
