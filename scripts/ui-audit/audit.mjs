// Real-browser layout and motion audit. Opt-in developer tool, not part of CI:
// it needs Playwright with Chromium and the preview from serve.mjs running.
//   node scripts/ui-audit/audit.mjs [output-directory]
// Exit code 1 means a page overflowed horizontally, pushed a control off
// screen, logged an error, or a motion check failed.
import { createRequire } from 'node:module';
import fs from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const S = `http://127.0.0.1:${process.env.SENTINEL_PORT || 8801}`;
const C = `http://127.0.0.1:${process.env.CORE_PORT || 8802}`;
const out = process.argv[2] || 'ui-audit-output';
fs.mkdirSync(out, { recursive: true });

const viewports = [
  { name: 'm320', width: 320, height: 640, mobile: true },
  { name: 'm390', width: 390, height: 844, mobile: true },
  { name: 't768', width: 768, height: 1024, mobile: true },
  { name: 'd1440', width: 1440, height: 900, mobile: false },
];
const sentinelPages = ['overview', 'assistant', 'code', 'incidents', 'intel', 'lab', 'terminal', 'reports', 'agents', 'settings'];
const standalone = [[S + '/osint/', 'sentinel-osint'], [S + '/audit/', 'sentinel-audit'], [C + '/', 'core-nexus-gate'],
  [C + '/workspace', 'core-workspace'], [C + '/academy', 'core-academy'], [C + '/suite/', 'core-suite']];

// Runs inside the page.
const measure = () => {
  const vw = window.innerWidth;
  const shown = el => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const offScreen = [], oversized = [], tiny = new Map();
  for (const el of document.body.querySelectorAll('*')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const label = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).split(' ')[0]}`;
    if ((r.right > vw + 1 || r.left < -1) && !el.closest('.overlay,.drawer,[hidden]')) {
      let parent = el.parentElement, clipped = false;
      while (parent && parent !== document.body) {
        if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(parent).overflowX)) { clipped = true; break; }
        parent = parent.parentElement;
      }
      if (!clipped && offScreen.length < 6) offScreen.push(`${label} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    }
    // A fixed link or button taller than half the screen covers the page (seen on the NEXUS gate).
    if (cs.position === 'fixed' && /^(A|BUTTON)$/.test(el.tagName) && r.height > window.innerHeight / 2) oversized.push(`${label} ${Math.round(r.width)}x${Math.round(r.height)}`);
    if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) {
      const size = parseFloat(cs.fontSize);
      if (size < 10.5) tiny.set(size, (tiny.get(size) || 0) + 1);
    }
  }
  return {
    overflowX: document.documentElement.scrollWidth - vw, offScreen, oversized,
    tiny: [...tiny.entries()].sort((a, b) => a[0] - b[0]).map(([size, count]) => `${size}px×${count}`).join(' '),
  };
};

const browser = await chromium.launch();
const rows = [];
let failed = false;

for (const vp of viewports) {
  // Reduced motion gives stable full-page screenshots; motion itself is checked separately below.
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, reducedMotion: 'reduce' });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message).slice(0, 160)));
  page.on('response', r => { if (r.status() >= 400 && !/fonts\./.test(r.url())) errors.push(`http ${r.status()} ${new URL(r.url()).pathname}`); });
  const record = async target => {
    const m = await page.evaluate(measure);
    rows.push({ viewport: vp.name, target, ...m, errors: [...new Set(errors.splice(0))] });
    await page.screenshot({ path: `${out}/${vp.name}-${target}.png`, fullPage: true });
  };
  await page.goto(S + '/', { waitUntil: 'load' });
  for (const name of sentinelPages) {
    await page.evaluate(n => document.querySelector(`.nav [data-page="${n}"]`).click(), name);
    await page.waitForTimeout(300);
    await record('sentinel-' + name);
  }
  for (const [url, label] of standalone) {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(label === 'core-nexus-gate' ? 2500 : 600); // the gate follows a splash
    await record(label);
  }
  await context.close();
}

// Motion behaviour on a fine-pointer desktop, then with reduced motion.
const motion = {};
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  const page = await context.newPage();
  await page.goto(S + '/', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  motion.desktopLenis = await page.evaluate(() => document.documentElement.classList.contains('lenis'));
  for (let i = 0; i < 40; i++) {
    await page.evaluate(n => document.querySelector(`.nav [data-page="${n}"]`).click(), sentinelPages[i % sentinelPages.length]);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(900);
  Object.assign(motion, await page.evaluate(() => ({
    triggersAfter40Switches: ScrollTrigger.getAll().length,
    activeTweensAfterSettle: gsap.globalTimeline.getChildren(true, true, true).filter(t => t.isActive()).length,
    leftoverInlineOpacity: [...document.querySelectorAll('.page *')].filter(el => el.style.opacity !== '').length,
  })));
  await context.close();
}
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  const page = await context.newPage();
  await page.goto(S + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  motion.reducedMotionLenis = await page.evaluate(() => document.documentElement.classList.contains('lenis'));
  motion.reducedMotionTriggers = await page.evaluate(() => ScrollTrigger.getAll().length);
  await context.close();
}
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  const page = await context.newPage();
  await page.goto(S + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  motion.touchLenis = await page.evaluate(() => document.documentElement.classList.contains('lenis'));
  await context.close();
}
await browser.close();

for (const row of rows) {
  const flags = [];
  if (row.overflowX > 1) flags.push(`horizontal overflow +${row.overflowX}px`);
  if (row.offScreen.length) flags.push('off-screen: ' + row.offScreen.join(' | '));
  if (row.oversized.length) flags.push('oversized fixed control: ' + row.oversized.join(' | '));
  if (row.errors.length) flags.push('errors: ' + row.errors.join(' | '));
  if (flags.length) failed = true;
  console.log(`${row.viewport.padEnd(6)} ${row.target.padEnd(20)} ${flags.length ? 'FAIL ' + flags.join(' ;; ') : 'ok'}${row.tiny ? '  (text under 10.5px: ' + row.tiny + ')' : ''}`);
}
const motionOk = motion.desktopLenis === true && motion.touchLenis === false && motion.reducedMotionLenis === false
  && motion.reducedMotionTriggers === 0 && motion.triggersAfter40Switches <= 28
  && motion.activeTweensAfterSettle === 0 && motion.leftoverInlineOpacity === 0;
console.log('motion', JSON.stringify(motion), motionOk ? 'ok' : 'FAIL');
fs.writeFileSync(`${out}/report.json`, JSON.stringify({ rows, motion }, null, 1));
process.exitCode = failed || !motionOk ? 1 : 0;
