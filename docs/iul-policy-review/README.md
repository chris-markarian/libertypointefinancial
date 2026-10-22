# IUL policy review funnel

Status: **preview only**. Not approved for production. Wording is pending compliance review.

## Consumer journey

| Step | URL | What happens |
|---|---|---|
| 1. Landing | `/iul-policy-review/` | Educational 7702 content, video (placeholder player), what a review covers, how it works, who conducts it, FAQ, disclosures. |
| 2. Qualification | `/iul-policy-review/qualify/` | Six questions: owns an IUL, who owns it, issue period, state, premium range, has a statement. Answers stay in `sessionStorage`. |
| 2b. Not a fit | `/iul-policy-review/not-a-fit/` | Shown for "no IUL", "someone else owns it", or (once configured) an unlicensed state. Nothing is saved. The reason is kept out of the URL so page-view analytics can't see it. |
| 3. Meet Dave and book | `/iul-policy-review/book/` | Introduction to Dave Weiner / Global Renaissance Insurance Marketing Agency, disclosures, scheduler, contact details, required share consent (§C) and optional SMS consent. |
| 4. Confirmed | `/iul-policy-review/confirmed/` | Appointment summary, add-to-calendar (.ics), cancel, what to have ready. |
| Internal | `/funnel-core/preview-tracker/` | Cross-segment mock status tracker and segment comparison. Works only on preview hosts. |

## Architecture: shared core + segments

Two consumer segments share one booking, consent, privacy and tracking core:

| Segment | id | Path | Status |
|---|---|---|---|
| A: Existing IUL owners | `iul_policy_review` | `/iul-policy-review/` | preview (this PR) |
| B: Prospective IUL buyers | `iul_education` | `/iul-education/` | planned, not built |

- `funnel-core/config.js`: buyer registry (Dave Weiner / GRIMA), segment registry (label, offer, path, buyer, status), meeting settings, consent version, mock-host rules.
- `funnel-core/funnel.js`: qualification runner, booking + consent capture, mock storage, confirmation/.ics, status machine, tracker, event tracking. Reads the page's segment from `window.LPF_SEGMENT`.
- `funnel-core/funnel.css`: shared styles.
- `<segment>/segment.js`: the segment's questions, eligibility rules, not-a-fit messages, video and calendar wording.
- `<segment>/*.html`: the segment's own copy (landing, qualify, book, confirmed, not-a-fit).

Adding segment B means a new folder with `segment.js` and pages, a `_headers` block for `/iul-education/*`, and flipping its status in `config.js`. The core doesn't change.

## Safety rails in this build

- **No lead data leaves the browser.** No Netlify Forms, no Netlify function calls, no third-party requests (the e2e test asserts this). This matters because `submission-created.js` fires on *every* Netlify Forms submission and texts the lead Chris's Calendly link, and it builds the notification email with unescaped input.
- **Mock mode only on preview hosts** (`localhost`, `*--beautiful-mermaid-c318fb.netlify.app`). On `libertypointefinancial.com` or any other host, the booking step shows "Online booking isn't open yet" and collects nothing, and the tracker is disabled. An accidental merge can't expose the mock scheduler to consumers.
- `noindex` on every funnel page plus `X-Robots-Tag`.
- `_headers` adds a strict CSP and other security headers to `/iul-policy-review/*` only. All scripts are external files; DOM is built with `textContent` (no HTML injection).
- No Meta Pixel on funnel pages. PR #1 (Pixel) must still follow PR #2 (privacy).

## Appointment status tracking design

### Statuses

| Status | Meaning | Set by |
|---|---|---|
| `booked` | Consumer picked a time and gave the required consent. | System (scheduler webhook) |
| `qualified` | Liberty Pointe verified the booking meets the buyer's criteria: owns an IUL, is the owner/trustee, licensed state, contact details reachable. | LPF verifier |
| `accepted` | Dave's agency accepted the appointment under the buyer agreement. | Buyer (Dave / GRIMA) |
| `held` | The review took place. | Buyer, or system if the meeting tool reports it |
| `rejected` | Failed verification or declined by the buyer. Requires a reason code. | LPF verifier or buyer |
| `no_show` *(recommended)* | Consumer didn't attend. Can be rebooked. | Buyer |
| `cancelled` *(recommended)* | Consumer or LPF cancelled. | Consumer / system / LPF |

Allowed transitions:

```
booked    -> qualified | rejected | cancelled
qualified -> accepted  | rejected | cancelled
accepted  -> held | no_show | rejected | cancelled
no_show   -> booked (rebook) | cancelled
held, rejected, cancelled: final
```

Rejection reason codes: `no_iul_policy`, `not_policy_owner`, `outside_licensed_state`, `invalid_contact`, `duplicate`, `consumer_declined`, `other`.

### Record shape

```json
{
  "id": "APT-…",
  "segment": "iul_policy_review", "offer": "Professional IUL Policy Review", "buyer_id": "dave_weiner",
  "status": "booked",
  "status_history": [{ "status": "booked", "at": "ISO time", "actor": "consumer|system|lpf_verifier|buyer_dave", "reason": "code?", "note": "text?" }],
  "slot_start": "ISO time", "duration_minutes": 30, "format": "Phone call|Video call",
  "professional": { "name": "Dave Weiner", "agency": "Global Renaissance Insurance Marketing Agency" },
  "contact": { "first_name": "", "last_name": "", "email": "", "phone": "", "state": "UT" },
  "qualification": { "answers": { "owns_iul": "", "owner_role": "", "issue_period": "", "state": "", "annual_premium": "", "has_statement": "" }, "flags": [] },
  "consents": {
    "share_with_professional": { "given": true, "at": "ISO time", "version": "booking-consent-…", "text": "exact wording shown" },
    "sms": { "given": false, "at": "ISO time", "version": "…", "text": "…" }
  },
  "outcome": { "application_submitted": null, "funded": null, "annual_target_premium": null, "reported_at": null },
  "source": { "utm_source": null, "utm_medium": null, "utm_campaign": null, "page": "/iul-policy-review/book/" }
}
```

Every record carries `segment`, so the tracker compares segments side by side: cost per booking (from ad spend), qualified rate, buyer acceptance rate, attendance (held vs no-show), funded cases and cost per funded case. `outcome` is filled from buyer reporting after the review.

The status history is append-only so billing disputes with the buyer can be settled from the log. The exact consent text and version are stored with each record (TCPA / consent evidence).

### Production architecture (needs Chris's approval; nothing created)

1. **Scheduler:** Calendly Teams (or similar) with Dave's calendar, routing form for the six questions, and the §C consent in the booking form. Its webhooks (`invitee.created`, `invitee.canceled`, no-show) set `booked` / `cancelled` / `no_show`.
2. **Webhook receiver:** a new Netlify function that verifies the scheduler's webhook signature and writes to the database. It must not reuse `submission-created.js` / `lead-notify.js`, and any email it sends must HTML-escape input.
3. **Database:** Supabase table `appointments` plus `appointment_events` (append-only), row-level security, service-role key only in Netlify environment variables, never in the browser.
4. **Tracker:** authenticated page (Supabase Auth or Netlify Identity) with two roles: LPF verifier and buyer. The buyer only sees their own appointments.
5. **Analytics:** consent-gated. Funnel events (`landing_view`, `qualify_pass`, `booking_complete`, …) are already defined in `funnel.js` and log to the console only in preview. Never send contact details or qualification answers to Meta.

## Approvals and inputs still needed

- Compliance review of: landing copy, 7702 educational section, disclosures, §C share consent, SMS consent, footer disclosure, privacy additions (and PR #2).
- Dave: NPN, licensed states (then set `licensedStates` in `config.js`), approved bio and photo, time zone and availability, phone vs video.
- Buyer agreement terms: which status is billable (`accepted` or `held`), qualification criteria (minimum premium? age?), rejection window.
- Video file or YouTube/Vimeo id (set `video` in `config.js`).
- Services: scheduler, database, and auth choices above. SMS sender for appointment texts (Twilio 10DLC campaign currently covers Liberty Pointe only).
- Meta ads: confirm whether IUL ads fall under Meta's special ad category for financial products and services, which limits targeting.
- Existing security issues to fix before any live intake: public repo personal info, unauthenticated `chat` and `parse-illustration` functions, unescaped lead emails in `submission-created.js` / `lead-notify.js`.

## Testing

```
python3 -m http.server 8811            # from repo root
NODE_PATH=$(npm root -g) BASE=http://localhost:8811 node tests/iul-policy-review.e2e.js
NODE_PATH=$(npm root -g) BASE=https://deploy-preview-N--beautiful-mermaid-c318fb.netlify.app node tests/iul-policy-review.e2e.js
```

The test walks the whole journey, checks disclosures and consent, the not-a-fit path, the tracker transitions, production-host lockout, mobile layout, existing pages, CSP errors, and that no request leaves the site.
