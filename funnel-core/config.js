// Shared settings for Liberty Pointe educational funnels.
// Everything marked [CONFIRM] needs Chris / compliance sign-off before launch.
(function () {
// Dave Weiner's licensed jurisdictions as provided by Chris on 2026-10-22.
// Not yet checked against NIPR / state DOI records (see license below).
var DAVE_STATES = ['AL', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NV', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI'];

window.LPF_FUNNEL_CONFIG = {
  // Mock mode (fake scheduler, browser-only storage) runs ONLY on these hosts.
  // On any other host (including libertypointefinancial.com) the booking
  // step shows a "not open yet" notice and collects nothing.
  mockHosts: ['localhost', '127.0.0.1'],
  mockHostPattern: /^(deploy-preview-\d+|[a-z0-9-]+)--beautiful-mermaid-c318fb\.netlify\.app$/,

  // Real booking is off everywhere until a scheduler/database is approved
  // and connected. Even then, a category only books with a complete config.
  liveBookingEnabled: false,

  // Preview only: let the mock scheduler run with incomplete category config
  // (a warning lists what's missing). Never applies outside mock hosts.
  previewAllowsIncompleteConfig: true,

  // Appointment recipients (who they are; what they accept is per category).
  recipients: {
    dave_weiner: {
      name: 'Dave Weiner',
      agency: 'Global Renaissance Insurance Marketing Agency',
      title: 'Licensed insurance professional',
      legalName: 'David M. Weiner',
      npn: '760178',
      license: {
        states: DAVE_STATES,
        source: 'Provided by Chris on 2026-10-22',
        verifiedAgainstNipr: false,           // NPN + states checked on NIPR / state DOI
        lifeLineOfAuthorityConfirmed: false   // life line of authority in each state
      },
      bio: '[CONFIRM: short bio approved by Dave, e.g. years in practice and areas of focus]',
      photo: '/funnel-core/dave-weiner.jpg', // provided by Chris 2026-10-22 [CONFIRM: Dave approved web use]
    }
  },

  // Appointment categories. Each funnel page names its category in segment.js.
  // status: 'planned' (not built) | 'preview' (built, unpublished) | 'live'.
  // A category may only be 'live' when configProblems() finds nothing
  // (enforced in the browser and by tests/launch-check.js).
  categories: {
    existing_iul_review: {
      segment: 'iul_policy_review',
      label: 'A: Existing IUL owners',
      offer: 'Professional IUL Policy Review',
      basePath: '/iul-policy-review',
      status: 'preview',
      recipient: 'dave_weiner',
      recipientConfirmed: false,
      // Bookings outside these states are refused. Launch also needs the
      // recipient's license verified (see LPF_CONFIG_PROBLEMS).
      licensedStates: DAVE_STATES,
      durationMinutes: 30,
      formats: ['Phone call', 'Video call'],
      availability: { weekdays: [1, 2, 3, 4, 5], hours: [9, 10, 11, 13, 14, 15, 16], timezone: null, confirmed: false },
      acceptanceCriteria: [
        'Owns an in-force indexed universal life policy (universal life of unknown type is verified before qualifying)',
        'Is the policy owner, a trustee of the owning trust, or controls the owning business',
        'Lives in a state where the recipient is licensed',
        'Reachable at the phone or email provided'
      ],
      acceptanceCriteriaConfirmed: false,
      consentPurpose: 'confirm, prepare for, and conduct my IUL policy review',
      meetingNoun: 'review'
    },
    prospective_iul_education: {
      segment: 'iul_education',
      label: 'B: Prospective IUL buyers',
      offer: 'IUL Education & Consultation',
      basePath: '/iul-education',
      status: 'preview',
      recipient: 'dave_weiner',
      recipientConfirmed: false,
      licensedStates: DAVE_STATES,  // same individual license; B acceptance still unconfirmed
      durationMinutes: 30,           // preview default [CONFIRM with Dave]
      formats: ['Phone call', 'Video call'],
      availability: { weekdays: [1, 2, 3, 4, 5], hours: [10, 11, 13, 14, 15, 16, 17], timezone: null, confirmed: false },
      // Preview draft from the Segment B brief. [CONFIRM with Dave]
      acceptanceCriteria: [
        'Does not already own an indexed universal life policy',
        'Is 18 or older',
        'Lives in a state where the recipient is licensed',
        'Reachable at the phone or email provided'
      ],
      acceptanceCriteriaConfirmed: false,
      consentPurpose: 'confirm, prepare for, and conduct my IUL education consultation',
      meetingNoun: 'consultation'
    }
  },

  // Meta Pixel on funnel pages (funnel-core/pixel.js). Off until Chris approves
  // and privacy/consent sign-off is recorded. Never runs on preview hosts.
  // Main-site pages carry their own snippet; funnel pages don't, so there's
  // only ever one initialization per page.
  pixel: {
    id: '1300792072131335',
    enabled: false,
    privacyApproved: false,
    consentApproved: false
  },

  // Standard recipient identification and compensation disclosures. Every
  // funnel page uses these exact sentences ({noun} = review / consultation);
  // the e2e test fails if a page drifts. [CONFIRM: compliance-approved wording]
  disclosures: {
    identity: 'Dave Weiner is an independent licensed insurance professional with Global Renaissance Insurance Marketing Agency. He is not an employee of Liberty Pointe Financial, and Liberty Pointe Financial does not conduct the {noun}.',
    compensation: 'Liberty Pointe Financial provides educational content and appointment-setting services and is compensated by Global Renaissance Insurance Marketing Agency for those services. Dave may earn commissions if you buy an insurance product. The {noun} itself is free.'
  },

  consentVersion: 'booking-consent-DRAFT-2026-10-22',
  phoneDisplay: '(385) 526-4220'
};
})();

// What's missing before a category can take bookings or be published.
window.LPF_CONFIG_PROBLEMS = function (cfg, catId) {
  var c = cfg.categories[catId];
  if (!c) return ['Unknown appointment category: ' + catId];
  var p = [];
  if (!c.recipient || !cfg.recipients[c.recipient]) p.push('No recipient configured');
  else if (!c.recipientConfirmed) p.push('Recipient has not confirmed this category');
  var lic = cfg.recipients[c.recipient] && cfg.recipients[c.recipient].license;
  if (!c.licensedStates || !c.licensedStates.length) p.push('Licensed states not set');
  if (!lic || !lic.verifiedAgainstNipr) p.push('Recipient NPN and licensed states not verified on NIPR / state DOI');
  if (!lic || !lic.lifeLineOfAuthorityConfirmed) p.push('Life line of authority not confirmed');
  if (!c.durationMinutes) p.push('Appointment duration not set');
  if (!c.availability || !c.availability.confirmed || !c.availability.weekdays.length || !c.availability.hours.length || !c.availability.timezone) p.push('Availability not confirmed');
  if (!c.acceptanceCriteriaConfirmed || !c.acceptanceCriteria.length) p.push('Acceptance criteria not confirmed');
  if (!c.consentPurpose) p.push('Consent purpose wording missing');
  var r = cfg.recipients[c.recipient];
  if (r && !/^\d{5,10}$/.test(r.npn || '')) p.push('Recipient NPN missing');
  return p;
};
