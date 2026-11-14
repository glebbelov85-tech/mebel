// голосовой помощник на сайте (нужен локальный сервер: python3 -m http.server 8765 в корне репозитория)
const {chromium}=require('playwright'); const OUT=__dirname+'/shots';
(async()=>{
  const browser=await chromium.launch(); const ctx=await browser.newContext({viewport:{width:1280,height:900}}); const page=await ctx.newPage(); const errs=[];
  page.on('pageerror',e=>errs.push(e.message)); await ctx.route(/jsdelivr|unpkg/,r=>r.abort());
  const B='http://localhost:8765/';
  await page.goto(B); await page.click('#msvPill');
  const say=async t=>{ await page.fill('#msvIn',t); await page.press('#msvIn','Enter'); await page.waitForTimeout(700); };
  await say('что здесь можно нажать'); console.log('home log:',(await page.textContent('#msvLog')).slice(-250));
  await say('открой калькулятор'); await page.waitForTimeout(800); console.log('url:',page.url());
  await page.waitForSelector('#edPill'); console.log('site panel on calc:',!!(await page.$('#msVoice')));
  await page.click('#edPill');
  const ed=async t=>{ await page.fill('#edIn',t); await page.press('#edIn','Enter'); await page.waitForTimeout(400); };
  await ed('открой кухню'); await ed('убери ручки'); await ed('сколько стоит проект'); await ed('покажи цену на петли'); await ed('открой прайс'); await ed('прайс загружен');
  console.log('calc log:',await page.$$eval('#edLog div',a=>a.map(x=>x.textContent)));
  await page.screenshot({path:OUT+'/site-voice-calc.png'});
  await ed('открой кухню'); await ed('перейди в раскрой'); await page.waitForTimeout(600); console.log('url:',page.url());
  await page.click('#msvPill').catch(()=>{}); await say('что здесь можно нажать'); console.log('raskroy:',(await page.textContent('#msvLog')).slice(-300));
  await say('на главную'); await page.waitForTimeout(500); console.log('url:',page.url());
  console.log('errors:',errs);
  await browser.close();
})();
