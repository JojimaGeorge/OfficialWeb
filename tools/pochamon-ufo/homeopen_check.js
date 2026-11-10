// 外れの回に定位置で爪が一回開いて閉じるか（11/10 夜）：return の間の爪の角度を時系列で
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:4876/pochamon-ufo/?nosw=1');
  await page.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
  await page.evaluate(() => { window.__ufo.force(['lose', 'win', 'lose']); window.__ufo.tap(); });
  await page.waitForFunction(() => window.__ufo.state().phase === 'moveX', null, { timeout: 30000 });
  const log = await page.evaluate(() => {
    const U = window.__ufo, R = U.raw(); U.timeScale(0); const out = [];
    for (let round = 0; round < 3; round++) {
      const t = R.toys.find((o) => String(o.id) === '3'); U.aimAt(t.hold.x + t.dx, t.hold.y + t.dy);
      U.phase('settle'); let last = '', seq = [];
      for (let i = 0; i < 4000; i++) {
        const ph = U.step(1 / 60), a = Math.round(R.claw.arm);
        if (ph === 'return') { if (!seq.length || seq[seq.length - 1] !== a) seq.push(a); }
        if (ph !== last) { out.push(round + ':' + ph); last = ph; }
        if (ph === 'between' || ph === 'result') break;
      }
      out.push('return arm: ' + seq.filter((v, i) => i === 0 || i === seq.length - 1 || v === -18 || v === 16).join(' → ') + ' (min ' + Math.min(...seq) + ')');
      if (U.state().phase === 'between') U.phase('moveX');
    }
    return out;
  });
  console.log(log.join('\n')); console.log('errors:', errs.length ? errs : 'none'); await b.close();
})();
