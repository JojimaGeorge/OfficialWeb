// 狙いの丸を山の全面に置き、下りた時に爪が体に届くか（grip）と、止まる角度・爪先とつかむ点の差（gap）を数える
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
  await p.goto('http://localhost:4876/pochamon-ufo/?nosw=1'); await p.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
  const r = await p.evaluate(() => {
    const U = window.__ufo, R = U.raw(), CFG = U.CFG, out = [];
    const b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 };
    for (const t of R.toys) { b.x0 = Math.min(b.x0, t.hold.x); b.x1 = Math.max(b.x1, t.hold.x); b.y0 = Math.min(b.y0, t.hold.y); b.y1 = Math.max(b.y1, t.hold.y); }
    for (let x = b.x0 - 0.05; x <= b.x1 + 0.05; x += 0.01) for (let y = b.y0 - 0.05; y <= b.y1 + 0.05; y += 0.01) {
      const q = U.probeAim(x, y); if (!q.target) continue;
      const t = R.toys.find((o) => o.id === q.target);
      out.push({ id: t.id, gap: (q.zc + CFG.padDz) - (t.hold.z + t.dz), grip: q.grip });
    }
    const ok = out.filter((o) => o.grip), ng = out.filter((o) => !o.grip);
    const hist = {}; for (const o of ok) { const k = Math.round(o.grip.hold / 4) * 4; hist[k] = (hist[k] || 0) + 1; }
    const sh = ok.map((o) => Math.abs(o.grip.shift)).sort((a, b) => a - b);
    return { total: out.length, grip: ok.length, nogrip: ng.length,
      nogripGapOver2: ng.filter((o) => o.gap > 0.02).length, gripGapOver4: ok.filter((o) => o.gap > 0.04).length,
      holdHist: hist, shiftMed: sh[sh.length >> 1], shiftMax: sh[sh.length - 1],
      perToy: Object.fromEntries([...new Set(out.map((o) => o.id))].map((id) => [id, out.filter((o) => o.id === id && o.grip).length + '/' + out.filter((o) => o.id === id).length])) };
  });
  console.log(JSON.stringify(r)); await b.close();
})();
