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
| Internal | `/funnel-core/preview-tracker/` | Cross-category mock status tracker and per-category report. Works only on preview hosts. |

## Architecture: shared core + appointment categories

Kept deliberately small: one shared core, and per-funnel folders for content.

| Category | Originating segment | Path | Status |
|---|---|---|---|
| `existing_iul_review` (Professional IUL Policy Review) | A: existing IUL owners (`iul_policy_review`) | `/iul-policy-review/` | preview (this PR) |
| `prospective_iul_education` (IUL Education & Consultation) | B: prospective buyers (`iul_education`) | `/iul-education/` | preview (built from the Segment B brief; not approved to publish or advertise) |

- `funnel-core/config.js`: recipients (Dave Weiner / GRIMA identity), and per category: recipient + confirmation, verified licensed states, duration, formats, availability, acceptance criteria, consent purpose wording, status (`planned` / `preview` / `live`). `LPF_CONFIG_PROBLEMS` lists what's missing.
- `funnel-core/funnel.js`: qualification runner, attribution capture, booking gate, `createBooking` (re-validates category and eligibility), consent template, mock storage, confirmation/.ics, status machine, category changes, per-category report.
- `<funnel>/segment.js` + pages: that funnel's own copy, questions, eligibility rules and not-a-fit messages. Segment A's page has no prospective-buyer messaging.

**Booking gate.** On the live domain a category books only when live booking is switched on, the category is `live`, and its config is complete. In the preview, incomplete config shows a "would be blocked in production" warning and the record is flagged `config_incomplete_preview`. `node tests/launch-check.js` fails if a `live` category has missing config or if more than one category is live.

**Ineligible visitors.** Non-owners get a not-a-fit page and never enter category A's counts. Once category B is `live`, that page shows a plain link to `/iul-education/`. Nothing carries over: answers are cleared, no consent is reused and no booking is made.

**Consent.** One template, filled per category with the recipient's name and agency and the category's purpose wording. Optional SMS consent stays a separate checkbox. Each record stores the exact text, version, category, purpose and recipient.

**Ad payloads.** `track()` only passes `category`, `where` and `format`. Contact details, answers and case information never go to analytics or ad platforms, and qualification outcomes stay out of URLs.

## Safety rails in this build

- **No lead data leaves the browser.** No Netlify Forms, no Netlify function calls, no third-party requests (the e2e test asserts this). This matters because `submission-created.js` fires on *every* Netlify Forms submission and texts the lead Chris's Calendly link, and it builds the notification email with unescaped input.
- **Mock mode only on preview hosts** (`localhost`, `*--beautiful-mermaid-c318fb.netlify.app`). On `libertypointefinancial.com` or any other host, the booking step shows "Online booking isn't open yet" and collects nothing, and the tracker is disabled. An accidental merge can't expose the mock scheduler to consumers.
- `noindex` on every funnel page plus `X-Robots-Tag`.
- `_headers` adds a strict CSP and other security headers to `/iul-policy-review/*` only. All scripts are external files; DOM is built with `textContent` (no HTML injection).
- No Meta Pixel on funnel pages. PR #1 (Pixel) must still follow PR #2 (privacy).

## Meta Pixel on funnel pages

`funnel-core/pixel.js` is on every funnel page except the internal tracker. It is **off**: it loads nothing unless `config.pixel.enabled`, `privacyApproved` and `consentApproved` are all true, and it never runs on preview hosts.

- One initialization per page. Funnel pages don't carry the main-site snippet, and `pixel.js` does nothing if `fbq` already exists.
- `autoConfig` is set to false before `init`, so Meta doesn't collect button clicks or form fields automatically. `init` passes no user data, so there's no advanced matching. Automatic Advanced Matching must also be off in Events Manager, because that dataset setting applies to the main-site pages too.
- Events: `PageView` on load. `Schedule` only through `LPF_PIXEL.schedule(appointmentId)`, called once from the booking success path. It refuses mock bookings, a missing id, and repeats of the same appointment, and it never runs from the confirmation page. It has no custom data, and `eventID` is the random appointment reference. With the real scheduler, call it from the scheduler's confirmed-booking signal (for example, Calendly's `event_scheduled` message, checked for origin).
- Qualification answers never appear in URLs or event parameters.
- CSP on the funnel paths allows `connect.facebook.net` and `facebook.com` so the pixel works once it's approved. Allowing those hosts sends nothing by itself.
- `tests/pixel.unit.js` checks all of the above. `tests/launch-check.js` fails if the pixel is enabled without recorded approvals.
- Not verifiable from code: whether Meta has classified this dataset as financial services and restricts `Schedule` or other events for it. Check Events Manager → the dataset → any data-restriction notices before enabling.

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
  "originating_segment": "iul_policy_review", "category": "existing_iul_review", "offer": "Professional IUL Policy Review",
  "category_history": [{ "category": "existing_iul_review", "at": "ISO time", "actor": "consumer", "note": "Booked online" }],
  "consent_reconfirmation_required": false,
  "recipient_id": "dave_weiner", "recipient": { "name": "Dave Weiner", "agency": "Global Renaissance Insurance Marketing Agency" },
  "status": "booked",
  "status_history": [{ "status": "booked", "at": "ISO time", "actor": "consumer|system|lpf_verifier|buyer_dave", "reason": "code?", "note": "text?" }],
  "slot_start": "ISO time", "duration_minutes": 30, "format": "Phone call|Video call",
  "professional": { "name": "Dave Weiner", "agency": "Global Renaissance Insurance Marketing Agency" },
  "contact": { "first_name": "", "last_name": "", "email": "", "phone": "", "state": "UT" },
  "qualification": { "answers": { "owns_iul": "", "owner_role": "", "issue_period": "", "state": "", "annual_premium": "", "has_statement": "" }, "flags": [] },
  "consents": {
    "share_with_recipient": { "given": true, "at": "ISO time", "version": "booking-consent-…", "category": "existing_iul_review", "purpose": "…", "recipient_id": "dave_weiner", "text": "exact wording shown" },
    "sms": { "given": false, "at": "ISO time", "version": "…", "text": "…" }
  },
  "outcome": { "application_submitted": null, "funded": null, "annual_target_premium": null, "reported_at": null },
  "attribution": { "utm_source": "facebook", "utm_medium": "paid", "utm_campaign": "…", "utm_content": "ad id", "utm_term": null, "landing_page": "/iul-policy-review/", "referrer_host": null, "first_seen_at": "ISO time" }
}
```

Every record carries `category`, so the tracker reports each category separately: spend, visits (and UTM-attributed visits), bookings, verified-qualified, recipient-accepted, held/attendance, no-shows and cancellations, rejections by reason, funded cases, and cost per booking/qualified/held/funded. Denominators are defined on the tracker page. `outcome` is filled from recipient reporting after the appointment. A category change appends to `category_history` and sets `consent_reconfirmation_required`.

The status history is append-only so billing disputes with the buyer can be settled from the log. The exact consent text and version are stored with each record (TCPA / consent evidence).

### Production architecture (needs Chris's approval; nothing created)

1. **Scheduler:** Calendly Teams (or similar) with Dave's calendar, routing form for the six questions, and the §C consent in the booking form. Its webhooks (`invitee.created`, `invitee.canceled`, no-show) set `booked` / `cancelled` / `no_show`.
2. **Webhook receiver:** a new Netlify function that verifies the scheduler's webhook signature and writes to the database. It must not reuse `submission-created.js` / `lead-notify.js`, and any email it sends must HTML-escape input.
3. **Database:** Supabase table `appointments` plus `appointment_events` (append-only), row-level security, service-role key only in Netlify environment variables, never in the browser.
4. **Tracker:** authenticated page (Supabase Auth or Netlify Identity) with two roles: LPF verifier and buyer. The buyer only sees their own appointments.
5. **Analytics:** consent-gated. Funnel events (`landing_view`, `qualify_pass`, `booking_complete`, …) are already defined in `funnel.js` and log to the console only in preview. Never send contact details or qualification answers to Meta.

## Approvals and inputs still needed

- Compliance review of: landing copy, 7702 educational section, disclosures, §C share consent, SMS consent, footer disclosure, privacy additions (and PR #2).
- Dave's license: NPN 760178 and 46 jurisdictions (45 states + DC; not AK, HI, NE, NH, WY) were provided by Chris on 2026-10-22 and are enforced for eligibility. Before launch, verify them on NIPR / the state DOI and confirm the life line of authority (`license.verifiedAgainstNipr`, `license.lifeLineOfAuthorityConfirmed`). Until then, the license line is hidden on the live site.
- Dave: approved bio and photo, time zone and availability, phone vs video.
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
