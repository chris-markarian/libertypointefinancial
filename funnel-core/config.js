// Shared settings for every Liberty Pointe educational funnel.
// Everything marked [CONFIRM] needs Chris / compliance sign-off before launch.
window.LPF_FUNNEL_CONFIG = {
  // Mock mode (fake scheduler, browser-only storage) runs ONLY on these hosts.
  // On any other host (including libertypointefinancial.com) the booking
  // step shows a "not open yet" notice and collects nothing.
  mockHosts: ['localhost', '127.0.0.1'],
  mockHostPattern: /^(deploy-preview-\d+|[a-z0-9-]+)--beautiful-mermaid-c318fb\.netlify\.app$/,

  // Appointment buyers (the licensed professionals who conduct consultations).
  buyers: {
    dave_weiner: {
      name: 'Dave Weiner',
      agency: 'Global Renaissance Insurance Marketing Agency',
      title: 'Licensed insurance professional',
      npn: '[CONFIRM: NPN]',
      licensedStatesText: '[CONFIRM: states where Dave is licensed]',
      bio: '[CONFIRM: short bio approved by Dave, e.g. years in practice and focus on in-force policy reviews]',
      photo: null, // e.g. '/funnel-core/dave-weiner.jpg' once supplied
      // null = not confirmed yet, so every state is allowed in the preview.
      licensedStates: null
    }
  },

  // Segments. Each funnel declares its segment id in its own segment.js;
  // every appointment record carries it so segments can be compared.
  // status: 'preview' (built, not live) | 'planned' (not built) | 'live'.
  segments: {
    iul_policy_review: {
      label: 'A: Existing IUL owners', offer: 'Professional IUL Policy Review',
      basePath: '/iul-policy-review', buyer: 'dave_weiner', status: 'preview'
    },
    iul_education: {
      label: 'B: Prospective IUL buyers', offer: 'IUL Education & Consultation',
      basePath: '/iul-education', buyer: 'dave_weiner', status: 'planned'
    }
  },

  meeting: { minutes: 30, formats: ['Phone call', 'Video call'] },

  consentVersion: 'booking-consent-DRAFT-2026-10-22',
  phoneDisplay: '(385) 526-4220'
};
