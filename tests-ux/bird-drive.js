/**
 * Bird UX — connect to your already-logged-in Chrome over CDP and capture the
 * dashboard across viewports for the 6-pillar review.
 *
 * Prereq: run tests-ux/launch-chrome-cdp.sh first and be logged in.
 * Run:    node tests-ux/bird-drive.js
 *
 * Captures into tests-ux/artifacts/: full-page screenshots per viewport,
 * axe-core accessibility violations (JSON), and console/page errors. Bird then
 * reviews these artifacts + the live page and writes UX-REVIEW.md.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const CDP = 'http://localhost:9222';
const DEV_URL =
  'https://script.google.com/macros/s/AKfycbxWLGID2AytbnJzdGzjXRHeUUlLyMH-bFPcyO4zTeFj/dev';
const OUT = path.join(__dirname, 'artifacts');
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP);
  } catch (e) {
    console.error(`Cannot connect to Chrome CDP at ${CDP}. Run tests-ux/launch-chrome-cdp.sh first.\n${e.message}`);
    process.exit(1);
  }
  const ctx = browser.contexts()[0];
  if (!ctx) { console.error('No browser context. Is Chrome open?'); process.exit(1); }

  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  console.log('Navigating to /dev …');
  await page.goto(DEV_URL, { waitUntil: 'networkidle', timeout: 90000 });

  // GAS serves the app inside a sandbox iframe (userCodeAppPanel). Detect it.
  if (/accounts\.google\.com/.test(page.url())) {
    console.error('Landed on Google login — the CDP Chrome is NOT logged in. Log in in that window, then re-run.');
    await page.close(); process.exit(2);
  }

  const summary = { url: page.url(), viewports: {}, consoleErrors: [] };
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(1200);
    const shot = path.join(OUT, `dashboard-${vp.name}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch((e) => console.error('shot fail', e.message));

    // axe-core a11y scan (inject from CDN; runs in the top document)
    let violations = [];
    try {
      await page.addScriptTag({ url: AXE_CDN });
      const res = await page.evaluate(async () => await window.axe.run(document));
      violations = res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help }));
    } catch (e) {
      violations = [{ id: 'axe-failed', impact: 'n/a', n: 0, help: e.message }];
    }
    fs.writeFileSync(path.join(OUT, `axe-${vp.name}.json`), JSON.stringify(violations, null, 2));
    summary.viewports[vp.name] = { screenshot: shot, axeViolations: violations.length };
    console.log(`${vp.name}: shot saved, ${violations.length} axe violation types`);
  }

  summary.consoleErrors = consoleErrors;
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`\nDone. Artifacts in ${OUT}. Console errors: ${consoleErrors.length}`);
  await page.close();
  process.exit(0);
})();
