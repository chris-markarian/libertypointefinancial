// Shared settings for Liberty Pointe educational funnels.
// Everything marked [CONFIRM] needs Chris / compliance sign-off before launch.
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
      npn: '[CONFIRM: NPN]',
      bio: '[CONFIRM: short bio approved by Dave, e.g. years in practice and focus on in-force policy reviews]',
      photo: null // e.g. '/funnel-core/dave-weiner.jpg' once supplied
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
      licensedStates: null,          // e.g. ['UT','AZ'] once verified
      licensedStatesVerified: false,
      licensedStatesText: '[CONFIRM: states where Dave is licensed]',
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
      status: 'planned',
      recipient: 'dave_weiner',
      recipientConfirmed: false,
      licensedStates: null,
      licensedStatesVerified: false,
      licensedStatesText: '[CONFIRM: states where Dave is licensed]',
      durationMinutes: null,         // [CONFIRM with Dave]
      formats: ['Phone call', 'Video call'],
      availability: { weekdays: [], hours: [], timezone: null, confirmed: false },
      acceptanceCriteria: [],        // [CONFIRM with Dave] see Segment B brief
      acceptanceCriteriaConfirmed: false,
      consentPurpose: 'confirm, prepare for, and conduct my IUL education consultation',
      meetingNoun: 'consultation'
    }
  },

  consentVersion: 'booking-consent-DRAFT-2026-10-22',
  phoneDisplay: '(385) 526-4220'
};

// What's missing before a category can take bookings or be published.
window.LPF_CONFIG_PROBLEMS = function (cfg, catId) {
  var c = cfg.categories[catId];
  if (!c) return ['Unknown appointment category: ' + catId];
  var p = [];
  if (!c.recipient || !cfg.recipients[c.recipient]) p.push('No recipient configured');
  else if (!c.recipientConfirmed) p.push('Recipient has not confirmed this category');
  if (!c.licensedStatesVerified || !c.licensedStates || !c.licensedStates.length) p.push('Licensed states not verified');
  if (!c.durationMinutes) p.push('Appointment duration not set');
  if (!c.availability || !c.availability.confirmed || !c.availability.weekdays.length || !c.availability.hours.length || !c.availability.timezone) p.push('Availability not confirmed');
  if (!c.acceptanceCriteriaConfirmed || !c.acceptanceCriteria.length) p.push('Acceptance criteria not confirmed');
  if (!c.consentPurpose) p.push('Consent purpose wording missing');
  var r = cfg.recipients[c.recipient];
  if (r && /^\[CONFIRM/.test(r.npn)) p.push('Recipient NPN missing');
  return p;
};
