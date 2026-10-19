# Security and link review — test release

Review date: 2026-10-19

## Checks performed

- Node.js backend syntax check: passed (`node --check server.js`).
- Inline browser JavaScript syntax check: passed (`node --check` on extracted inline script).
- Internal anchor audit: no broken hash links found; no duplicate HTML IDs found.
- Legacy footer text `Demo marketplace · Sample profiles and pricing · Payments not connected`: removed.
- Registration requires Terms/Privacy acknowledgement; backend records the acceptance timestamp and draft policy version.
- User-controlled profile and booking strings are HTML-escaped before insertion into the page.
- Helmet security headers/CSP, same-origin write-request checks, request-size limits, general/auth/admin rate limits, safe cookie parsing, and constant-time admin token comparison are configured.

## Important limits

- This was a source-level review and syntax/link audit, not a full penetration test or an independent security certification.
- Live external URL checks could not be completed from the build environment because external DNS/network access was unavailable. Google Fonts therefore remain an external dependency; the system font stack provides a fallback.
- CSP still permits inline scripts because the current page uses inline scripts and event-handler attributes. For a stronger policy, move JavaScript to external files, remove inline event handlers, and remove `unsafe-inline` from `script-src`.
- Rate limiting currently uses the process-local default store; use a shared store if deploying multiple replicas.
- There is no email verification, password reset, MFA, full admin dashboard, account deletion/export workflow, or admin audit log.
- Payment processing, Bachs.io webhook verification, refunds, dispute operations, and real crew payouts are not implemented. Keep `PAYMENTS_ENABLED=false`.
- The policy text is a starter template and includes placeholders that must be completed and reviewed by qualified counsel before launch.
- The sample crew profiles and ratings are illustrative and must not be presented as real or verified professionals.

## Suggested smoke tests after Railway deploy

1. `GET /api/health` reports database connected.
2. Registration without checking the policy checkbox is rejected.
3. Registration with consent succeeds and records the account.
4. Duplicate email registration is rejected.
5. Login with the wrong password returns a generic error.
6. Client account can create and retrieve only its own bookings.
7. Crew account cannot create client bookings.
8. A write request from a different browser origin is rejected.
9. Admin routes reject missing/incorrect tokens and accept the correct secret only from a secure operator workflow.
10. Test policy modal links, mobile layout, date selection, half-day/full-day price calculation, and keyboard Escape/close behavior.
