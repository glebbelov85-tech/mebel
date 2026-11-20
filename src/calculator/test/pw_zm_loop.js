// Замер голосом на сайте (вместе с голосом по сайту): "Дальше" на шаге без ответа не зацикливается,
// подсказывает, что выбрать; пока ничего не выбрано - плана и счёта нет. Проходит все шаги одним "Дальше".
// Запуск: node test/pw_zm_loop.js [адрес калькулятора на сайте]  (без адреса сайт берётся прямо из папки репозитория - сначала python3 site/build.py . --project src)
const {chromium,devices}=require('playwright');
const path=require('path'), fs=require('fs');
const ROOT=path.resolve(__dirname,'../../..');          // корень репо = готовый сайт
const URL0=process.argv[2]||'http://site.test/kalkulyator/';
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
async function serve(ctx){ if(process.argv[2]) return;   // без адреса - сайт отдаётся прямо из папки, сервер не нужен
  await ctx.route('http://site.test/**',r=>{ let u=new URL(r.request().url()).pathname; if(u.endsWith('/')) u+='index.html'; const f=path.join(ROOT,decodeURIComponent(u));
    if(!f.startsWith(ROOT)||!fs.existsSync(f)) return r.fulfill({status:404,body:''}); r.fulfill({status:200,contentType:TYPES[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)}); }); }
let fail=0; const ok=(c,m)=>{ console.log((c?'  ok  ':'  FAIL ')+m); if(!c) fail++; };
(async()=>{ const b=await chromium.launch();
 const ctx=await b.newContext({...devices['Pixel 7']}); await serve(ctx); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(URL0+'?zamer=1'); await p.waitForTimeout(900);
 ok(await p.isVisible('#zm'),'экран замера открыт');
 const logN=()=>p.$$eval('#zmLog > div',d=>d.length);
 const n0=await logN();
 await p.click('#zmNext'); await p.waitForTimeout(1500);
 const n1=await logN(); console.log('   лента:',n0,'->',n1,'|', await p.$$eval('#zmLog > div',d=>d.slice(-4).map(x=>x.textContent).join(' | ')));
 ok(n1-n0<=2,'одно нажатие "Дальше" - не больше одной подсказки в ленте');
 await p.waitForTimeout(1500); const n2=await logN();
 ok(n2===n1,'лента не растёт сама ('+n1+' -> '+n2+')');
 const txt=await p.textContent('#zmQ'); ok(/Сначала выберите форму кухни/.test(txt),'подсказка в карточке вопроса: '+txt.slice(0,80));
 ok(await p.evaluate(()=>S.zm.step)==='layout','шаг не сдвинулся без ответа');
 for(let i=0;i<5;i++){ await p.click('#zmNext'); await p.waitForTimeout(450); }
 ok(await logN()===n2,'пять нажатий "Дальше" подряд - лента не растёт');
 ok(!(await p.isVisible('#zmSvg')) && await p.isVisible('#zmEmpty'),'до выбора формы - "Тут появится ваша кухня", плана нет');
 ok((await p.$$('#zmCnt .zm-c')).length===0,'до выбора формы - счёта листов и фурнитуры нет');
 await p.screenshot({path:__dirname+'/shots/zm_loop.png'});
 // все шаги одним "Дальше": ни один не должен зависнуть или спамить
 await p.click('.zm-chip[data-say="прямая"]'); await p.waitForTimeout(500);
 ok(await p.isVisible('#zmSvg') && !(await p.isVisible('#zmEmpty')),'после выбора формы план появился');
 const seen=[await p.evaluate(()=>S.zm.step)];
 for(let i=0;i<14 && seen[seen.length-1]!=='total';i++){
   const a=await logN(); await p.click('#zmNext'); await p.waitForTimeout(700); const st=await p.evaluate(()=>S.zm.step+(S.zm.sub?'/'+S.zm.sub.k:'')); const d=await logN()-a;
   await p.waitForTimeout(500); const grow=await logN()-a-d;
   ok(st!==seen[seen.length-1] && d<=4 && grow===0, `"Дальше": ${seen[seen.length-1]} -> ${st} (строк в ленте +${d}, сами +${grow})`); seen.push(st);
 }
 ok(seen[seen.length-1]==='total','дошли до итога');
 console.log('   счёт на итоге:',(await p.textContent('#zmCnt')).slice(0,120));
 // старый замер, остановленный на первом вопросе, и стандартная кухня калькулятора - не показываем её как "вашу"
 await p.evaluate(()=>{ S=defaultState(); S.mode="kitchen"; S.zm={step:"layout"}; LS.set("mk2_current",S); });
 await p.goto(URL0+'?zamer=1'); await p.waitForTimeout(900);
 ok(await p.isVisible('#zmEmpty') && (await p.$$('#zmCnt .zm-c')).length===0,'остановленный на 1 шаге замер: плана и счёта чужой кухни нет');
 ok(await p.evaluate(()=>S.kit.walls.every(w=>!w.lower.length&&!w.upper.length)),'кухня пустая, пока ничего не названо');
 await p.screenshot({path:__dirname+'/shots/zm_loop_fresh.png'});
 ok(errs.length===0,'ошибок страницы нет');
 console.log('   ошибки:',errs.join(' / '));
 await b.close(); process.exit(fail?1:0);
})();
