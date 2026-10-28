// ルールの検算：ゲーム本体の判定関数を使って n ゲーム回し、枚数の分布と運枠の位置を出す。
//   node tools/pochamon-ufo/sim.js [--n=20000] [--p=0.3] [--slot=random|first|last]
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const n = parseInt(args.n || '20000', 10), p = parseFloat(args.p || '0.3'), slot = args.slot || 'random';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:4876/pochamon-ufo/?nosw=1&slot=' + slot, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
  const r = await page.evaluate(([n, p]) => window.__ufo.simulate(n, p), [n, p]);
  const pct = (k) => (100 * r.dist[k] / r.n).toFixed(1) + '%';
  console.log(`slot=${slot} p=${p} n=${r.n}`);
  console.log(`  0枚 ${pct(0)}  1枚 ${pct(1)}  2枚 ${pct(2)}  3枚 ${pct(3)}  平均 ${r.mean.toFixed(3)} 枚/ゲーム`);
  console.log(`  運枠の位置: 1回目 ${r.luckPos[0]} / 2回目 ${r.luckPos[1]} / 3回目 ${r.luckPos[2]}`);
  const ok = r.dist[0] === 0 && r.dist[1] === 0 && Math.abs(r.dist[3] / r.n - p) < 0.02;
  console.log(ok ? 'OK: 必ず2枚以上・3枚の割合 ≒ p' : 'NG: ルールと合わない');
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
