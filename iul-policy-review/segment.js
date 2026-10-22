// Segment A: existing IUL policyholders. Funnel-specific questions, rules and
// copy; booking, consent, storage and tracking come from /funnel-core/.
window.LPF_SEGMENT = {
  id: 'iul_policy_review',

  // Video: leave provider null for the placeholder player.
  // provider: 'youtube' | 'vimeo' | 'file'; id = YouTube/Vimeo id or file URL.
  video: { provider: null, id: null, title: 'Why IUL owners are reviewing their policies' },

  // Field names on the qualification form, in order.
  questions: ['owns_iul', 'owner_role', 'issue_period', 'state', 'annual_premium', 'has_statement'],

  // Self-reported pre-qualification. Final "qualified" status is set by a
  // person after verification (see tracker).
  evaluate: function (a, buyer) {
    if (a.owns_iul === 'no') return { eligible: false, reason: 'no_iul_policy' };
    if (a.owner_role === 'someone_else') return { eligible: false, reason: 'not_policy_owner' };
    if (buyer.licensedStates && buyer.licensedStates.indexOf(a.state) === -1) return { eligible: false, reason: 'outside_licensed_state' };
    var flags = [];
    if (a.owns_iul === 'unsure') flags.push('policy_type_unverified');
    if (!buyer.licensedStates) flags.push('licensed_states_not_configured');
    return { eligible: true, flags: flags };
  },

  notFitMessages: {
    no_iul_policy: 'This review is designed for people who already own an indexed universal life policy, so it isn’t the right fit today.',
    not_policy_owner: 'Policy reviews need to be requested by the policy owner (or the trustee or business that owns it). If someone in your family owns the policy, they’re welcome to request a review themselves.',
    outside_licensed_state: 'The professional who conducts these reviews isn’t licensed in your state yet, so we can’t schedule a review for you right now.'
  },

  calendarTitle: 'IUL policy review',
  calendarNote: 'Have your most recent annual policy statement handy if you can.'
};
