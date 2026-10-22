// IUL policy review funnel — settings.
// Everything marked [CONFIRM] needs Chris / compliance sign-off before launch.
window.LPF_FUNNEL_CONFIG = {
  // Mock mode (fake scheduler, browser-only storage) runs ONLY on these hosts.
  // On any other host (including libertypointefinancial.com) the booking
  // step shows a "not open yet" notice and collects nothing.
  mockHosts: ['localhost', '127.0.0.1'],
  mockHostPattern: /^(deploy-preview-\d+|[a-z0-9-]+)--beautiful-mermaid-c318fb\.netlify\.app$/,

  professional: {
    name: 'Dave Weiner',
    agency: 'Global Renaissance Insurance Marketing Agency',
    title: 'Licensed insurance professional',
    npn: '[CONFIRM: NPN]',
    licensedStatesText: '[CONFIRM: states where Dave is licensed]',
    bio: '[CONFIRM: short bio approved by Dave, e.g. years in practice and focus on in-force policy reviews]',
    photo: null // e.g. '/iul-policy-review/dave-weiner.jpg' once supplied
  },

  // null = not confirmed yet, so every state is allowed in the preview.
  // Set to an array of postal codes (e.g. ['UT','AZ']) once confirmed.
  licensedStates: null,

  // Video: leave provider null for the placeholder player.
  // provider: 'youtube' | 'vimeo' | 'file'; id = YouTube/Vimeo id or file URL.
  video: { provider: null, id: null, title: 'Why IUL owners are reviewing their policies' },

  meeting: { minutes: 30, formats: ['Phone call', 'Video call'] },

  consentVersion: 'booking-consent-DRAFT-2026-10-22',
  phoneDisplay: '(385) 526-4220'
};
