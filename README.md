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
- Responsive website with cleaner DM Sans / Manrope typography, a custom inline film-camera illustration, mobile-first layouts, accessible focus states, and bottom-sheet forms on small screens. Footer policy centre includes draft Terms, Privacy, Cancellation & Refunds, and Crew & Payouts policies; registration records acceptance of the current draft terms version.
- Account registration and login for client and crew account types. Passwords are hashed with bcrypt; sessions use random tokens stored as hashes in PostgreSQL and HttpOnly SameSite cookies.
- Authenticated client-only booking requests and authenticated crew-only applications. Client booking history is loaded from the database.
- 10% client service fee, 10% crew commission, full-day date ranges, and half-day bookings at 50% of the daily rate.
- Overtime terms are captured as proposed terms; they must be agreed by client and crew before a booking is confirmed.
- Crew payout policy is after project completion, subject to provider capability and the platform's dispute/refund policy.

## Deploy to Railway

1. Extract the ZIP on your computer.
2. Create a new Railway project and choose **Deploy from GitHub repo** (recommended). Push this folder to a new GitHub repository, then select that repository in Railway. Alternatively, use Railway's supported CLI deployment flow from this folder.
3. In Railway, add a **PostgreSQL** database service to the project.
4. In the web service Variables, add `DATABASE_URL` by referencing the PostgreSQL service's `DATABASE_URL` variable. Railway may offer an “Add Reference” picker.
5. Add `CMA_ADMIN_TOKEN` as a long, random secret (needed to use admin API endpoints). Do not put it in the HTML, Git repository, or share it publicly. Generate one locally with `openssl rand -hex 32`.
6. Set `NODE_ENV=production` in Railway Variables so session cookies use the `Secure` flag over HTTPS.
7. Set `PAYMENTS_ENABLED=false`. Bachs.io checkout and payouts are not connected; this flag does not implement payments.
8. Do not manually set `PORT` on Railway unless you have a specific reason; Railway injects it.
9. Deploy. Railway runs `npm start` automatically. Open the generated public domain.
10. Test `https://YOUR-DOMAIN/api/health`; it should return `ok: true` and `database: "connected"`.

Node.js 20+ is required. Railway will install packages using `package.json`. The app binds to `0.0.0.0` and uses Railway's `PORT` variable.

## Authentication API

- `POST /api/auth/register` — `{ "name": "Your Name", "email": "you@example.com", "password": "minimum10chars1", "accountType": "client" }` (or `crew`).
- `POST /api/auth/login` — `{ "email": "you@example.com", "password": "..." }`; successful login sets an HttpOnly session cookie.
- `GET /api/auth/me` — current account or `user: null`.
- `POST /api/auth/logout` — revoke the current session.
- `GET /api/my/bookings` — authenticated client booking history.

Passwords must be at least 10 characters and contain at least one letter and one number. Registration and login endpoints have a separate rate limit. Cookie sessions are stored in PostgreSQL as SHA-256 hashes; passwords are hashed with bcrypt. This is not a substitute for a security audit.

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

Booking requests are **not confirmed bookings**. Payment status is `not_configured`; no payment is collected. The client dashboard reads the authenticated user’s persisted bookings from `GET /api/my/bookings`.

## Important limitations before public use

- Email verification, password reset, MFA, account deletion, privacy export, and a full admin dashboard are not implemented. Treat this as a test release until those operational features and policies are added. Registration currently establishes a session immediately; verify users before relying on account ownership.
- The admin API is token protected, but a proper admin UI, token rotation, audit logs, and stronger operational controls are still needed. Sessions expire after seven days; users can log out to revoke their current session.
- Bachs.io checkout, webhook signature verification, refunds, disputes, and crew payout integration are **not implemented**. Do not set `PAYMENTS_ENABLED=true` as that flag alone does not enable payments.
- Before collecting real money, confirm Bachs sandbox/live credentials and support for marketplace delayed transfers/payouts. A browser redirect is not proof of payment; verified provider webhooks must be the source of truth. Never claim escrow unless both provider and legal arrangements support it.
- Replace seeded profiles, names, rates, and ratings with verified real data before public launch. Add privacy/terms/cancellation policies and obtain appropriate legal review.

## Environment variables

See `.env.example`. Configure these in the Railway **backend service** Variables:

- `DATABASE_URL`: required; use Railway's PostgreSQL variable reference, not a hard-coded credential.
- `CMA_ADMIN_TOKEN`: required to use the admin API; generate with `openssl rand -hex 32` and keep secret. The app can start without it, but admin endpoints remain disabled.
- `NODE_ENV=production`: recommended in Railway so session cookies have the `Secure` attribute.
- `PAYMENTS_ENABLED=false`: keep false. Setting it to true does not implement Bachs.io payments.
- `PORT`: supplied by Railway; usually do not set manually.

## Legal policy centre

The footer provides Terms of Service, Privacy Policy, Cancellation & Refunds, and Crew & Payouts policy drafts. These are starter templates, not legal advice. Before launch, replace placeholders with the operator's legal identity, support contact, final cancellation/refund schedule, retention periods, governing law, and applicable privacy disclosures; have them reviewed by a qualified lawyer. Registration requires acceptance and stores a draft policy version and timestamp. If you change the terms, update the version identifier in `server.js` and ensure users accept the new version as appropriate.

## Security review notes

This update adds a restrictive Content Security Policy (the current inline event-handler architecture still requires `unsafe-inline` for scripts), same-origin checks for browser write requests, HTML escaping for database-backed profile and booking text, safe cookie parsing, constant-time admin token comparison, and a separate admin API rate limit. It does not replace a professional security review.

Remaining launch blockers include email verification, password reset, MFA, a real admin dashboard, admin token rotation/audit logs, stronger account lifecycle and privacy controls, persistent distributed rate limiting if scaled to multiple replicas, verified crew/profile workflows, and the Bachs.io checkout/webhook/refund/payout implementation. Test with non-sensitive data only until these are complete.

## Admin dashboard and account moderation

Open `/admin.html` on your deployed Railway domain. The dashboard is publicly reachable as a page, but its data and actions are protected by the `CMA_ADMIN_TOKEN` server-side variable; the token is not shipped in the marketplace HTML. Use a long random token, keep it private, and rotate it immediately if it is exposed. The browser keeps the token in `sessionStorage` for the current tab session; use **Lock console** on shared computers.

The admin console provides:
- Account overview counts and review queue.
- Search and filter by approval state, suspicious flag, suspension, and verification state.
- Approve or reject an account; mark or remove manual verification; flag or clear suspicious activity; suspend or reactivate an account; add internal notes.
- Suspension and rejection revoke active login sessions. Suspended accounts are blocked from signing in and existing sessions are revoked.
- Audit log of account actions, target account, timestamp, and request IP address.
- Existing booking and crew-application review tables.

Newly registered client and crew accounts start in `pending_review`. They may sign in, but booking and crew-application submission require an approved account. Existing accounts are migrated as approved to avoid unexpectedly locking out pre-existing users. The `is_verified` flag is a manual administrative label; the dashboard does not perform identity-document or liveness checks. Do not mark someone verified unless your team has actually completed its verification procedure. A suspicious flag is a review signal, not proof of wrongdoing.

Before launch, consider replacing the shared admin token with named administrator accounts, MFA, role-based access, and a managed audit trail. Do not use the shared token on public/shared devices. The current dashboard is a first administrative console, not a complete compliance or identity-verification system.
