const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 820, height: 1180 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8130/pochamon-hoi/index.html', { waitUntil: 'load' });
  await sleep(5000);
  // 4秒ぶん位置を測って、動いてないこと＆キラが走ってることを確認
  const samples = [];
  for (let i = 0; i < 12; i++) {
    samples.push(await p.evaluate(() => {
      const el = document.getElementById('btn-start');
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const after = getComputedStyle(el, '::after');
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
               anim: cs.animationName, shine: after.left };
    }));
    await sleep(330);
  }
  const uniqPos = new Set(samples.map(s => `${s.x},${s.y},${s.w},${s.h}`));
  const shinePos = new Set(samples.map(s => s.shine));
  console.log('ボタン本体のアニメ名:', samples[0].anim);
  console.log('位置/大きさのパターン数:', uniqPos.size, uniqPos.size === 1 ? '→ ✅ 動いてない' : '→ ❌ まだ動く ' + [...uniqPos].join(' | '));
  console.log('キラ帯の位置パターン数:', shinePos.size, shinePos.size > 1 ? '→ ✅ 走ってる' : '→ ❌ 止まってる');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
