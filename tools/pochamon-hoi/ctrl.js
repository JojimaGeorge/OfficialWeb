const { webkit, chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  for (const [name, eng, url] of [
    ['webkit/本番(修正前)', webkit, 'https://jojima-george.com/pochamon-hoi/'],
    ['webkit/ローカル(修正後)', webkit, 'http://127.0.0.1:8130/pochamon-hoi/index.html'],
    ['chromium/ローカル(修正後)', chromium, 'http://127.0.0.1:8130/pochamon-hoi/index.html'],
  ]) {
    const b = await eng.launch();
    const p = await (await b.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true })).newPage();
    await p.goto(url, { waitUntil: 'load' }); await sleep(9000);
    const r = await p.evaluate(() => { const a = document.getElementById('title-mv-a');
      return { paused: a.paused, w: a.videoWidth, readyState: a.readyState, err: a.error && a.error.code, t: +a.currentTime.toFixed(2) }; });
    console.log(name, JSON.stringify(r));
    await b.close();
  }
})();
