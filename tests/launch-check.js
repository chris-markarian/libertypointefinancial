// Publication gate: fails if any appointment category marked 'live' (or live
// booking switched on) is missing required configuration.
// Usage: node tests/launch-check.js   (also prints what each category still needs)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'funnel-core', 'config.js'), 'utf8'), ctx);
const cfg = ctx.window.LPF_FUNNEL_CONFIG;
const problems = ctx.window.LPF_CONFIG_PROBLEMS;

let failed = false;
for (const id of Object.keys(cfg.categories)) {
  const cat = cfg.categories[id];
  const p = problems(cfg, id);
  console.log(`${id} [${cat.status}]: ${p.length ? p.join('; ') : 'complete'}`);
  if (cat.status === 'live' && p.length) failed = true;
}
const live = Object.keys(cfg.categories).filter(id => cfg.categories[id].status === 'live');
const px = cfg.pixel || {};
console.log(`pixel on funnel pages: ${px.enabled ? 'ENABLED' : 'disabled'} (privacy approved: ${!!px.privacyApproved}, consent approved: ${!!px.consentApproved})`);
if (px.enabled && (!px.privacyApproved || !px.consentApproved)) { console.log('Pixel is enabled without recorded privacy/consent approval'); failed = true; }
if (px.enabled && !/^\d{10,20}$/.test(px.id || '')) { console.log('Pixel is enabled without a valid pixel id'); failed = true; }
if (cfg.liveBookingEnabled && !live.length) { console.log('liveBookingEnabled is on but no category is live'); failed = true; }
if (live.length > 1) { console.log('More than one category is live: launches need separate approval'); failed = true; }
console.log(failed ? '\nLAUNCH CHECK FAILED' : '\nLaunch check passed (no live category has missing configuration)');
process.exit(failed ? 1 : 0);
