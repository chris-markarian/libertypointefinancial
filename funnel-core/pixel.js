// Meta Pixel for funnel pages. Loaded on every funnel page, but it does
// nothing unless config.pixel is switched on AND approved (see launch-check).
// Rules:
// - one initialization per page (no duplicate with any other snippet);
// - autoConfig off, so Meta doesn't scrape buttons or form fields;
// - no advanced matching: no name, email, phone or answers are ever passed;
// - PageView on page load; Schedule only via LPF_PIXEL.schedule(), which the
//   booking flow calls once per genuine, confirmed (non-mock) booking.
(function () {
  'use strict';

  var CFG = window.LPF_FUNNEL_CONFIG;
  var P = CFG.pixel;
  var SENT_KEY = 'lpf_pixel_schedule_sent';

  function isMock() {
    var h = location.hostname;
    return CFG.mockHosts.indexOf(h) !== -1 || CFG.mockHostPattern.test(h);
  }

  // Why the pixel is off, or null when it may run.
  function blockedReason() {
    if (!P || !P.enabled) return 'pixel disabled in config';
    if (!P.privacyApproved || !P.consentApproved) return 'privacy/consent approval not recorded';
    if (!/^\d{10,20}$/.test(P.id || '')) return 'pixel id missing';
    if (isMock()) return 'preview host (mock bookings are never tracked)';
    return null;
  }

  function load() {
    if (window.fbq) return; // someone already initialized it: never twice
    /* Meta's standard loader, unchanged except for the settings below */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('set', 'autoConfig', false, P.id);
    window.fbq('init', P.id); // no user data argument: no advanced matching
    window.fbq('track', 'PageView');
  }

  function sentIds() {
    try { return JSON.parse(localStorage.getItem(SENT_KEY) || '[]'); } catch (e) { return []; }
  }

  window.LPF_PIXEL = {
    blockedReason: blockedReason,
    // Call only after the scheduler confirms a real booking. appointmentId
    // is a random reference (used as Meta's eventID for de-duplication).
    schedule: function (appointmentId, isMockBooking) {
      var why = isMockBooking ? 'mock booking' : blockedReason();
      if (!why && !appointmentId) why = 'no appointment id';
      var sent = sentIds();
      if (!why && sent.indexOf(appointmentId) !== -1) why = 'already sent for this appointment';
      if (why) {
        if (isMock() && window.console) console.info('[pixel] Schedule not sent: ' + why);
        return false;
      }
      sent.push(appointmentId);
      try { localStorage.setItem(SENT_KEY, JSON.stringify(sent.slice(-50))); } catch (e) { /* ignore */ }
      // No custom data: no category, answers or contact details.
      window.fbq('track', 'Schedule', {}, { eventID: appointmentId });
      return true;
    }
  };

  var why = blockedReason();
  if (why) {
    if (isMock() && window.console) console.info('[pixel] off: ' + why);
    return;
  }
  load();
})();
