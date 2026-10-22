// Shared funnel core: booking, consent capture, mock storage, tracking and the
// preview tracker for every Liberty Pointe educational funnel (segment).
// Each funnel page loads config.js, its own segment.js, then this file.
// No lead data leaves the browser: nothing here calls a server, Netlify Forms,
// or any Netlify function. In mock mode, bookings live in this browser's
// localStorage so the preview journey and tracker can be demonstrated.
(function () {
  'use strict';

  var CFG = window.LPF_FUNNEL_CONFIG;
  var SEG = window.LPF_SEGMENT || null; // absent on the cross-segment tracker
  var SEG_META = SEG ? CFG.segments[SEG.id] : null;
  var BUYER_ID = SEG_META ? SEG_META.buyer : 'dave_weiner';
  var BUYER = CFG.buyers[BUYER_ID];
  var BASE = SEG_META ? SEG_META.basePath : '';
  var QUAL_KEY = 'lpf_qual_' + (SEG ? SEG.id : 'none');
  var NOT_FIT_KEY = 'lpf_not_fit_' + (SEG ? SEG.id : 'none');
  var APPTS_KEY = 'lpf_iul_mock_appointments';
  var LAST_KEY = 'lpf_iul_last_appointment';

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
    invalid_contact: 'Contact details invalid / unreachable',
    duplicate: 'Duplicate booking',
    consumer_declined: 'Consumer no longer wants the review',
    other: 'Other (see note)'
  };

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
  // analytics after approval. Never pass contact details or policy answers.
  function track(name, props) {
    var p = Object.assign({ segment: SEG ? SEG.id : null }, props || {});
    if (isMock() && window.console) console.info('[funnel event]', name, p);
  }

  function fmtDateTime(iso) {
    var d = new Date(iso);
    return d.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  }
  function fmtShort(iso) {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  /* ---------- shared page chrome ---------- */

  function previewBanner() {
    if (!isMock()) return;
    var b = el('div', { class: 'preview-banner', role: 'note' });
    var c = el('div', { class: 'container' });
    c.appendChild(el('strong', null, 'PREVIEW ONLY. '));
    c.appendChild(document.createTextNode('Scheduling is a mock and nothing you enter is sent to anyone or stored on a server; test bookings stay in this browser. Wording is pending compliance review. '));
    var a = el('a', { href: '/funnel-core/preview-tracker/' }, 'Open the appointment tracker (preview)');
    c.appendChild(a);
    b.appendChild(c);
    document.body.insertBefore(b, document.body.firstChild);
  }

  function fillProfessional() {
    var p = BUYER;
    $all('[data-pro]').forEach(function (n) {
      var v = p[n.getAttribute('data-pro')];
      if (v == null) return;
      n.textContent = v;
      if (/^\[CONFIRM/.test(v)) n.classList.add('placeholder-text');
    });
    $all('[data-pro-avatar]').forEach(function (n) {
      n.textContent = '';
      if (p.photo) n.appendChild(el('img', { src: p.photo, alt: 'Photo of ' + p.name }));
      else n.textContent = p.name.split(' ').map(function (s) { return s[0]; }).join('');
    });
    $all('[data-cfg-phone]').forEach(function (n) { n.textContent = CFG.phoneDisplay; });
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
          ? 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.id) + '?autoplay=1&rel=0'
          : 'https://player.vimeo.com/video/' + encodeURIComponent(v.id) + '?autoplay=1&dnt=1';
        node = el('iframe', { src: src, title: v.title, allow: 'autoplay; fullscreen; picture-in-picture', allowfullscreen: '' });
      }
      wrap.replaceChild(node, btn);
      track('video_play');
    });
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
      SEG.questions.forEach(function (k) {
        a[k] = form.elements[k].value;
      });
      var missing = Object.keys(a).filter(function (k) { return !a[k]; });
      var err = $('#qualify-error');
      if (missing.length) {
        err.textContent = 'Please answer every question so we can match you with the right review.';
        err.classList.remove('hidden');
        var first = form.elements[missing[0]];
        (first.length ? first[0] : first).focus();
        return;
      }
      err.classList.add('hidden');

      var result = SEG.evaluate(a, BUYER);
      writeJSON(sessionStorage, QUAL_KEY, { answers: a, result: result, at: new Date().toISOString() });
      track(result.eligible ? 'qualify_pass' : 'qualify_not_a_fit', { reason: result.reason || null });
      // Outcome stays out of the URL so page-view analytics never see it.
      if (!result.eligible) writeJSON(sessionStorage, NOT_FIT_KEY, result.reason);
      location.href = BASE + (result.eligible ? '/book/' : '/not-a-fit/');
    });
  }

  /* ---------- not a fit ---------- */

  function initNotAFit() {
    var reason = readJSON(sessionStorage, NOT_FIT_KEY, null);
    var msgs = SEG.notFitMessages;
    $('#nf-message').textContent = msgs[reason] || 'Based on your answers, this review isn’t the right fit right now.';
    sessionStorage.removeItem(QUAL_KEY);
    sessionStorage.removeItem(NOT_FIT_KEY);
  }

  /* ---------- booking ---------- */

  function initBook() {
    var qual = readJSON(sessionStorage, QUAL_KEY, null);
    if (!qual || !qual.result || !qual.result.eligible) {
      location.replace(BASE + '/qualify/');
      return;
    }
    if (!isMock()) {
      // Real scheduler not connected yet: collect nothing on production.
      $('#book-form').classList.add('hidden');
      $('#booking-closed').classList.remove('hidden');
      return;
    }
    track('booking_view');
    buildScheduler();

    $('#tz-label').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'your local time zone';
    $all('[data-consent-version]').forEach(function (n) { n.textContent = CFG.consentVersion; });

    var form = $('#book-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var errors = [];
      var slot = form.dataset.slot;
      var f = form.elements;
      var first = f.first_name.value.trim(), last = f.last_name.value.trim();
      var email = f.email.value.trim(), phone = f.phone.value.replace(/\D/g, '');
      if (!slot) errors.push('Choose a day and time for your review.');
      if (!first || !last) errors.push('Enter your first and last name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('Enter a valid email address.');
      if (phone.length === 11 && phone[0] === '1') phone = phone.slice(1);
      if (phone.length !== 10) errors.push('Enter a 10-digit US phone number.');
      if (!f.format.value) errors.push('Choose phone or video for your review.');
      if (!f.consent_share.checked) errors.push('Please confirm the required consent so we can share your details with Dave.');
      var box = $('#book-errors');
      box.textContent = '';
      if (errors.length) {
        errors.forEach(function (m) { box.appendChild(el('li', null, m)); });
        box.classList.remove('hidden');
        box.focus();
        return;
      }
      box.classList.add('hidden');

      var now = new Date().toISOString();
      var params = new URLSearchParams(location.search);
      var appt = {
        segment: SEG.id,
        offer: SEG_META.offer,
        id: 'APT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        mock: true,
        created_at: now,
        status: 'booked',
        status_history: [{ status: 'booked', at: now, actor: 'consumer', note: 'Booked online' }],
        slot_start: slot,
        duration_minutes: CFG.meeting.minutes,
        format: f.format.value,
        buyer_id: BUYER_ID,
        professional: { name: BUYER.name, agency: BUYER.agency },
        contact: { first_name: first, last_name: last, email: email, phone: phone, state: qual.answers.state },
        qualification: { answers: qual.answers, flags: qual.result.flags || [] },
        consents: {
          share_with_professional: { given: true, at: now, version: CFG.consentVersion, text: $('#consent-share-text').textContent.replace(/\s+/g, ' ').trim() },
          sms: { given: f.consent_sms.checked, at: now, version: CFG.consentVersion, text: $('#consent-sms-text').textContent.replace(/\s+/g, ' ').trim() }
        },
        // Filled later from buyer reporting, to compare segments on funded business.
        outcome: { application_submitted: null, funded: null, annual_target_premium: null, reported_at: null },
        source: { utm_source: params.get('utm_source'), utm_medium: params.get('utm_medium'), utm_campaign: params.get('utm_campaign'), page: location.pathname }
      };
      var list = getAppointments();
      list.push(appt);
      saveAppointments(list);
      writeJSON(sessionStorage, LAST_KEY, appt.id);
      sessionStorage.removeItem(QUAL_KEY);
      track('booking_complete', { format: appt.format });
      location.href = BASE + '/confirmed/';
    });
  }

  function buildScheduler() {
    var days = $('#days'), slots = $('#slots'), form = $('#book-form');
    var taken = getAppointments().filter(function (a) { return a.status !== 'cancelled'; }).map(function (a) { return a.slot_start; });
    var d = new Date(); d.setHours(0, 0, 0, 0);
    var hours = [9, 10, 11, 13, 14, 15, 16];
    var list = [];
    while (list.length < 10) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      list.push(new Date(d));
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
        hours.forEach(function (h, j) {
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
    [['Reference', appt.id], ['When', fmtDateTime(appt.slot_start)], ['Length', appt.duration_minutes + ' minutes'], ['How', appt.format],
     ['With', appt.professional.name + ', ' + appt.professional.agency], ['Status', STATUS_LABELS[appt.status]],
     ['Text reminders', appt.consents.sms.given ? 'Yes' : 'No']].forEach(function (r) {
      var li = el('li'); li.appendChild(el('span', null, r[0])); li.appendChild(el('span', null, r[1])); ul.appendChild(li);
    });
    var cancelled = appt.status === 'cancelled';
    $('#cancel-btn').disabled = cancelled;
    $('#ics-btn').disabled = cancelled;
    $('#c-headline').textContent = cancelled ? 'Your review has been cancelled' : 'You’re booked';
  }

  function icsDate(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function downloadIcs(appt) {
    var start = new Date(appt.slot_start);
    var end = new Date(start.getTime() + appt.duration_minutes * 60000);
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Liberty Pointe Financial//IUL Review//EN', 'BEGIN:VEVENT',
      'UID:' + appt.id + '@libertypointefinancial.com', 'DTSTAMP:' + icsDate(new Date()), 'DTSTART:' + icsDate(start), 'DTEND:' + icsDate(end),
      'SUMMARY:' + SEG.calendarTitle + ' with ' + appt.professional.name,
      'DESCRIPTION:' + appt.format + ' with ' + appt.professional.name + ' (' + appt.professional.agency + '). ' + SEG.calendarNote + ' Reference ' + appt.id,
      'END:VEVENT', 'END:VCALENDAR'];
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    var a = el('a', { href: URL.createObjectURL(blob), download: SEG.id.replace(/_/g, '-') + '.ics' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- status tracking ---------- */

  function setStatus(id, status, actor, note, reason) {
    var list = getAppointments();
    list.forEach(function (a) {
      if (a.id !== id) return;
      if ((TRANSITIONS[a.status] || []).indexOf(status) === -1) return;
      a.status = status;
      var h = { status: status, at: new Date().toISOString(), actor: actor };
      if (note) h.note = note;
      if (reason) h.reason = reason;
      a.status_history.push(h);
    });
    saveAppointments(list);
  }

  function setOutcome(id, outcome) {
    var list = getAppointments();
    list.forEach(function (a) { if (a.id === id) a.outcome = outcome; });
    saveAppointments(list);
  }

  // Records made before segments existed belong to segment A.
  function segmentOf(a) { return a.segment || 'iul_policy_review'; }
  function reached(a, status) { return a.status_history.some(function (h) { return h.status === status; }); }
  function pct(n, d) { return d ? Math.round(100 * n / d) + '%' : '–'; }

  var SPEND_KEY = 'lpf_preview_ad_spend';

  // Side-by-side segment metrics: acquisition cost, qualification,
  // attendance, buyer acceptance and funded business.
  function renderComparison() {
    var spend = readJSON(localStorage, SPEND_KEY, {});
    var tbody = $('#compare-rows'); tbody.textContent = '';
    Object.keys(CFG.segments).forEach(function (k) {
      var seg = CFG.segments[k];
      var list = getAppointments().filter(function (a) { return segmentOf(a) === k; });
      var booked = list.length;
      var qualified = list.filter(function (a) { return reached(a, 'qualified'); }).length;
      var accepted = list.filter(function (a) { return reached(a, 'accepted'); }).length;
      var held = list.filter(function (a) { return reached(a, 'held'); }).length;
      var noShow = list.filter(function (a) { return reached(a, 'no_show'); }).length;
      var funded = list.filter(function (a) { return a.outcome && a.outcome.funded; }).length;
      var tr = el('tr');
      var name = el('td'); name.appendChild(el('strong', null, seg.label)); name.appendChild(el('div', { class: 'history' }, seg.offer + ' · ' + seg.status));
      tr.appendChild(name);
      var sp = el('td');
      var input = el('input', { type: 'text', inputmode: 'decimal', 'aria-label': 'Ad spend for ' + seg.label, placeholder: '$0' });
      input.value = spend[k] || '';
      input.addEventListener('change', function () {
        spend[k] = parseFloat(input.value.replace(/[^0-9.]/g, '')) || 0;
        writeJSON(localStorage, SPEND_KEY, spend);
        renderComparison();
      });
      sp.appendChild(input); tr.appendChild(sp);
      var s = spend[k] || 0;
      [String(booked), booked && s ? '$' + (s / booked).toFixed(0) : '–',
       pct(qualified, booked), pct(accepted, qualified), pct(held, held + noShow), String(funded),
       funded && s ? '$' + (s / funded).toFixed(0) : '–'].forEach(function (v) { tr.appendChild(el('td', null, v)); });
      tbody.appendChild(tr);
    });
  }

  function initTracker() {
    if (!isMock()) {
      $('#tracker').classList.add('hidden');
      $('#tracker-off').classList.remove('hidden');
      return;
    }
    var filter = $('#segment-filter');
    Object.keys(CFG.segments).forEach(function (k) { filter.appendChild(el('option', { value: k }, CFG.segments[k].label)); });
    filter.addEventListener('change', render);

    render();
    $('#export-btn').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(getAppointments(), null, 2)], { type: 'application/json' });
      var a = el('a', { href: URL.createObjectURL(blob), download: 'mock-appointments.json' });
      document.body.appendChild(a); a.click(); a.remove();
    });
    $('#clear-btn').addEventListener('click', function () {
      if (confirm('Delete all preview appointments stored in this browser?')) { saveAppointments([]); render(); }
    });

    function render() {
      renderComparison();
      var list = getAppointments().slice().sort(function (a, b) { return a.slot_start < b.slot_start ? -1 : 1; });
      if (filter.value) list = list.filter(function (a) { return segmentOf(a) === filter.value; });
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
        var seg = CFG.segments[segmentOf(a)];
        tr.appendChild(el('td', null, seg ? seg.label : segmentOf(a)));
        var who = el('td');
        who.appendChild(el('strong', null, a.contact.first_name + ' ' + a.contact.last_name));
        who.appendChild(el('div', null, a.contact.email));
        who.appendChild(el('div', null, a.contact.phone + ' · ' + a.contact.state));
        who.appendChild(el('div', { class: 'history' }, a.id));
        tr.appendChild(who);
        tr.appendChild(el('td', null, fmtShort(a.slot_start) + ' · ' + a.format));
        var q = a.qualification.answers;
        var qtd = el('td', null, Object.keys(q).map(function (k) { return k + ': ' + q[k]; }).join(' · '));
        if (a.qualification.flags.length) qtd.appendChild(el('div', { class: 'history' }, 'Flags: ' + a.qualification.flags.join(', ')));
        qtd.appendChild(el('div', { class: 'history' }, 'SMS consent: ' + (a.consents.sms.given ? 'yes' : 'no') + ' · ' + a.consents.share_with_professional.version));
        tr.appendChild(qtd);

        var st = el('td');
        st.appendChild(el('span', { class: 'status st-' + a.status }, STATUS_LABELS[a.status]));
        var hist = el('div', { class: 'history' });
        a.status_history.forEach(function (h) {
          hist.appendChild(el('div', null, fmtShort(h.at) + ' → ' + STATUS_LABELS[h.status] + ' (' + h.actor + (h.reason ? ', ' + REJECT_REASONS[h.reason] : '') + (h.note ? ': ' + h.note : '') + ')'));
        });
        st.appendChild(hist);
        tr.appendChild(st);

        var act = el('td'); var box = el('div', { class: 'actions' });
        (TRANSITIONS[a.status] || []).forEach(function (next) {
          var b = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, next === 'booked' ? 'Rebook' : STATUS_LABELS[next]);
          b.addEventListener('click', function () {
            var reason = null, note = null;
            if (next === 'rejected') {
              var keys = Object.keys(REJECT_REASONS);
              var pick = prompt('Rejection reason:\n' + keys.map(function (k, i) { return (i + 1) + '. ' + REJECT_REASONS[k]; }).join('\n') + '\n\nEnter a number:');
              reason = keys[parseInt(pick, 10) - 1];
              if (!reason) return;
            }
            note = prompt('Optional note (leave blank for none):') || null;
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
            setOutcome(a.id, { application_submitted: true, funded: true, annual_target_premium: parseFloat(prem) || null, reported_at: new Date().toISOString() });
            render();
          });
          box.appendChild(fb);
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
    fillProfessional();
    initVideo();
    var page = document.body.getAttribute('data-page');
    if (page === 'landing') {
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
