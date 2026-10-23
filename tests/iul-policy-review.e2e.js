// End-to-end check of the IUL policy review funnel.
// Usage: serve the repo root (e.g. `python3 -m http.server 8811`), then
//   BASE=http://localhost:8811 node tests/iul-policy-review.e2e.js
// Set BASE to a Netlify Deploy Preview URL to test the preview itself.
// Requires the `playwright` package (global install is fine: NODE_PATH=$(npm root -g)).
// MOBILE=1 runs the whole journey as a phone (390x844, touch).
const { chromium, devices } = require('playwright');
const vm = require('vm');
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
  const MOBILE = !!process.env.MOBILE;
  const ctx = await browser.newContext(Object.assign({ acceptDownloads: true }, MOBILE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 900 } }));
  console.log('Viewport: ' + (MOBILE ? 'mobile 390x844' : 'desktop 1280x900'));
  const pixelLog = [];
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  const ytRequests = []; // the video player: allowed, but only after the visitor presses play
  // Only funnel pages count; existing pages load third-party scripts (Meta Pixel).
  const onFunnel = () => /\/(iul-policy-review|iul-education|funnel-core)\//.test(page.url());
  page.on('pageerror', e => { if (onFunnel()) errors.push(e.message); });
  page.on('console', m => {
    if (m.type() === 'error' && onFunnel()) errors.push(m.text());
    if (/^\[pixel\]/.test(m.text())) pixelLog.push(m.text());
  });
  page.on('request', r => {
    if (/^https:\/\/(www\.)?youtube-nocookie\.com\//.test(r.url())) { ytRequests.push(r.url()); return; }
    if (!/\/(iul-policy-review|iul-education|funnel-core)\//.test(r.frame().url())) return;
    const u = new URL(r.url());
    if (u.origin !== new URL(BASE).origin && !/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) external.push(r.url());
    if (u.pathname.startsWith('/.netlify/functions')) external.push('FUNCTION ' + r.url());
  });
  // The sandbox can't reach YouTube: stand in a stub player page for the embed.
  await ctx.route(/youtube-nocookie\.com\/embed\//, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stub player</title><p>player</p>' }));
  if (LOCAL) {
    const csp = cspFromHeaders();
    await ctx.route(/\/(iul-policy-review|iul-education|funnel-core)\//, async route => {
      const resp = await route.fetch({ url: route.request().url().replace('http://libertypointefinancial.com', BASE) });
      const headers = Object.assign({}, resp.headers());
      if (csp && /text\/html/.test(headers['content-type'] || '')) headers['content-security-policy'] = csp;
      await route.fulfill({ response: resp, headers });
    });
  }
  const shot = async n => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, (MOBILE ? 'm-' : '') + n + '.png'), fullPage: true }); };

  // Canonical disclosures from config, to check every page uses them verbatim.
  const cfgCtx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'funnel-core', 'config.js'), 'utf8'), cfgCtx);
  const DISC = cfgCtx.window.LPF_FUNNEL_CONFIG.disclosures;
  async function disclosuresMatch(noun) {
    const got = await page.$$eval('[data-disclosure]', els => els.map(e => [e.getAttribute('data-disclosure'), e.textContent.replace(/\s+/g, ' ').trim()]));
    return got.length >= 2 && got.every(([k, t]) => t === DISC[k].replace('{noun}', noun));
  }

  // 1. Landing
  await page.goto(BASE + '/iul-policy-review/?utm_source=facebook&utm_medium=paid&utm_campaign=iul_review_test&utm_content=ad1');
  check('landing loads', (await page.title()).includes('IUL Policy Review'));
  check('preview banner shown', await page.isVisible('.preview-banner'));
  check('Dave named on landing', (await page.textContent('body')).includes('Dave Weiner'));
  check('video heading', (await page.locator('h2', { hasText: 'Is your IUL still aligned with your goals?' }).count()) === 1);
  check('video poster shown, no player or video requests before play', await page.$eval('[data-video] .video-poster img', i => i.complete && i.naturalWidth > 0) && (await page.$$('[data-video] iframe')).length === 0 && ytRequests.length === 0);
  const vbox = await page.locator('[data-video]').boundingBox();
  const vw = await page.evaluate(() => document.documentElement.clientWidth);
  check('player is 16:9 and fits the viewport', Math.abs(vbox.width / vbox.height - 16 / 9) < 0.02 && vbox.x >= 0 && vbox.x + vbox.width <= vw, Math.round(vbox.width) + 'x' + Math.round(vbox.height) + ' in ' + vw);
  const cbox = await page.locator('a[data-cta="video"]').boundingBox();
  check('"See if a review is a fit" directly below the player', cbox && cbox.y >= vbox.y + vbox.height && cbox.y - (vbox.y + vbox.height) < 90 && (await page.textContent('a[data-cta="video"]')).includes('See if a review is a fit'));
  check('video CTA goes to qualification', (await page.getAttribute('a[data-cta="video"]', 'href')) === '/iul-policy-review/qualify/');
  check('relationship, compensation and replacement disclosures below the video', await page.$$eval('.video-disclosures [data-disclosure]', els => els.map(e => e.getAttribute('data-disclosure')).join()) === 'identity,compensation,replacement' && await disclosuresMatch('review'));
  await page.click('[data-video] .video-poster');
  const ifr = await page.waitForSelector('[data-video] iframe');
  const src = await ifr.getAttribute('src');
  check('play loads the final video (nocookie, captions on, plays only after the click)', src.startsWith('https://www.youtube-nocookie.com/embed/kc2FcJTRF-s?') && /autoplay=1/.test(src) && /cc_load_policy=1/.test(src) && ytRequests.length > 0, src);
  check('player has controls and fullscreen', (await ifr.getAttribute('allowfullscreen')) !== null && /fullscreen/.test(await ifr.getAttribute('allow')) && !/controls=0/.test(src));
  const ibox = await ifr.boundingBox();
  check('player fills the 16:9 frame', Math.abs(ibox.width - vbox.width) < 2 && Math.abs(ibox.height - vbox.height) < 2);
  await shot('1b-video-playing');
  await page.click('a[data-cta="video"]');
  await page.waitForURL('**/iul-policy-review/qualify/');
  check('video play and CTA click send no completed-booking event', !pixelLog.some(l => l.includes('Schedule')) && await page.evaluate(() => typeof window.fbq === 'undefined'));
  await page.goto(BASE + '/iul-policy-review/book/');
  await page.waitForURL('**/qualify/**').catch(() => {});
  check('calendar still needs qualification first', page.url().includes('/qualify/'), page.url());
  await page.goto(BASE + '/iul-policy-review/');
  check('Dave photo shown with alt text', await page.$eval('[data-pro-avatar] img', i => i.complete && i.naturalWidth > 0 && i.alt === 'Photo of Dave Weiner'));
  check('pixel off on preview (no fbq, nothing loaded)', await page.evaluate(() => typeof window.fbq === 'undefined') && pixelLog.some(l => l.includes('off:')));
  const lic = await page.textContent('[data-license-line]');
  check('license line: legal name, NPN, states (verified, no pending note)', lic.includes('David M. Weiner') && lic.includes('760178') && lic.includes('Wisconsin') && !lic.includes('Alaska') && !lic.includes('pending NIPR verification'));
  const bio = await page.textContent('[data-pro="bio"]');
  check('preview bio: since 1982, marked pending approval, no superlatives', bio.includes('since 1982') && bio.includes('pending approval') && !/best|#1|top |leading/i.test(bio));
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

  check('education link hidden while category B is planned', !(await page.isVisible('#nf-crosslink')));

  // 2b. Unlicensed state (Alaska) is refused
  await page.goto(BASE + '/iul-policy-review/qualify/');
  await page.check('input[name=owns_iul][value="yes"]');
  await page.check('input[name=owner_role][value="self"]');
  await page.check('input[name=issue_period][value="before_2021"]');
  await page.selectOption('#state', 'AK');
  await page.check('input[name=annual_premium][value="2500_5000"]');
  await page.check('input[name=has_statement][value="yes"]');
  await page.click('#qualify-form button[type=submit]');
  await page.waitForURL('**/not-a-fit/');
  check('A: unlicensed state (AK) not eligible', (await page.textContent('#nf-message')).includes('licensed in your state'));

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
  check('preview shows missing-config warning', (await page.isVisible('#config-warning')) && (await page.textContent('#config-warning')).includes('bio not approved'));
  const shareTxt = await page.textContent('#consent-share-text');
  check('consent names recipient + offer-specific purpose', shareTxt.includes('Dave Weiner') && shareTxt.includes('conduct my IUL policy review'));
  const smsTxt = await page.textContent('#consent-sms-text');
  check('SMS consent separate, wording before links', smsTxt.indexOf('Text me') < smsTxt.indexOf('See our'));
  const disc = await page.textContent('#disclosures');
  check('disclosures name Dave and agency', disc.includes('Dave Weiner') && disc.includes('Global Renaissance Insurance Marketing Agency'));
  check('disclosures state compensation', /compensated/.test(disc));
  check('standard disclosures on A booking page', await disclosuresMatch('review'));
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
  check('confirmation links to Dave\'s agency site in a new tab', await page.$eval('[data-pro-website]', a => a.href === 'https://globalrenins.com/about/' && a.target === '_blank' && /noopener/.test(a.rel) && a.offsetParent !== null));
  check('mock booking did not send Schedule', pixelLog.some(l => l.includes('Schedule not sent: mock booking')) && await page.evaluate(() => typeof window.fbq === 'undefined'));
  const logLen = pixelLog.length;
  await page.reload();
  check('confirmation refresh never attempts Schedule', !pixelLog.slice(logLen).some(l => l.includes('Schedule')));
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
  check('category report: B row has its own status', (await page.textContent('#compare-rows tr[data-category="prospective_iul_education"]')).includes('preview'));
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

  // 8b. Segment B: IUL education funnel (preview)
  await page.goto(BASE + '/iul-education/?utm_source=facebook&utm_campaign=iul_education_test');
  const bText = await page.textContent('main');
  check('B landing loads with Dave', (await page.title()).includes('IUL Education') && bText.includes('Dave Weiner'));
  check('B covers costs, underwriting, caps, lapse/loan risk, alternatives', ['surrender charges', 'underwriting', 'Caps and participation rates', 'lapse', 'Term life', 'Whole life'].every(t => bText.toLowerCase().includes(t.toLowerCase())));
  check('B says IUL is not right for everyone', /isn.t the right fit for everyone/.test(bText));
  check('B makes no return promises', !/guaranteed (returns|growth)|tax-free retirement|never lose/i.test(bText));
  const faqLinks = await page.$$eval('main a[href^="/iul-policy-review"]', as => as.map(a => a.closest('.faq') ? 'faq' : 'other'));
  check('B links to IUL Policy Review from the FAQ only', faqLinks.length === 1 && faqLinks[0] === 'faq');
  // existing owner → not a fit, no automatic transfer
  await page.click('a[data-cta="hero"]');
  await page.waitForURL('**/iul-education/qualify/');
  await page.check('input[name=owns_iul][value="yes"]');
  await page.check('input[name=learning_goal][value="cash_value"]');
  await page.check('input[name=current_coverage][value="term"]');
  await page.selectOption('#age_range', '35_49');
  await page.selectOption('#state', 'UT');
  await page.click('#qualify-form button[type=submit]');
  await page.waitForURL('**/iul-education/not-a-fit/');
  check('B: IUL owner routed to not-a-fit', (await page.textContent('#nf-message')).includes('already own'));
  check('B: cross-link to policy review hidden while A is not live', !(await page.isVisible('#nf-crosslink')));
  check('B: answers cleared after not-a-fit', await page.evaluate(() => !sessionStorage.getItem('lpf_qual_iul_education')));
  // under 18
  await page.goto(BASE + '/iul-education/qualify/');
  await page.check('input[name=owns_iul][value="no"]');
  await page.check('input[name=learning_goal][value="protect_income"]');
  await page.check('input[name=current_coverage][value="none"]');
  await page.selectOption('#age_range', 'under_18');
  await page.selectOption('#state', 'UT');
  await page.click('#qualify-form button[type=submit]');
  await page.waitForURL('**/iul-education/not-a-fit/');
  check('B: under 18 not eligible', (await page.textContent('#nf-message')).includes('18'));
  // unlicensed state
  await page.goto(BASE + '/iul-education/qualify/');
  await page.check('input[name=owns_iul][value="no"]');
  await page.check('input[name=learning_goal][value="protect_income"]');
  await page.check('input[name=current_coverage][value="none"]');
  await page.selectOption('#age_range', '35_49');
  await page.selectOption('#state', 'WY');
  await page.click('#qualify-form button[type=submit]');
  await page.waitForURL('**/iul-education/not-a-fit/');
  check('B: unlicensed state (WY) not eligible', (await page.textContent('#nf-message')).includes('licensed in your state'));
  // eligible path
  await page.goto(BASE + '/iul-education/qualify/');
  await page.check('input[name=owns_iul][value="no"]');
  await page.check('input[name=learning_goal][value="compare_types"]');
  await page.check('input[name=current_coverage][value="work_only"]');
  await page.selectOption('#age_range', '35_49');
  await page.selectOption('#state', 'UT');
  await page.click('#qualify-form button[type=submit]');
  await page.waitForURL('**/iul-education/book/');
  const bShare = await page.textContent('#consent-share-text');
  check('B consent names Dave + education purpose', bShare.includes('Dave Weiner') && bShare.includes('conduct my IUL education consultation') && !bShare.includes('policy review'));
  check('B disclosures: not right for everyone', (await page.textContent('#disclosures')).includes('Not right for everyone'));
  check('standard disclosures on B booking page', await disclosuresMatch('consultation'));
  check('B booking page shows Dave photo', await page.$eval('[data-pro-avatar] img', i => i.complete && i.naturalWidth > 0));
  await page.fill('#first_name', 'Bea'); await page.fill('#last_name', 'Buyer');
  await page.fill('#email', 'bea@example.com'); await page.fill('#phone', '5555550123');
  await page.selectOption('#format', 'Phone call');
  await page.click('.slot >> nth=0');
  await page.check('input[name=consent_share]');
  await shot('6-b-book');
  await page.click('#book-form button[type=submit]');
  await page.waitForURL('**/iul-education/confirmed/');
  check('B confirmation shows the education offer', (await page.textContent('#c-summary')).includes('IUL Education & Consultation'));
  const bRec = await page.evaluate(() => JSON.parse(localStorage.getItem('lpf_iul_mock_appointments')).find(a => a.contact.first_name === 'Bea'));
  check('B record: category, origin, consent purpose, attribution', bRec.category === 'prospective_iul_education' && bRec.originating_segment === 'iul_education' && bRec.consents.share_with_recipient.category === 'prospective_iul_education' && bRec.consents.sms.given === false && bRec.attribution.utm_campaign === 'iul_education_test');
  await page.goto(BASE + '/funnel-core/preview-tracker/');
  const bRow = await page.textContent('#compare-rows tr[data-category="prospective_iul_education"]');
  check('tracker reports B separately', bRow.includes('preview') && /^\D*B: Prospective IUL buyers.*?1 \(1\)/.test(bRow));
  if (LOCAL) {
    const p3 = await ctx.newPage();
    await p3.goto('http://libertypointefinancial.com/iul-education/qualify/');
    await p3.evaluate(() => sessionStorage.setItem('lpf_qual_iul_education', JSON.stringify({ category: 'prospective_iul_education', answers: { owns_iul: 'no', age_range: '35_49', state: 'UT' }, result: { eligible: true, flags: [] } })));
    await p3.goto('http://libertypointefinancial.com/iul-education/book/');
    check('B production host: booking closed', (await p3.isVisible('#booking-closed')) && !(await p3.isVisible('#book-form')));
    await p3.close();
  }

  // 8c. Same identification + compensation disclosures on every funnel page
  for (const [base, noun] of [['/iul-policy-review/', 'review'], ['/iul-education/', 'consultation']]) {
    for (const sub of ['', 'qualify/', 'not-a-fit/', 'confirmed/']) {
      await page.goto(BASE + base + sub);
      check('standard disclosures on ' + base + sub, await disclosuresMatch(noun));
    }
  }
  if (LOCAL) {
    const p4 = await ctx.newPage();
    await p4.goto('http://libertypointefinancial.com/iul-policy-review/');
    check('production host: verified license line shown', await p4.isVisible('[data-license-line]') && (await p4.textContent('[data-license-line]')).includes('760178'));
    check('production host: unapproved bio hidden', !(await p4.isVisible('[data-pro="bio"]')));
    check('production host: pixel stays off', await p4.evaluate(() => typeof window.fbq === 'undefined'));
    await p4.close();
  }

  // 8b. Live booking via Calendly, simulated: production host, config with
  // every launch item marked done and a scheduler link, Calendly stubbed.
  if (LOCAL) {
    const p5 = await ctx.newPage();
    const p5errors = [];
    p5.on('pageerror', e => p5errors.push(e.message));
    p5.on('console', m => { if (m.type() === 'error') p5errors.push(m.text()); });
    await p5.route('**/funnel-core/config.js', async route => {
      const body = fs.readFileSync(path.join(__dirname, '..', 'funnel-core', 'config.js'), 'utf8') + `
(function (c) {
  c.liveBookingEnabled = true;
  var r = c.recipients.dave_weiner; r.license.verifiedAgainstNipr = true; r.license.lifeLineOfAuthorityConfirmed = true; r.bioApproved = true;
  var k = c.categories.existing_iul_review; k.status = 'live'; k.recipientConfirmed = true; k.acceptanceCriteriaConfirmed = true;
  k.availability.confirmed = true; k.availability.timezone = 'America/New_York'; k.scheduler.url = 'https://calendly.com/test-dave/iul-review';
})(window.LPF_FUNNEL_CONFIG);`;
      await route.fulfill({ contentType: 'application/javascript', body });
    });
    await p5.route(/^https:\/\/calendly\.com\//, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stub calendly</title><button id="pick" onclick="parent.postMessage({event:\'calendly.event_scheduled\',payload:{event:{uri:\'https://api.calendly.com/scheduled_events/EV1\'},invitee:{uri:\'https://api.calendly.com/scheduled_events/EV1/invitees/INV12345678\'}}},\'*\')">Book</button>' }));
    await p5.goto('http://libertypointefinancial.com/iul-policy-review/?utm_source=facebook&utm_campaign=live_test');
    const liveText = await p5.evaluate(() => document.body.innerText);
    check('live landing: no preview notes or [CONFIRM] text', !/\[CONFIRM|Preview/i.test(liveText) && !(await p5.isVisible('.preview-banner')));
    await p5.evaluate(() => sessionStorage.setItem('lpf_qual_iul_policy_review', JSON.stringify({ category: 'existing_iul_review', answers: { owns_iul: 'yes', owner_role: 'self', state: 'FL' }, result: { eligible: true, flags: [] } })));
    await p5.goto('http://libertypointefinancial.com/iul-policy-review/book/');
    check('live book: Calendly panel shown, mock form hidden', await p5.isVisible('#live-booking') && !(await p5.isVisible('#book-form')) && !(await p5.isVisible('#booking-closed')));
    check('live book: no preview notes or [CONFIRM] text', !/\[CONFIRM|Preview/i.test(await p5.evaluate(() => document.body.innerText)));
    check('live book: times hidden until consent', await p5.isDisabled('#live-open') && (await p5.$$('#live-scheduler iframe')).length === 0);
    check('live book: consent names Dave and his agency', (await p5.textContent('#live-consent-text')).includes('Dave Weiner and Global Renaissance Insurance Marketing Agency'));
    await p5.check('#live-consent');
    await p5.click('#live-open');
    const cal = await p5.waitForSelector('#live-scheduler iframe');
    const calSrc = await cal.getAttribute('src');
    check('live book: Calendly loads with UTM only (no answers)', calSrc.startsWith('https://calendly.com/test-dave/iul-review?') && /embed_domain=libertypointefinancial\.com/.test(calSrc) && /utm_source=facebook/.test(calSrc) && !/owns_iul|state=|FL/.test(calSrc), calSrc);
    const fr = await cal.contentFrame();
    await fr.click('#pick');
    await p5.waitForURL('**/iul-policy-review/confirmed/');
    check('live confirmation shown after Calendly booking', (await p5.textContent('#c-summary')).includes('Calendly has emailed') && !(await p5.isVisible('#ics-btn')) && await p5.isVisible('[data-pro-website]'));
    check('live confirmation: no preview notes', !/\[CONFIRM|Preview/i.test(await p5.evaluate(() => document.body.innerText)));
    const p5real = p5errors.filter(e => !/logo\.png|ERR_FAILED/.test(e)); // local host-mapping artifact for the site logo
    check('live flow: no JS / CSP errors', p5real.length === 0, p5real.join(' | '));
    await p5.close();
  }

  // 9. Mobile layout
  if (!MOBILE) await page.setViewportSize({ width: 375, height: 800 });
  for (const p of ['/iul-policy-review/', '/iul-policy-review/qualify/', '/iul-education/', '/iul-education/book/']) {
    await page.goto(BASE + p);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('no horizontal scroll at ' + (MOBILE ? '390' : '375') + 'px ' + p, over <= 0, 'overflow ' + over + 'px');
  }
  if (!MOBILE) await page.setViewportSize({ width: 1280, height: 900 });

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
