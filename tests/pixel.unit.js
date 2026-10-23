// Unit checks for funnel-core/pixel.js: when the pixel may load, and that the
// Schedule event only fires for a genuine, first-time, non-mock booking.
// Usage: node tests/pixel.unit.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const cfgSrc = fs.readFileSync(path.join(root, 'funnel-core', 'config.js'), 'utf8');
const pixelSrc = fs.readFileSync(path.join(root, 'funnel-core', 'pixel.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, ok) { console.log((ok ? 'PASS ' : 'FAIL ') + name); ok ? pass++ : fail++; }

function run(host, pixelOverrides) {
  const calls = [];
  const store = {};
  const scripts = [];
  const doc = {
    createElement: () => ({}),
    getElementsByTagName: () => [{ parentNode: { insertBefore: (t) => scripts.push(t.src) } }]
  };
  const win = { location: { hostname: host }, console: { info: () => {} } };
  const ctx = {
    window: win, document: doc, location: win.location, console: win.console,
    localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } }
  };
  vm.createContext(ctx);
  vm.runInContext(cfgSrc, ctx);
  Object.assign(win.LPF_FUNNEL_CONFIG.pixel, pixelOverrides || {});
  vm.runInContext(pixelSrc, ctx);
  if (win.fbq) { const real = win.fbq; win.fbq = function () { calls.push(Array.from(arguments)); return real.apply(this, arguments); }; }
  return { win, calls, scripts, queue: () => (win._fbq ? win._fbq.queue.map(a => Array.from(a)) : []) };
}

const PROD = 'libertypointefinancial.com';
const PREVIEW = 'deploy-preview-3--beautiful-mermaid-c318fb.netlify.app';
const approved = { enabled: true, privacyApproved: true, consentApproved: true };

// Current config: off everywhere.
let r = run(PROD);
check('current config: pixel does not load on production', !r.win.fbq && r.scripts.length === 0);
check('current config: Schedule refused', r.win.LPF_PIXEL.schedule('APT-1', false) === false);
r = run(PROD, { enabled: true });
check('enabled without approvals: does not load', !r.win.fbq);
r = run(PREVIEW, approved);
check('approved but preview host: does not load', !r.win.fbq);

// Approved on production: loads once with safe settings.
r = run(PROD, approved);
const q = r.queue();
check('approved on production: loads fbevents.js once', r.scripts.length === 1 && /connect\.facebook\.net/.test(r.scripts[0]));
check('autoConfig disabled before init', JSON.stringify(q[0]) === JSON.stringify(['set', 'autoConfig', false, '1300792072131335']) && q[1][0] === 'init');
check('init carries no user data (no advanced matching)', q[1].length === 2);
check('PageView tracked, no Schedule on load', q[2][1] === 'PageView' && !q.some(a => a[1] === 'Schedule'));
check('mock booking never sends Schedule', r.win.LPF_PIXEL.schedule('APT-MOCK', true) === false);
check('missing appointment id refused', r.win.LPF_PIXEL.schedule('', false) === false);
check('genuine booking sends Schedule once', r.win.LPF_PIXEL.schedule('APT-REAL', false) === true);
const sched = r.queue().filter(a => a[1] === 'Schedule');
check('Schedule has no custom data, eventID = appointment id', sched.length === 1 && JSON.stringify(sched[0][2]) === '{}' && sched[0][3].eventID === 'APT-REAL');
check('same appointment again (refresh/resubmit) not re-sent', r.win.LPF_PIXEL.schedule('APT-REAL', false) === false && r.queue().filter(a => a[1] === 'Schedule').length === 1);

// Existing fbq on the page: no second initialization.
const calls = [];
const ctx2 = { console: { info() {} }, localStorage: { getItem: () => null, setItem() {} } };
ctx2.window = { location: { hostname: PROD }, fbq: function () { calls.push(arguments); } };
ctx2.location = ctx2.window.location;
ctx2.document = { createElement: () => ({}), getElementsByTagName: () => [{ parentNode: { insertBefore() { calls.push('script'); } } }] };
vm.createContext(ctx2);
vm.runInContext(cfgSrc, ctx2);
Object.assign(ctx2.window.LPF_FUNNEL_CONFIG.pixel, approved);
vm.runInContext(pixelSrc, ctx2);
check('pre-existing fbq: no duplicate init or second loader', calls.length === 0);

console.log(`\n${pass}/${pass + fail} pixel checks passed`);
process.exit(fail ? 1 : 0);
