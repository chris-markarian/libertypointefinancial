// End-to-end check of the IUL policy review funnel.
// Usage: serve the repo root (e.g. `python3 -m http.server 8811`), then
//   BASE=http://localhost:8811 node tests/iul-policy-review.e2e.js
// Set BASE to a Netlify Deploy Preview URL to test the preview itself.
// Requires the `playwright` package (global install is fine: NODE_PATH=$(npm root -g)).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = (process.env.BASE || 'http://localhost:8811').replace(/\/$/, '');
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
const SHOTS = process.env.SHOTS || null;
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? ' :: ' + detail : ''));
}

// Locally, apply the funnel's _headers CSP so CSP problems show up before deploy.
function cspFromHeaders() {
  const txt = fs.readFileSync(path.join(__dirname, '..', '_headers'), 'utf8');
  const m = txt.match(/Content-Security-Policy:\s*(.+)/);
  return m ? m[1].trim() : null;
}

(async () => {
  const browser = await chromium.launch({
    args: LOCAL ? ['--host-resolver-rules=MAP libertypointefinancial.com 127.0.0.1:' + new URL(BASE).port] : []
  });
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => {
    if (!/\/(iul-policy-review|funnel-core)\//.test(r.frame().url())) return;
    const u = new URL(r.url());
    if (u.origin !== new URL(BASE).origin && !/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) external.push(r.url());
    if (u.pathname.startsWith('/.netlify/functions')) external.push('FUNCTION ' + r.url());
  });
  if (LOCAL) {
    const csp = cspFromHeaders();
    await ctx.route(/\/(iul-policy-review|funnel-core)\//, async route => {
      const resp = await route.fetch({ url: route.request().url().replace('http://libertypointefinancial.com', BASE) });
      const headers = Object.assign({}, resp.headers());
      if (csp && /text\/html/.test(headers['content-type'] || '')) headers['content-security-policy'] = csp;
      await route.fulfill({ response: resp, headers });
    });
  }
  const shot = async n => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: true }); };

  // 1. Landing
  await page.goto(BASE + '/iul-policy-review/?utm_source=facebook&utm_medium=paid&utm_campaign=iul_review_test&utm_content=ad1');
  check('landing loads', (await page.title()).includes('IUL Policy Review'));
  check('preview banner shown', await page.isVisible('.preview-banner'));
  check('Dave named on landing', (await page.textContent('body')).includes('Dave Weiner'));
  check('video placeholder present', await page.isVisible('[data-video] .video-placeholder'));
  check('no "inferior" claim', !/older policies are (worse|inferior)/i.test(await page.textContent('main')));
  await shot('1-landing');

  // 2. Qualification: validation and not-a-fit path
  await page.click('a[data-cta="hero"]');
  await page.waitForURL('**/qualify/');
  await page.click('#qualify-form button[type=submit]');
  check('qualify requires answers', await page.isVisible('#qualify-error'));
  await page.check('input[name=owns_iul][value="no"]');
  await page.check('input[name=owner_role][value="self"]');
  await page.check('input[name=issue_period][value="before_2021"]');
  await page.selectOption('#state', 'UT');
  await page.check('input[name=annual_premium][value="2500_5000"]');
  await page.check('input[name=has_statement][value="yes"]');
  await shot('2-qualify');
  await page.click('#qualify-form button[type=submit]');
  await page.waitForURL('**/not-a-fit/');
  check('non-owner routed to not-a-fit', (await page.textContent('#nf-message')).includes('already own'));
  check('not-a-fit reason kept out of URL', !page.url().includes('reason'));

  check('education link hidden while category B is planned', !(await page.isVisible('#nf-education')));

  // 3. Qualify properly
  await page.goto(BASE + '/iul-policy-review/qualify/');
  await page.check('input[name=owns_iul][value="yes"]');
  await page.check('input[name=owner_role][value="self"]');
  await page.check('input[name=issue_period][value="before_2021"]');
  await page.selectOption('#state', 'UT');
  await page.check('input[name=annual_premium][value="5000_10000"]');
  await page.check('input[name=has_statement][value="yes"]');
  await page.click('#qualify-form button[type=submit]');
  await page.waitForURL('**/book/');
  check('qualified owner reaches booking', true);

  // 4. Booking: disclosures, consent, scheduler
  check('preview shows missing-config warning', (await page.isVisible('#config-warning')) && (await page.textContent('#config-warning')).includes('Licensed states not verified'));
  const shareTxt = await page.textContent('#consent-share-text');
  check('consent names recipient + offer-specific purpose', shareTxt.includes('Dave Weiner') && shareTxt.includes('conduct my IUL policy review'));
  const smsTxt = await page.textContent('#consent-sms-text');
  check('SMS consent separate, wording before links', smsTxt.indexOf('Text me') < smsTxt.indexOf('See our'));
  const disc = await page.textContent('#disclosures');
  check('disclosures name Dave and agency', disc.includes('Dave Weiner') && disc.includes('Global Renaissance Insurance Marketing Agency'));
  check('disclosures state compensation', /compensated/.test(disc));
  check('disclosures: no guarantee of better results', /does not guarantee better results/.test(disc));
  await page.fill('#first_name', 'Test');
  await page.fill('#last_name', 'Consumer');
  await page.fill('#email', 'test@example.com');
  await page.fill('#phone', '(555) 555-0100');
  await page.selectOption('#format', 'Video call');
  await page.click('#book-form button[type=submit]');
  const errs = await page.textContent('#book-errors');
  check('booking blocked without time + consent', /Choose a day/.test(errs) && /required consent/.test(errs));
  await page.click('.slot >> nth=0');
  await page.check('input[name=consent_share]');
  await page.check('input[name=consent_sms]');
  await shot('3-book');
  await page.click('#book-form button[type=submit]');
  await page.waitForURL('**/confirmed/');
  const summary = await page.textContent('#c-summary');
  check('confirmation shows Dave + status', summary.includes('Dave Weiner') && summary.includes('Booked'));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#ics-btn')]);
  const ics = fs.readFileSync(await dl.path(), 'utf8');
  check('calendar file generated', ics.includes('BEGIN:VEVENT') && ics.includes('Dave Weiner'));
  await shot('4-confirmed');

  // 5. Stored record shape
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('lpf_iul_mock_appointments'))[0]);
  const sc = rec.consents.share_with_recipient;
  check('record has consent text, version, category, purpose', sc.given && sc.text.includes('Dave Weiner') && sc.version && sc.category === 'existing_iul_review' && sc.purpose.includes('policy review'));
  check('record has SMS consent', rec.consents.sms.given === true);
  check('record status booked', rec.status === 'booked' && rec.status_history.length === 1);
  check('record carries category, origin segment, recipient', rec.category === 'existing_iul_review' && rec.originating_segment === 'iul_policy_review' && rec.offer === 'Professional IUL Policy Review' && rec.recipient_id === 'dave_weiner' && rec.category_history.length === 1);
  check('record carries ad attribution from landing page', rec.attribution && rec.attribution.utm_source === 'facebook' && rec.attribution.utm_content === 'ad1' && rec.attribution.landing_page === '/iul-policy-review/');
  check('record flags incomplete preview config', rec.qualification.flags.includes('config_incomplete_preview'));
  check('record has empty funded-business outcome', rec.outcome && rec.outcome.funded === null);

  // 6. Tracker transitions
  page.on('dialog', d => d.accept(d.type() === 'prompt' ? (d.message().startsWith('Rejection') ? '2' : d.message().startsWith('Move to') ? '1' : 'test note') : undefined));
  await page.goto(BASE + '/funnel-core/preview-tracker/');
  for (const next of ['Qualified', 'Accepted', 'Held']) {
    await page.click(`#tracker-rows button:has-text("${next}")`);
  }
  let r2 = await page.evaluate(() => JSON.parse(localStorage.getItem('lpf_iul_mock_appointments'))[0]);
  check('booked → qualified → accepted → held', r2.status === 'held' && r2.status_history.map(h => h.status).join(',') === 'booked,qualified,accepted,held');
  await page.click('#tracker-rows button:has-text("Report funded")');
  r2 = await page.evaluate(() => JSON.parse(localStorage.getItem('lpf_iul_mock_appointments'))[0]);
  check('funded business recorded', r2.outcome.funded === true);
  await page.fill('#compare-rows tr[data-category="existing_iul_review"] input', '500');
  await page.press('#compare-rows tr[data-category="existing_iul_review"] input', 'Enter');
  await page.locator('h2:has-text("Category report")').click();
  const cmp = await page.textContent('#compare-rows tr[data-category="existing_iul_review"]');
  check('category report: A row with visits, rates and costs', cmp.includes('A: Existing IUL owners') && cmp.includes('$500') && /\d+ \(\d+\)/.test(cmp));
  check('category report: B row listed as planned', (await page.textContent('#compare-rows tr[data-category="prospective_iul_education"]')).includes('planned'));
  await page.selectOption('#category-filter', 'prospective_iul_education');
  check('category filter hides A records', (await page.locator('#tracker-rows tr').count()) === 0);
  await page.selectOption('#category-filter', '');
  await shot('5-tracker');
  // Second booking, rejected
  await page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem('lpf_iul_mock_appointments'));
    const c = JSON.parse(JSON.stringify(l[0]));
    c.id = 'APT-TEST2'; c.status = 'booked'; c.status_history = [c.status_history[0]];
    c.slot_start = new Date(Date.now() + 86400000 * 3).toISOString();
    l.push(c); localStorage.setItem('lpf_iul_mock_appointments', JSON.stringify(l));
  });
  await page.reload();
  await page.click('#tracker-rows button:has-text("Rejected")');
  r2 = await page.evaluate(() => JSON.parse(localStorage.getItem('lpf_iul_mock_appointments')).find(a => a.id === 'APT-TEST2'));
  check('rejection stores reason code', r2.status === 'rejected' && r2.status_history[1].reason === 'not_policy_owner');
  check('rejection reasons reported per category', (await page.textContent('#compare-rows')).includes('Not the policy owner'));
  // Category change keeps history and requires re-consent
  await page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem('lpf_iul_mock_appointments'));
    const c = JSON.parse(JSON.stringify(l[0]));
    c.id = 'APT-TEST3'; c.status = 'booked'; c.status_history = [c.status_history[0]];
    c.slot_start = new Date(Date.now() + 86400000 * 4).toISOString();
    l.push(c); localStorage.setItem('lpf_iul_mock_appointments', JSON.stringify(l));
  });
  await page.reload();
  await page.click('#tracker-rows tr:has-text("APT-TEST3") button:has-text("Change category")');
  const r3 = await page.evaluate(() => JSON.parse(localStorage.getItem('lpf_iul_mock_appointments')).find(a => a.id === 'APT-TEST3'));
  check('category change recorded with history + re-consent flag', r3.category === 'prospective_iul_education' && r3.category_history.length === 2 && r3.consent_reconfirmation_required === true && r3.originating_segment === 'iul_policy_review');
  check('held is final (no buttons)', (await page.textContent('#tracker-rows')).includes('Final status'));

  // 6b. Tampered session: ineligible answers marked eligible must not book
  await page.goto(BASE + '/iul-policy-review/qualify/');
  await page.evaluate(() => sessionStorage.setItem('lpf_qual_iul_policy_review', JSON.stringify({ category: 'existing_iul_review', answers: { owns_iul: 'no', owner_role: 'self', issue_period: 'not_sure', state: 'UT', annual_premium: 'not_sure', has_statement: 'yes' }, result: { eligible: true, flags: [] } })));
  await page.goto(BASE + '/iul-policy-review/book/');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('lpf_iul_mock_appointments')).length);
  await page.fill('#first_name', 'Tamper'); await page.fill('#last_name', 'Test');
  await page.fill('#email', 't@example.com'); await page.fill('#phone', '5555550101');
  await page.selectOption('#format', 'Phone call');
  await page.click('.slot >> nth=0');
  await page.check('input[name=consent_share]');
  await page.click('#book-form button[type=submit]');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('lpf_iul_mock_appointments')).length);
  check('booking re-validates eligibility (tampered session refused)', before === after && (await page.textContent('#book-errors')).includes('isn’t available'));

  // 7. Book page without qualification redirects
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(BASE + '/iul-policy-review/book/');
  await page.waitForURL('**/qualify/');
  check('book requires qualification first', true);

  // 8. Production host: mock scheduler must be off
  if (LOCAL) {
    const p2 = await ctx.newPage();
    const prod = 'http://libertypointefinancial.com/iul-policy-review/';
    await p2.goto(prod + 'qualify/');
    await p2.evaluate(() => sessionStorage.setItem('lpf_qual_iul_policy_review', JSON.stringify({ category: 'existing_iul_review', answers: { owns_iul: 'yes', owner_role: 'self', state: 'UT' }, result: { eligible: true, flags: [] } })));
    await p2.goto(prod + 'book/');
    check('production host: booking closed notice', await p2.isVisible('#booking-closed'));
    check('production host: no booking form', !(await p2.isVisible('#book-form')));
    check('production host: no preview banner', !(await p2.isVisible('.preview-banner')));
    await p2.goto('http://libertypointefinancial.com/funnel-core/preview-tracker/');
    check('production host: tracker disabled', await p2.isVisible('#tracker-off'));
    await p2.close();
  }

  // 9. Mobile layout
  await page.setViewportSize({ width: 375, height: 800 });
  for (const p of ['/iul-policy-review/', '/iul-policy-review/qualify/']) {
    await page.goto(BASE + p);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('no horizontal scroll at 375px ' + p, over <= 0, 'overflow ' + over + 'px');
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  // 10. Existing pages still load
  for (const p of ['/', '/privacy.html', '/insurance-planning.html', '/comparison.html']) {
    const resp = await page.goto(BASE + p);
    check('existing page OK ' + p, resp.status() === 200);
  }
  check('privacy: Pixel excludes qualification answers', (await page.goto(BASE + '/privacy.html'), (await page.textContent('body')).includes('answers to our qualification questions')));

  check('no JS / CSP errors in funnel', errors.filter(e => !/favicon/.test(e)).length === 0, errors.join(' | '));
  check('no lead data sent off-site or to functions', external.length === 0, external.join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
