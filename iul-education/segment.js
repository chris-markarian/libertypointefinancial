// Segment B: prospective IUL buyers. Funnel-specific questions, rules and
// copy; booking, consent, storage and tracking come from /funnel-core/.
window.LPF_SEGMENT = {
  id: 'iul_education',
  category: 'prospective_iul_education',

  // Video: leave provider null for the placeholder player.
  video: { provider: null, id: null, title: 'How indexed universal life insurance works' },

  // Field names on the qualification form, in order. A budget question is
  // added only if the recipient sets a minimum (see the Segment B brief).
  questions: ['owns_iul', 'learning_goal', 'current_coverage', 'age_range', 'state'],

  // Self-reported pre-qualification, re-run when the booking is created.
  evaluate: function (a, cat) {
    if (a.owns_iul === 'yes') return { eligible: false, reason: 'already_owns_iul' };
    if (a.owns_iul !== 'no' && a.owns_iul !== 'unsure') return { eligible: false, reason: 'missing_answer' };
    if (a.age_range === 'under_18') return { eligible: false, reason: 'under_18' };
    if (!a.age_range || !a.state) return { eligible: false, reason: 'missing_answer' };
    if (!cat.licensedStates || cat.licensedStates.indexOf(a.state) === -1) return { eligible: false, reason: 'outside_licensed_state' };
    var flags = [];
    if (a.owns_iul === 'unsure') flags.push('existing_coverage_type_unverified');
    flags.push('license_pending_nipr_verification'); // until verified; the launch gate blocks live booking
    return { eligible: true, flags: flags };
  },

  notFitMessages: {
    already_owns_iul: 'Because you already own an indexed universal life policy, this introductory consultation isn’t the right fit. It’s designed for people who are still deciding whether IUL makes sense for them.',
    under_18: 'These consultations are for adults 18 and older.',
    outside_licensed_state: 'The professional who conducts these consultations isn’t licensed in your state yet, so we can’t schedule one for you right now.'
  },
  // Shown on the not-a-fit page only when the target category is live.
  crossLink: { category: 'existing_iul_review', reasons: ['already_owns_iul'] },

  calendarTitle: 'IUL education consultation',
  calendarNote: 'No documents needed. It helps to know roughly what coverage you have today and who depends on your income.'
};
