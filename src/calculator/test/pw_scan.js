// Замер из PDF и из картинки: приложение читает размеры и спрашивает "верно?". Сервер в корне репо на :8765.
// Внешние библиотеки (Tesseract с CDN) подтягиваются через curl - у браузера в песочнице своего выхода в сеть нет.
const {chromium,devices}=require('playwright'); const {execFileSync}=require('child_process'); const fs=require('fs'), os=require('os'), path=require('path');
const URL0=process.argv[2]||'http://localhost:8765/kalkulyator/?zamer=1';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'scan-')); let fail=0; const ok=(c,m)=>{ console.log((c?'  ok  ':'  FAIL ')+m); if(!c) fail++; };
const cache={};
(async()=>{ const b=await chromium.launch();
 // делаем "замеры": PDF с текстом и картинку с печатными цифрами
 const mk=await b.newPage({viewport:{width:900,height:700}});
 await mk.setContent(`<body style="font:28px Arial;padding:40px"><h2>Замер кухни</h2><p>Основная стена 3400 мм</p><p>Правая стена 1900 мм</p><p>Высота потолка 2650 мм</p><p>Окно 1400, от угла 650</p></body>`);
 await mk.pdf({path:tmp+'/zamer.pdf'});
 await mk.setContent(`<body style="font:bold 44px Arial;padding:90px 30px 30px;background:#fff"><div style="border:4px solid #000;width:700px;height:380px;position:relative"><span style="position:absolute;top:-58px;left:280px">3250</span><span style="position:absolute;left:715px;top:160px">2100</span><span style="position:absolute;left:300px;top:150px">2700</span></div></body>`);
 await mk.screenshot({path:tmp+'/zamer.png'}); await mk.close();
 for(const kind of ['pdf','png']){
  const ctx=await b.newContext({...devices['Pixel 7']}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await ctx.route(u=>!/^http:\/\/localhost/.test(u.href)&&/^https?:/.test(u.href),async r=>{ const u=r.request().url();
    try{ if(!cache[u]) cache[u]=execFileSync('curl',['-sSL','--max-time','60',u],{maxBuffer:1<<28}); await r.fulfill({body:cache[u],headers:{'access-control-allow-origin':'*','content-type':/\.js$/.test(u)?'text/javascript':/\.wasm$/.test(u)?'application/wasm':'application/octet-stream'}}); }catch(e){ await r.abort(); } });
  await p.goto(URL0); await p.waitForTimeout(900);
  console.log('=== '+kind);
  await p.setInputFiles('#zmFile',tmp+'/zamer.'+kind);
  await p.waitForFunction(()=>!SCAN.busy && !document.querySelector('#zmDoc').classList.contains('hide'),null,{timeout:120000}); await p.waitForTimeout(300);
  const q=await p.textContent('#zmQ'); console.log('   вопрос:',q.slice(0,160)); console.log('   лента:',(await p.$$eval('#zmLog>div',d=>d.map(x=>x.textContent))).slice(-1)[0]);
  ok(/Я понял замер так/.test(q),'спрашивает подтверждение');
  ok(kind==='pdf'?/3 400/.test(q)&&/1 900/.test(q)&&/2 650/.test(q):/3 250/.test(q),'размеры прочитаны');
  ok(await p.evaluate(()=>S.kit.walls[0].len)!==(kind==='pdf'?3400:3250),'до подтверждения в кухню ничего не подставлено');
  ok(await p.isVisible('#zmDoc canvas'),'замер показан на экране');
  await p.screenshot({path:__dirname+'/shots/zm_scan_'+kind+'.png'});
  await p.fill('#zmIn','основная стена 3300'); await p.press('#zmIn','Enter'); await p.waitForTimeout(150);
  ok(/3 300/.test(await p.textContent('#zmQ')),'поправка голосом принята');
  await p.fill('#zmIn','да'); await p.press('#zmIn','Enter'); await p.waitForTimeout(150);
  ok(await p.evaluate(()=>S.kit.walls[0].len)===3300,'после "да" длина стены 3300');
  console.log('   дальше:',(await p.textContent('#zmQ')).slice(0,80));
  ok(errs.length===0,'ошибок страницы нет '+errs.join(' / ')); await ctx.close(); }
 await b.close(); console.log(fail?('ПРОВАЛОВ: '+fail):'ВСЁ ПРОШЛО'); process.exit(fail?1:0); })();
