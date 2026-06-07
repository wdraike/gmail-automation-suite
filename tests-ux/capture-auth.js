/**
 * Bird UX — one-time Google session capture.
 *
 * Opens a real (headed) Chromium, navigates to the dashboard /dev URL, and waits
 * while YOU log in to wdraike@gmail.com manually (handles 2FA, consent, etc.).
 * Once the dashboard has rendered, press ENTER in this terminal and the script
 * saves your authenticated session to tests-ux/.auth/state.json (gitignored).
 * Bird's Playwright runs then reuse that state so they never hit the login wall.
 *
 * Run:  ! node tests-ux/capture-auth.js
 * (Installs Playwright + Chromium on first run via npx if needed.)
 */
const path = require('path');
const readline = require('readline');

const DEV_URL =
  'https://script.google.com/macros/s/AKfycbxWLGID2AytbnJzdGzjXRHeUUlLyMH-bFPcyO4zTeFj/dev';
const AUTH_DIR = path.join(__dirname, '.auth');
const STATE_PATH = path.join(AUTH_DIR, 'state.json');

(async () => {
  const fs = require('fs');
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    console.error('\nPlaywright not installed. Run first:\n  npx playwright install chromium\nthen re-run this script.\n');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('\nOpening dashboard /dev URL. Log in as wdraike@gmail.com in the window…');
  await page.goto(DEV_URL, { waitUntil: 'load', timeout: 120000 }).catch(() => {});

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) =>
    rl.question(
      '\nAfter the DASHBOARD is fully visible, press ENTER here to save the session… ',
      () => resolve()
    )
  );
  rl.close();

  await context.storageState({ path: STATE_PATH });
  console.log(`\nSaved authenticated session -> ${STATE_PATH}`);
  await browser.close();
  process.exit(0);
})();
