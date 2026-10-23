// Shared funnel core: booking, consent records, attribution, mock storage,
// event tracking and the preview tracker for Liberty Pointe funnels.
// Each funnel page loads config.js, its own segment.js, then this file.
// No lead data leaves the browser: nothing here calls a server, Netlify Forms,
// or any Netlify function. In mock mode, bookings live in this browser's
// localStorage so the preview journey and tracker can be demonstrated.
(function () {
  'use strict';

  var CFG = window.LPF_FUNNEL_CONFIG;
  var configProblems = function (catId) { return window.LPF_CONFIG_PROBLEMS(CFG, catId); };
  var SEG = window.LPF_SEGMENT || null; // absent on the cross-category tracker
  var CAT_ID = SEG ? SEG.category : null;
  var CAT = CAT_ID ? CFG.categories[CAT_ID] : null;
  var RECIPIENT = CAT ? CFG.recipients[CAT.recipient] : CFG.recipients.dave_weiner;
  var BASE = CAT ? CAT.basePath : '';
  var QUAL_KEY = 'lpf_qual_' + (SEG ? SEG.id : 'none');
  var NOT_FIT_KEY = 'lpf_not_fit_' + (SEG ? SEG.id : 'none');
  var ATTR_KEY = 'lpf_attribution';
  var APPTS_KEY = 'lpf_iul_mock_appointments';
  var LAST_KEY = 'lpf_iul_last_appointment';
  var VISITS_KEY = 'lpf_preview_visits';
  var SPEND_KEY = 'lpf_preview_ad_spend';

  var STATUS_LABELS = {
    booked: 'Booked', qualified: 'Qualified', accepted: 'Accepted', held: 'Held',
    rejected: 'Rejected', no_show: 'No-show', cancelled: 'Cancelled'
  };
  // Allowed status transitions (see docs/iul-policy-review/README.md).
  var TRANSITIONS = {
    booked: ['qualified', 'rejected', 'cancelled'],
    qualified: ['accepted', 'rejected', 'cancelled'],
    accepted: ['held', 'no_show', 'rejected', 'cancelled'],
    no_show: ['booked', 'cancelled'],
    held: [], rejected: [], cancelled: []
  };
  var REJECT_REASONS = {
    no_iul_policy: 'Does not own an IUL policy',
    not_policy_owner: 'Not the policy owner',
    outside_licensed_state: 'Outside licensed states',
    already_owns_iul: 'Already owns an IUL policy (wrong category)',
    under_18: 'Under 18',
    fails_category_criteria: 'Does not meet this category’s acceptance criteria',
    invalid_contact: 'Contact details invalid / unreachable',
    duplicate: 'Duplicate booking',
    consumer_declined: 'Consumer no longer wants the appointment',
    other: 'Other (see note)'
  };
  // The only properties an analytics/advertising event may carry. Never
  // contact details, qualification answers, policy or case information.
  var EVENT_PROPS = ['category', 'where', 'format'];

  var US_STATES = [['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']];

  function isMock() {
    var h = location.hostname;
    return CFG.mockHosts.indexOf(h) !== -1 || CFG.mockHostPattern.test(h);
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    if (text != null) n.textContent = text;
    return n;
  }

  function readJSON(store, key, fallback) {
    try { var v = store.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function writeJSON(store, key, value) {
    try { store.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
  function getAppointments() { return readJSON(localStorage, APPTS_KEY, []); }
  function saveAppointments(list) { return writeJSON(localStorage, APPTS_KEY, list); }

  // Funnel events. Preview: console only. Production: wire to consent-gated
  // analytics after approval. Props are filtered to EVENT_PROPS.
  function track(name, props) {
    var p = { category: CAT_ID };
    Object.keys(props || {}).forEach(function (k) { if (EVENT_PROPS.indexOf(k) !== -1) p[k] = props[k]; });
    if (isMock() && window.console) console.info('[funnel event]', name, p);
  }

  function fmtDateTime(iso) {
    return new Date(iso).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  }
  function fmtShort(iso) {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  // Can this category take a booking here? Live hosts need live booking
  // switched on AND a complete config; preview hosts may run with gaps.
  function bookingGate(catId) {
    var problems = configProblems(catId);
    var cat = CFG.categories[catId];
    if (isMock()) {
      if (cat.status === 'planned') return { open: false, problems: ['Category is planned, not built'] };
      return { open: !problems.length || CFG.previewAllowsIncompleteConfig, problems: problems };
    }
    return { open: CFG.liveBookingEnabled && cat.status === 'live' && !problems.length, problems: problems };
  }

  /* ---------- shared page chrome ---------- */

  function previewBanner() {
    if (!isMock()) return;
    var b = el('div', { class: 'preview-banner', role: 'note' });
    var c = el('div', { class: 'container' });
    c.appendChild(el('strong', null, 'PREVIEW ONLY. '));
    c.appendChild(document.createTextNode('Scheduling is a mock and nothing you enter is sent to anyone or stored on a server; test bookings stay in this browser. Wording is pending compliance review. '));
    c.appendChild(el('a', { href: '/funnel-core/preview-tracker/' }, 'Open the appointment tracker (preview)'));
    b.appendChild(c);
    document.body.insertBefore(b, document.body.firstChild);
  }

  function fillRecipient() {
    var p = RECIPIENT;
    var names = {};
    US_STATES.forEach(function (st) { names[st[0]] = st[1]; });
    var states = CAT && CAT.licensedStates ? CAT.licensedStates : [];
    var vals = Object.assign({}, p, { licensedStatesText: states.map(function (c) { return names[c] || c; }).join(', ') });
    $all('[data-pro]').forEach(function (n) {
      var v = vals[n.getAttribute('data-pro')];
      if (v == null) return;
      n.textContent = v;
      if (/^\[CONFIRM/.test(v)) n.classList.add('placeholder-text');
    });
    $all('[data-pro-avatar]').forEach(function (n) {
      n.textContent = '';
      if (p.photo) {
        n.removeAttribute('aria-hidden');
        n.appendChild(el('img', { src: p.photo, alt: 'Photo of ' + p.name, width: '84', height: '84', decoding: 'async' }));
      }
      else n.textContent = p.name.split(' ').map(function (s) { return s[0]; }).join('');
    });
    $all('[data-pro-website]').forEach(function (n) { if (p.website) n.href = p.website; else n.closest('.panel').classList.add('hidden'); });
    $all('[data-cfg-phone]').forEach(function (n) { n.textContent = CFG.phoneDisplay; });
    // License details are public only once verified on NIPR (same gate as
    // launch-check). The preview shows them, marked as pending verification.
    var verified = p.license && p.license.verifiedAgainstNipr && p.license.lifeLineOfAuthorityConfirmed && states.length;
    $all('[data-license-line]').forEach(function (n) {
      if (verified) return;
      if (isMock()) n.appendChild(el('span', { class: 'placeholder-text' }, ' (' + p.license.source + '; pending NIPR verification, hidden on the live site until verified)'));
      else n.classList.add('hidden');
    });
    // Same rule for the bio until Dave and compliance approve it.
    if (!p.bioApproved) $all('[data-pro="bio"]').forEach(function (n) {
      if (isMock()) n.appendChild(el('span', { class: 'placeholder-text' }, ' (Draft bio, pending approval by Dave and compliance; hidden on the live site until approved)'));
      else n.classList.add('hidden');
    });
  }

  function initVideo() {
    var wrap = $('[data-video]');
    if (!wrap || !SEG) return;
    var v = SEG.video;
    var btn = $('.video-placeholder', wrap);
    if (!v.provider) {
      btn.setAttribute('aria-disabled', 'true');
      $('.video-title', wrap).textContent = 'Video coming soon';
      $('small', wrap).textContent = 'Placeholder player. The final video will be supplied and approved before launch.';
      return;
    }
    // Click-to-load: no third-party video requests until the visitor presses play.
    btn.addEventListener('click', function () {
      var node;
      if (v.provider === 'file') {
        node = el('video', { src: v.id, controls: '', autoplay: '', playsinline: '' });
      } else {
        var src = v.provider === 'youtube'
          // autoplay=1 only starts it after the visitor's own click; cc_load_policy shows captions by default
          ? 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.id) + '?autoplay=1&rel=0&playsinline=1&cc_load_policy=1&cc_lang_pref=en&hl=en'
          : 'https://player.vimeo.com/video/' + encodeURIComponent(v.id) + '?autoplay=1&dnt=1';
        node = el('iframe', { src: src, title: v.title, allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture', allowfullscreen: '', referrerpolicy: 'strict-origin-when-cross-origin' });
      }
      wrap.replaceChild(node, btn);
      track('video_play');
    });
  }

  /* ---------- attribution ---------- */

  // First touch per browser session, captured on the landing page because
  // ad links point there, not at the booking page.
  function captureAttribution() {
    var params = new URLSearchParams(location.search);
    var existing = readJSON(sessionStorage, ATTR_KEY, null);
    var hasUtm = !!params.get('utm_source');
    if (!existing || (hasUtm && !existing.utm_source)) {
      var ref = '';
      try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { ref = ''; }
      existing = {
        utm_source: params.get('utm_source'), utm_medium: params.get('utm_medium'), utm_campaign: params.get('utm_campaign'),
        utm_content: params.get('utm_content'), utm_term: params.get('utm_term'),
        landing_page: location.pathname, referrer_host: ref || null, first_seen_at: new Date().toISOString()
      };
      writeJSON(sessionStorage, ATTR_KEY, existing);
    }
    if (isMock()) {
      // Preview stand-in for analytics visit counts, per category.
      var v = readJSON(localStorage, VISITS_KEY, {});
      v[CAT_ID] = v[CAT_ID] || { visits: 0, attributed: 0 };
      v[CAT_ID].visits++;
      if (hasUtm) v[CAT_ID].attributed++;
      writeJSON(localStorage, VISITS_KEY, v);
    }
  }

  /* ---------- qualification ---------- */

  function initQualify() {
    var form = $('#qualify-form');
    var sel = $('#state');
    US_STATES.forEach(function (s) { sel.appendChild(el('option', { value: s[0] }, s[1])); });
    var saved = readJSON(sessionStorage, QUAL_KEY, null);
    if (saved && saved.answers) {
      Object.keys(saved.answers).forEach(function (k) {
        var input = form.elements[k];
        if (input) input.value = saved.answers[k];
      });
    }
    track('qualify_view');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var a = {};
      SEG.questions.forEach(function (k) { a[k] = form.elements[k].value; });
      var missing = Object.keys(a).filter(function (k) { return !a[k]; });
      var err = $('#qualify-error');
      if (missing.length) {
        err.textContent = 'Please answer every question so we can match you with the right appointment.';
        err.classList.remove('hidden');
        var first = form.elements[missing[0]];
        (first.length ? first[0] : first).focus();
        return;
      }
      err.classList.add('hidden');

      var result = SEG.evaluate(a, CAT);
      writeJSON(sessionStorage, QUAL_KEY, { category: CAT_ID, answers: a, result: result, at: new Date().toISOString() });
      track(result.eligible ? 'qualify_pass' : 'qualify_not_a_fit');
      // Outcome stays out of the URL so page-view analytics never see it.
      if (!result.eligible) writeJSON(sessionStorage, NOT_FIT_KEY, result.reason);
      location.href = BASE + (result.eligible ? '/book/' : '/not-a-fit/');
    });
  }

  /* ---------- not a fit ---------- */

  function initNotAFit() {
    var reason = readJSON(sessionStorage, NOT_FIT_KEY, null);
    $('#nf-message').textContent = SEG.notFitMessages[reason] || 'Based on your answers, this appointment isn’t the right fit right now.';
    // Voluntary link to the other funnel, only once that category is live.
    // A plain link: answers are cleared, nothing carries over, no consent is reused.
    var link = SEG.crossLink;
    var target = link && CFG.categories[link.category];
    var box = $('#nf-crosslink');
    if (box && target && target.status === 'live' && link.reasons.indexOf(reason) !== -1) {
      $('a', box).setAttribute('href', target.basePath + '/');
      box.classList.remove('hidden');
    }
    sessionStorage.removeItem(QUAL_KEY);
    sessionStorage.removeItem(NOT_FIT_KEY);
  }

  /* ---------- booking ---------- */

  function consentTexts(cat, r) {
    return {
      share: 'I agree that Liberty Pointe Financial may share the information I provide on this page and in the qualification questions with ' + r.name + ' and ' + r.agency + ', so that ' + r.name.split(' ')[0] + ' can contact me by phone or email to ' + cat.consentPurpose + '. I have read the disclosures above and the Privacy Policy, and I understand Liberty Pointe Financial is compensated for arranging this appointment. Consent is not a condition of purchasing any product or service.',
      sms: 'Text me appointment confirmations and reminders. I agree to receive text messages about this appointment from Liberty Pointe Financial and ' + r.name + ' at the mobile number above. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of purchase.'
    };
  }

  function initBook() {
    var qual = readJSON(sessionStorage, QUAL_KEY, null);
    if (!qual || qual.category !== CAT_ID || !qual.result || !qual.result.eligible) {
      location.replace(BASE + '/qualify/');
      return;
    }
    var gate = bookingGate(CAT_ID);
    if (!gate.open) {
      $('#book-form').classList.add('hidden');
      $('#booking-closed').classList.remove('hidden');
      return;
    }
    if (gate.problems.length) {
      var warn = $('#config-warning');
      var ul = $('ul', warn);
      gate.problems.forEach(function (p) { ul.appendChild(el('li', null, p)); });
      warn.classList.remove('hidden');
    }
    track('booking_view');
    buildScheduler();

    var texts = consentTexts(CAT, RECIPIENT);
    $('#consent-share-text').appendChild(document.createTextNode(texts.share));
    $('#consent-sms-text .tag').insertAdjacentText('afterend', texts.sms + ' ');
    $('#tz-label').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'your local time zone';
    $all('[data-consent-version]').forEach(function (n) { n.textContent = CFG.consentVersion; });
    var fmt = $('#format');
    CAT.formats.forEach(function (f) { fmt.appendChild(el('option', null, f)); });
    $all('[data-duration]').forEach(function (n) { n.textContent = CAT.durationMinutes || '[CONFIRM]'; });

    var form = $('#book-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var errors = [];
      var slot = form.dataset.slot;
      var f = form.elements;
      var first = f.first_name.value.trim(), last = f.last_name.value.trim();
      var email = f.email.value.trim(), phone = f.phone.value.replace(/\D/g, '');
      if (!slot) errors.push('Choose a day and time for your ' + CAT.meetingNoun + '.');
      if (!first || !last) errors.push('Enter your first and last name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('Enter a valid email address.');
      if (phone.length === 11 && phone[0] === '1') phone = phone.slice(1);
      if (phone.length !== 10) errors.push('Enter a 10-digit US phone number.');
      if (CAT.formats.indexOf(f.format.value) === -1) errors.push('Choose phone or video for your ' + CAT.meetingNoun + '.');
      if (!f.consent_share.checked) errors.push('Please confirm the required consent so we can share your details with ' + RECIPIENT.name.split(' ')[0] + '.');
      if (!errors.length) {
        var created = createBooking({
          slot: slot, format: f.format.value, contact: { first_name: first, last_name: last, email: email, phone: phone },
          qual: qual, smsConsent: f.consent_sms.checked, texts: texts
        });
        if (created.error) errors.push(created.error);
        else {
          // Schedule fires only here, after a booking is created, and pixel.js
          // refuses mock bookings and repeats. Never on the confirmation page.
          if (window.LPF_PIXEL) window.LPF_PIXEL.schedule(created.appt.id, created.appt.mock);
          writeJSON(sessionStorage, LAST_KEY, created.appt.id);
          sessionStorage.removeItem(QUAL_KEY);
          track('booking_complete', { format: created.appt.format });
          location.href = BASE + '/confirmed/';
          return;
        }
      }
      var box = $('#book-errors');
      box.textContent = '';
      errors.forEach(function (m) { box.appendChild(el('li', null, m)); });
      box.classList.remove('hidden');
      box.focus();
    });
  }

  // Single entry point for creating an appointment. Re-validates category and
  // eligibility so a tampered or stale session can't create a booking.
  // (Production: the same checks run server-side in the webhook receiver.)
  function createBooking(input) {
    var cat = CFG.categories[CAT_ID];
    if (!cat || cat.segment !== SEG.id) return { error: 'This appointment type isn’t available from this page.' };
    if (!bookingGate(CAT_ID).open) return { error: 'Booking for this appointment type isn’t open.' };
    if (input.qual.category !== CAT_ID) return { error: 'Please answer the questions for this appointment first.' };
    var check = SEG.evaluate(input.qual.answers, cat);
    if (!check.eligible) return { error: 'Based on your answers, this appointment isn’t available.' };

    var now = new Date().toISOString();
    var problems = configProblems(CAT_ID);
    var appt = {
      id: 'APT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      mock: true,
      created_at: now,
      originating_segment: SEG.id,
      category: CAT_ID,
      offer: cat.offer,
      category_history: [{ category: CAT_ID, at: now, actor: 'consumer', note: 'Booked online' }],
      consent_reconfirmation_required: false,
      status: 'booked',
      status_history: [{ status: 'booked', at: now, actor: 'consumer', note: 'Booked online' }],
      slot_start: input.slot,
      duration_minutes: cat.durationMinutes,
      format: input.format,
      recipient_id: cat.recipient,
      recipient: { name: RECIPIENT.name, agency: RECIPIENT.agency },
      contact: Object.assign({ state: input.qual.answers.state }, input.contact),
      qualification: { answers: input.qual.answers, flags: (check.flags || []).concat(problems.length ? ['config_incomplete_preview'] : []) },
      consents: {
        share_with_recipient: { given: true, at: now, version: CFG.consentVersion, category: CAT_ID, purpose: cat.consentPurpose, recipient_id: cat.recipient, text: input.texts.share },
        sms: { given: input.smsConsent, at: now, version: CFG.consentVersion, text: input.texts.sms }
      },
      // Filled later from recipient reporting, to compare categories on funded business.
      outcome: { application_submitted: null, funded: null, annual_target_premium: null, reported_at: null },
      attribution: readJSON(sessionStorage, ATTR_KEY, null)
    };
    var list = getAppointments();
    list.push(appt);
    saveAppointments(list);
    return { appt: appt };
  }

  function buildScheduler() {
    var days = $('#days'), slots = $('#slots'), form = $('#book-form');
    var taken = getAppointments().filter(function (a) { return a.status !== 'cancelled'; }).map(function (a) { return a.slot_start; });
    var av = CAT.availability;
    var d = new Date(); d.setHours(0, 0, 0, 0);
    var list = [];
    for (var guard = 0; list.length < 10 && guard < 60; guard++) {
      d.setDate(d.getDate() + 1);
      if (av.weekdays.indexOf(d.getDay()) !== -1) list.push(new Date(d));
    }
    list.forEach(function (day, i) {
      var b = el('button', { type: 'button', class: 'day', 'aria-pressed': 'false' });
      b.appendChild(document.createTextNode(day.toLocaleDateString(undefined, { weekday: 'short' })));
      b.appendChild(el('span', null, day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })));
      b.addEventListener('click', function () {
        $all('.day', days).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        slots.textContent = '';
        delete form.dataset.slot;
        $('#slot-chosen').textContent = '';
        // Deterministic "busy" slots so the mock looks like a real calendar.
        av.hours.forEach(function (h, j) {
          if ((day.getDate() + j) % 4 === 0) return;
          var t = new Date(day); t.setHours(h, 0, 0, 0);
          var iso = t.toISOString();
          if (taken.indexOf(iso) !== -1) return;
          var s = el('button', { type: 'button', class: 'slot', 'aria-pressed': 'false' }, t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }));
          s.addEventListener('click', function () {
            $all('.slot', slots).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
            s.setAttribute('aria-pressed', 'true');
            form.dataset.slot = iso;
            $('#slot-chosen').textContent = 'Selected: ' + fmtDateTime(iso);
          });
          slots.appendChild(s);
        });
      });
      days.appendChild(b);
      if (i === 0) b.click();
    });
  }

  /* ---------- confirmation ---------- */

  function findAppt(id) {
    return getAppointments().filter(function (a) { return a.id === id; })[0];
  }

  function initConfirmed() {
    var id = readJSON(sessionStorage, LAST_KEY, null);
    var appt = id && findAppt(id);
    if (!appt) {
      $('#confirm-body').classList.add('hidden');
      $('#confirm-missing').classList.remove('hidden');
      return;
    }
    renderConfirmation(appt);
    $('#ics-btn').addEventListener('click', function () { downloadIcs(appt); });
    $('#cancel-btn').addEventListener('click', function () {
      if (!confirm('Cancel this (preview) appointment?')) return;
      setStatus(appt.id, 'cancelled', 'consumer', 'Cancelled from confirmation page');
      appt = findAppt(appt.id);
      renderConfirmation(appt);
    });
  }

  function renderConfirmation(appt) {
    $('#c-name').textContent = appt.contact.first_name;
    var ul = $('#c-summary');
    ul.textContent = '';
    [['Reference', appt.id], ['Appointment', appt.offer], ['When', fmtDateTime(appt.slot_start)], ['Length', appt.duration_minutes + ' minutes'], ['How', appt.format],
     ['With', appt.recipient.name + ', ' + appt.recipient.agency], ['Status', STATUS_LABELS[appt.status]],
     ['Text reminders', appt.consents.sms.given ? 'Yes' : 'No']].forEach(function (r) {
      var li = el('li'); li.appendChild(el('span', null, r[0])); li.appendChild(el('span', null, r[1])); ul.appendChild(li);
    });
    var cancelled = appt.status === 'cancelled';
    $('#cancel-btn').disabled = cancelled;
    $('#ics-btn').disabled = cancelled;
    $('#c-headline').textContent = cancelled ? 'Your appointment has been cancelled' : 'You’re booked';
  }

  function icsDate(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function downloadIcs(appt) {
    var start = new Date(appt.slot_start);
    var end = new Date(start.getTime() + appt.duration_minutes * 60000);
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Liberty Pointe Financial//Appointments//EN', 'BEGIN:VEVENT',
      'UID:' + appt.id + '@libertypointefinancial.com', 'DTSTAMP:' + icsDate(new Date()), 'DTSTART:' + icsDate(start), 'DTEND:' + icsDate(end),
      'SUMMARY:' + SEG.calendarTitle + ' with ' + appt.recipient.name,
      'DESCRIPTION:' + appt.format + ' with ' + appt.recipient.name + ' (' + appt.recipient.agency + '). ' + SEG.calendarNote + ' Reference ' + appt.id,
      'END:VEVENT', 'END:VCALENDAR'];
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    var a = el('a', { href: URL.createObjectURL(blob), download: SEG.id.replace(/_/g, '-') + '.ics' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- status tracking ---------- */

  function updateAppt(id, fn) {
    var list = getAppointments();
    list.forEach(function (a) { if (a.id === id) fn(a); });
    saveAppointments(list);
  }

  function setStatus(id, status, actor, note, reason) {
    updateAppt(id, function (a) {
      if ((TRANSITIONS[a.status] || []).indexOf(status) === -1) return;
      a.status = status;
      var h = { status: status, at: new Date().toISOString(), actor: actor };
      if (note) h.note = note;
      if (reason) h.reason = reason;
      a.status_history.push(h);
    });
  }

  // A category change keeps the history and never reuses consent given for a
  // different purpose: the consumer must re-consent before it's worked.
  function changeCategory(id, to, actor, note) {
    updateAppt(id, function (a) {
      if (!CFG.categories[to] || categoryOf(a) === to) return;
      a.category = to;
      a.offer = CFG.categories[to].offer;
      a.category_history = a.category_history || [];
      a.category_history.push({ category: to, at: new Date().toISOString(), actor: actor, note: note || null });
      if (a.consents.share_with_recipient && a.consents.share_with_recipient.category !== to) a.consent_reconfirmation_required = true;
    });
  }

  // Records made before categories existed belong to category A.
  function categoryOf(a) { return a.category || 'existing_iul_review'; }
  function reached(a, status) { return a.status_history.some(function (h) { return h.status === status; }); }
  function pct(n, d) { return d ? Math.round(100 * n / d) + '%' : '–'; }
  function money(s, n) { return s && n ? '$' + Math.round(s / n) : '–'; }

  // Per-category reporting. Denominators are listed on the tracker page.
  function categoryMetrics(k) {
    var list = getAppointments().filter(function (a) { return categoryOf(a) === k; });
    var count = function (fn) { return list.filter(fn).length; };
    var reasons = {};
    list.forEach(function (a) {
      a.status_history.forEach(function (h) { if (h.status === 'rejected') reasons[h.reason || 'other'] = (reasons[h.reason || 'other'] || 0) + 1; });
    });
    return {
      bookings: list.length,
      qualified: count(function (a) { return reached(a, 'qualified'); }),
      accepted: count(function (a) { return reached(a, 'accepted'); }),
      held: count(function (a) { return reached(a, 'held'); }),
      noShow: count(function (a) { return reached(a, 'no_show'); }),
      cancelled: count(function (a) { return a.status === 'cancelled'; }),
      rejected: count(function (a) { return a.status === 'rejected'; }),
      funded: count(function (a) { return a.outcome && a.outcome.funded; }),
      reconsent: count(function (a) { return a.consent_reconfirmation_required; }),
      reasons: reasons
    };
  }

  function renderComparison() {
    var spend = readJSON(localStorage, SPEND_KEY, {});
    var visits = readJSON(localStorage, VISITS_KEY, {});
    var tbody = $('#compare-rows'); tbody.textContent = '';
    Object.keys(CFG.categories).forEach(function (k) {
      var cat = CFG.categories[k];
      var m = categoryMetrics(k);
      var v = visits[k] || { visits: 0, attributed: 0 };
      var s = spend[k] || 0;
      var tr = el('tr', { 'data-category': k });
      var name = el('td'); name.appendChild(el('strong', null, cat.label));
      name.appendChild(el('div', { class: 'history' }, k + ' · ' + cat.status));
      tr.appendChild(name);
      var sp = el('td');
      var input = el('input', { type: 'text', inputmode: 'decimal', 'aria-label': 'Ad spend for ' + cat.label, placeholder: '$0' });
      input.value = spend[k] || '';
      input.addEventListener('change', function () {
        spend[k] = parseFloat(input.value.replace(/[^0-9.]/g, '')) || 0;
        writeJSON(localStorage, SPEND_KEY, spend);
        renderComparison();
      });
      sp.appendChild(input); tr.appendChild(sp);
      var cells = [
        v.visits + ' (' + v.attributed + ')',
        m.bookings + ' · ' + pct(m.bookings, v.visits),
        m.qualified + ' · ' + pct(m.qualified, m.bookings),
        m.accepted + ' · ' + pct(m.accepted, m.qualified),
        m.held + ' · ' + pct(m.held, m.held + m.noShow),
        m.noShow + ' / ' + m.cancelled,
        String(m.rejected),
        m.funded + ' · ' + pct(m.funded, m.held),
        money(s, m.bookings) + ' / ' + money(s, m.qualified) + ' / ' + money(s, m.held) + ' / ' + money(s, m.funded)
      ];
      cells.forEach(function (c) { tr.appendChild(el('td', null, c)); });
      tbody.appendChild(tr);
      var rk = Object.keys(m.reasons);
      if (rk.length || m.reconsent) {
        var r = el('tr');
        var td = el('td', { colspan: '11', class: 'history' });
        td.textContent = cat.label + ' rejection reasons: ' + (rk.length ? rk.map(function (x) { return (REJECT_REASONS[x] || x) + ' ×' + m.reasons[x]; }).join(', ') : 'none') +
          (m.reconsent ? ' · awaiting re-consent after category change: ' + m.reconsent : '');
        r.appendChild(td); tbody.appendChild(r);
      }
    });
  }

  function initTracker() {
    if (!isMock()) {
      $('#tracker').classList.add('hidden');
      $('#tracker-off').classList.remove('hidden');
      return;
    }
    var filter = $('#category-filter');
    Object.keys(CFG.categories).forEach(function (k) { filter.appendChild(el('option', { value: k }, CFG.categories[k].label)); });
    filter.addEventListener('change', render);

    render();
    $('#export-btn').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(getAppointments(), null, 2)], { type: 'application/json' });
      var a = el('a', { href: URL.createObjectURL(blob), download: 'mock-appointments.json' });
      document.body.appendChild(a); a.click(); a.remove();
    });
    $('#clear-btn').addEventListener('click', function () {
      if (confirm('Delete all preview appointments, visits and spend stored in this browser?')) {
        saveAppointments([]); localStorage.removeItem(VISITS_KEY); localStorage.removeItem(SPEND_KEY); render();
      }
    });

    function render() {
      renderComparison();
      var list = getAppointments().slice().sort(function (a, b) { return a.slot_start < b.slot_start ? -1 : 1; });
      if (filter.value) list = list.filter(function (a) { return categoryOf(a) === filter.value; });
      var counts = {};
      Object.keys(STATUS_LABELS).forEach(function (k) { counts[k] = 0; });
      list.forEach(function (a) { counts[a.status]++; });
      var sum = $('#tracker-counts'); sum.textContent = '';
      Object.keys(STATUS_LABELS).forEach(function (k) {
        var c = el('div', { class: 'card' });
        c.appendChild(el('span', { class: 'status st-' + k }, STATUS_LABELS[k]));
        c.appendChild(el('h3', null, String(counts[k])));
        sum.appendChild(c);
      });

      var tbody = $('#tracker-rows'); tbody.textContent = '';
      $('#tracker-empty').classList.toggle('hidden', list.length > 0);
      list.forEach(function (a) {
        var tr = el('tr');
        var cat = CFG.categories[categoryOf(a)];
        var ctd = el('td', null, cat ? cat.label : categoryOf(a));
        (a.category_history || []).slice(1).forEach(function (h) {
          ctd.appendChild(el('div', { class: 'history' }, fmtShort(h.at) + ' → ' + h.category + ' (' + h.actor + (h.note ? ': ' + h.note : '') + ')'));
        });
        if (a.consent_reconfirmation_required) ctd.appendChild(el('div', { class: 'error' }, 'Needs re-consent for this category'));
        tr.appendChild(ctd);
        var who = el('td');
        who.appendChild(el('strong', null, a.contact.first_name + ' ' + a.contact.last_name));
        who.appendChild(el('div', null, a.contact.email));
        who.appendChild(el('div', null, a.contact.phone + ' · ' + a.contact.state));
        who.appendChild(el('div', { class: 'history' }, a.id));
        tr.appendChild(who);
        var at = el('td', null, fmtShort(a.slot_start) + ' · ' + a.format);
        var src = a.attribution || a.source || {};
        at.appendChild(el('div', { class: 'history' }, 'Source: ' + [src.utm_source, src.utm_campaign, src.utm_content].filter(Boolean).join(' / ') || 'direct'));
        tr.appendChild(at);
        var q = a.qualification.answers;
        var qtd = el('td', null, Object.keys(q).map(function (k) { return k + ': ' + q[k]; }).join(' · '));
        if (a.qualification.flags.length) qtd.appendChild(el('div', { class: 'history' }, 'Flags: ' + a.qualification.flags.join(', ')));
        var share = a.consents.share_with_recipient || a.consents.share_with_professional || {};
        qtd.appendChild(el('div', { class: 'history' }, 'SMS consent: ' + (a.consents.sms.given ? 'yes' : 'no') + ' · ' + share.version + (share.category ? ' · for ' + share.category : '')));
        tr.appendChild(qtd);

        var st = el('td');
        st.appendChild(el('span', { class: 'status st-' + a.status }, STATUS_LABELS[a.status]));
        var hist = el('div', { class: 'history' });
        a.status_history.forEach(function (h) {
          hist.appendChild(el('div', null, fmtShort(h.at) + ' → ' + STATUS_LABELS[h.status] + ' (' + h.actor + (h.reason ? ', ' + (REJECT_REASONS[h.reason] || h.reason) : '') + (h.note ? ': ' + h.note : '') + ')'));
        });
        st.appendChild(hist);
        tr.appendChild(st);

        var act = el('td'); var box = el('div', { class: 'actions' });
        (TRANSITIONS[a.status] || []).forEach(function (next) {
          var b = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, next === 'booked' ? 'Rebook' : STATUS_LABELS[next]);
          b.addEventListener('click', function () {
            var reason = null;
            if (next === 'rejected') {
              var keys = Object.keys(REJECT_REASONS);
              var pick = prompt('Rejection reason:\n' + keys.map(function (k, i) { return (i + 1) + '. ' + REJECT_REASONS[k]; }).join('\n') + '\n\nEnter a number:');
              reason = keys[parseInt(pick, 10) - 1];
              if (!reason) return;
            }
            var note = prompt('Optional note (leave blank for none):') || null;
            setStatus(a.id, next, $('#actor').value, note, reason);
            render();
          });
          box.appendChild(b);
        });
        if (a.status === 'held') {
          var o = a.outcome || {};
          var fb = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, o.funded ? 'Funded ✓' : 'Report funded');
          fb.disabled = !!o.funded;
          fb.addEventListener('click', function () {
            var prem = prompt('Annual target premium of the funded policy (numbers only, optional):');
            if (prem === null) return;
            updateAppt(a.id, function (x) { x.outcome = { application_submitted: true, funded: true, annual_target_premium: parseFloat(prem) || null, reported_at: new Date().toISOString() }; });
            render();
          });
          box.appendChild(fb);
        }
        if (['booked', 'qualified'].indexOf(a.status) !== -1) {
          var cb = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, 'Change category');
          cb.addEventListener('click', function () {
            var others = Object.keys(CFG.categories).filter(function (k) { return k !== categoryOf(a); });
            var pick = prompt('Move to which category? (requires the consumer to re-consent)\n' + others.map(function (k, i) { return (i + 1) + '. ' + CFG.categories[k].label; }).join('\n'));
            var to = others[parseInt(pick, 10) - 1];
            if (!to) return;
            changeCategory(a.id, to, $('#actor').value, prompt('Reason for the change:') || null);
            render();
          });
          box.appendChild(cb);
        }
        if (!box.childNodes.length) box.appendChild(el('span', { class: 'history' }, 'Final status'));
        act.appendChild(box); tr.appendChild(act);
        tbody.appendChild(tr);
      });
    }
  }

  /* ---------- boot ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    previewBanner();
    fillRecipient();
    initVideo();
    var page = document.body.getAttribute('data-page');
    if (page === 'landing') {
      captureAttribution();
      track('landing_view');
      $all('[data-cta]').forEach(function (a) { a.addEventListener('click', function () { track('cta_click', { where: a.getAttribute('data-cta') }); }); });
    }
    if (page === 'qualify') initQualify();
    if (page === 'not-a-fit') initNotAFit();
    if (page === 'book') initBook();
    if (page === 'confirmed') initConfirmed();
    if (page === 'tracker') initTracker();
  });
})();
