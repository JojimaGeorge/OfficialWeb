// つかむ瞬間と持ち上げを、決まった場所で前（?grip=old）と後で撮り比べる
//   node tools/pochamon-ufo/grip_shots.js   → tools/pochamon-ufo/shots/grip/
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));
const outDir = path.join(__dirname, 'shots', 'grip'); fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  // 撮る所：ふつうに届く子の中から止まる角度の違うもの・前は浮いていた子
  const pick = async (page) => page.evaluate(() => {
    const U = window.__ufo, R = U.raw(), res = [];
    const want = { '3': 'grip', '12': 'grip', '24': 'grip', '16': 'grip', '7': 'grip', '10': 'nogrip', '18': 'nogrip', '2': 'nogrip' };
    for (const [id, kind] of Object.entries(want)) {
      const t = R.toys.find((o) => String(o.id) === id); let best = null;
      for (let dx = -0.08; dx <= 0.08; dx += 0.01) for (let dy = -0.08; dy <= 0.08; dy += 0.01) {
        const x = t.hold.x + dx, y = t.hold.y + dy, q = U.probeAim(x, y);
        if (String(q.target) !== id || (kind === 'grip') !== !!q.grip) continue;
        const d = Math.hypot(dx, dy); if (!best || d < best.d) best = { id, kind, x, y, d, hold: q.grip && q.grip.hold };
      }
      if (best) res.push(best);
    }
    return res;
  });
  for (const mode of ['new', 'old']) {
    const page = await (await b.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 })).newPage();
    await page.goto('http://localhost:4876/pochamon-ufo/?nosw=1' + (mode === 'old' ? '&grip=old&homeopen=0' : ''));
    await page.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
    const cases = mode === 'new' ? await pick(page) : JSON.parse(fs.readFileSync(path.join(outDir, 'cases.json'), 'utf8'));
    if (mode === 'new') fs.writeFileSync(path.join(outDir, 'cases.json'), JSON.stringify(cases));
    await page.evaluate(() => { window.__ufo.force(['lose', 'lose', 'lose']); window.__ufo.tap(); });
    await page.waitForFunction(() => window.__ufo.state().phase === 'moveX', null, { timeout: 30000 });
    await sleep(500);
    for (const c of cases) {
      await page.evaluate((c) => {
        const U = window.__ufo; U.timeScale(0); U.force(['lose', 'lose', 'lose']);
        const R = U.raw(); for (const t of R.toys) { if (t.state !== 'rest') { t.state = 'rest'; t.dx = t.dy = t.dz = t.rot = 0; } }
        R.claw.held = null; U.aimAt(c.x, c.y); R.claw.x = c.x; R.claw.y = c.y; R.claw.wx = R.claw.wy = 0;
        R.game.forcedSlip = { mode: 'top', at: 0.3 };
        U.phase('descend');
      }, c);
      const clip = async () => page.evaluate(() => { const R = window.__ufo.raw(), p = R.project(R.claw.x, R.claw.y, R.claw.z - 0.08), v = R.view; return { x: Math.max(0, v.ox + p.u * v.k - 170), y: Math.max(0, v.oy + p.v * v.k - 150), width: 340, height: 340 }; });
      // 下りきって閉じ終わるまで
      for (let i = 0; i < 400; i++) { const ph = await page.evaluate(() => window.__ufo.step(1 / 60)); if (ph === 'lift') break; }
      await page.screenshot({ path: path.join(outDir, `${c.id}_${mode}_1grab.png`), clip: await clip() });
      await page.evaluate(() => window.__ufo.step(0.7));
      await page.screenshot({ path: path.join(outDir, `${c.id}_${mode}_2lift.png`), clip: await clip() });
      const st = await page.evaluate(() => ({ held: window.__ufo.state().held, arm: window.__ufo.state().claw.arm }));
      console.log(mode, c.id, c.kind, 'hold', c.hold, '->', JSON.stringify(st));
      // 戻りきるまで進める（次の回のため）
      for (let i = 0; i < 2000; i++) { const ph = await page.evaluate(() => window.__ufo.step(1 / 30)); if (ph === 'between' || ph === 'result' || ph === 'moveX') break; }
      await page.evaluate(() => { const R = window.__ufo.raw(); R.game.tryIndex = 0; window.__ufo.phase('moveX'); });
    }
    await page.context().close();
  }
  await b.close();
})();
