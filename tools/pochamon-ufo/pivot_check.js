// 持った子が爪先の所を軸に回るか（11/10 夜）：持ち上げ〜運ぶ間、爪先の画面の位置と、子の「爪が当たっていた点」の画面の位置の離れ（px）
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  if (process.argv.includes('--norot')) {   // 比べ用：ずれを回さない形
    const src = require('fs').readFileSync(path.join(__dirname, '..', '..', 'main', 'pochamon-ufo', 'game.js'), 'utf8').replace('if (t.pinUV) pinToTip(', 'if (false) pinToTip(');
    await page.route('**/pochamon-ufo/game.js*', (r) => r.fulfill({ body: src, contentType: 'application/javascript' }));
  }
  await page.goto('http://localhost:4876/pochamon-ufo/?nosw=1');
  await page.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
  await page.evaluate(() => { window.__ufo.force(['win', 'win', 'win']); window.__ufo.tap(); });
  await page.waitForFunction(() => window.__ufo.state().phase === 'moveX', null, { timeout: 30000 });
  const r = await page.evaluate(() => {
    const U = window.__ufo, R = U.raw(), P = R.project, C = R.claw; U.timeScale(0); const res = {};
    for (const id of ['3', '24', '7', '12']) {
      for (const t of R.toys) { if (t.state !== 'rest') { t.state = 'rest'; t.dx = t.dy = t.dz = t.rot = 0; } }
      C.held = null; R.game.tryIndex = 0;
      const t = R.toys.find((o) => String(o.id) === id); U.aimAt(t.hold.x + t.dx + 0.02, t.hold.y + t.dy); C.x = C.cx; C.y = C.cy;
      U.phase('descend'); let worst = 0, n = 0, rotMax = 0, c0 = null;
      for (let i = 0; i < 3000; i++) {
        const ph = U.step(1 / 60);
        if (C.held === t && t.attach >= 1) { const e = U.pinErr(); if (e != null) { worst = Math.max(worst, e); n++; rotMax = Math.max(rotMax, Math.abs(t.rot - (t.restRot || 0))); } }
        if (ph === 'release' || ph === 'return') break;
      }
      res[id] = { drift_px: +worst.toFixed(1), rotMax_deg: +(rotMax * 57.3).toFixed(1), samples: n };
    }
    return res;
  });
  console.log(JSON.stringify(r), 'errors:', errs.length ? errs : 'none'); await b.close();
})();
