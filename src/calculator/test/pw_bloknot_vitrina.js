// Блокнот: кухня по модулям по одному с "Я понял так"; Витрина: показ работ, режим мастера, пост.
// Запуск: node test/pw_bloknot_vitrina.js  (сайт из папки репо - сначала python3 site/build.py . --project src)
const {chromium,devices}=require('playwright');
const path=require('path'), fs=require('fs');
const ROOT=path.resolve(__dirname,'../../..');
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
let fail=0; const ok=(c,m)=>{ console.log((c?'  ok  ':'  FAIL ')+m); if(!c) fail++; };
(async()=>{ const b=await chromium.launch();
 const ctx=await b.newContext({...devices['Pixel 7']});
 await ctx.route('http://site.test/**',r=>{ let u=new URL(r.request().url()).pathname; if(u.endsWith('/')) u+='index.html'; const f=path.join(ROOT,decodeURIComponent(u));
   if(!f.startsWith(ROOT)||!fs.existsSync(f)) return r.fulfill({status:404,body:''}); r.fulfill({status:200,contentType:TYPES[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)}); });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
 await p.goto('http://site.test/bloknot/'); await p.waitForTimeout(700);
 await p.click('.quick [data-a="new"]'); await p.waitForTimeout(500);
 if(!(await p.isVisible('[data-type="kuhnya"]'))){ await p.goto('http://site.test/bloknot/#izdelie'); await p.waitForTimeout(500); }
 await p.click('[data-type="kuhnya"]'); await p.waitForTimeout(400);
 ok(await p.isVisible('#kmMic'),'у кухни есть "модули по одному"');
 const km=async t=>{ await p.fill('#kmText',t); await p.click('#kmGo'); await p.waitForTimeout(250); };
 const live=async()=>(await p.textContent('#kmLive')).replace(/\s+/g,' ');
 const parts=()=>p.evaluate(()=>{ const d=JSON.parse(localStorage.getItem('bk1')); const pr=d.projects.find(x=>x.id===d.cur); return pr.items[0].parts.filter(x=>x.km).map(x=>x.n+'|'+x.sz+'|'+x.t); });
 await km('мойка, модуль 800'); ok(/Модуль 1: Под мойку/.test(await live())&&/800 мм/.test(await live()),'мойка 800: '+(await live()).slice(0,80));
 ok((await parts()).length===0,'до "Да" ничего не записано');
 await p.click('#kmLive [data-cf="ok"]'); await p.waitForTimeout(300);
 await km('450, посудомоечная машина'); ok(/Посудомойка/.test(await live())&&/450 мм/.test(await live()),'450 посудомойка'); await p.click('#kmLive [data-cf="ok"]'); await p.waitForTimeout(300);
 await km('модуль с тремя ящиками, один большой, два маленьких'); ok(/Ширину не назвали/.test(await live()),'ящики без ширины - спросил ширину: '+(await live()).slice(0,100));
 await p.click('#kmLive [data-kmw="600"]'); await p.waitForTimeout(250); await p.click('#kmLive [data-cf="ok"]'); await p.waitForTimeout(300);
 await km('модуль 400 с одним распашным фасадом'); ok(/одна распашная дверца/.test(await live()),'одна дверца: '+(await live()).slice(0,90)); await p.click('#kmLive [data-cf="ok"]'); await p.waitForTimeout(300);
 const P=await parts(); console.log('    '+P.join(' / '));
 ok(P.length===4 && /Под мойку\|800/.test(P[0]) && /Посудомойка\|450/.test(P[1]) && /Ящики\|600\|3 ящика, 1 большой, 2 маленьких/.test(P[2]) && /Шкаф с дверцами\|400\|одна распашная/.test(P[3]),'4 модуля мастера записаны как надо');
 ok(/Модуль 5/.test(await p.textContent('.km-q')),'следующий вопрос - модуль 5');
 await p.locator('.km').screenshot({path:__dirname+'/shots/bloknot_km.png'});
 // витрина
 await p.goto('http://site.test/vitrina/'); await p.waitForTimeout(600);
 ok((await p.$$('.wk')).length===3,'на витрине 3 работы-примера');
 await p.screenshot({path:__dirname+'/shots/vitrina.png'});
 await p.click('.wk'); await p.waitForTimeout(300); ok(await p.isVisible('.st'),'история работы открылась');
 await p.screenshot({path:__dirname+'/shots/vitrina_story.png'}); await p.click('.st-x');
 await p.click('#meBtn'); await p.waitForTimeout(300);
 const ans=['кухня с рейкой','квартира в новостройке','хотели без ручек','сделали профиль gola и подсветку','безопасно для детей','мдф эмаль'];
 for(const a of ans){ await p.fill('#aIn',a); await p.click('#aGo'); await p.waitForTimeout(150); ok(await p.isVisible('#aOk'),'"Я понял так" перед записью: '+a); await p.click('#aOk'); await p.waitForTimeout(200); }
 const post=await p.textContent('#postTx'); console.log('    ПОСТ:\n'+post); ok(/Задача: Хотели без ручек\./.test(post)&&/#кухня/.test(post),'пост собран');
 await p.click('[data-a="saveWork"]'); await p.waitForTimeout(400); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
 ok((await p.$$('.wk')).length===4,'новая работа на витрине (у мастера)');
 ok(!errs.length,'ошибок страницы нет '+errs.join('; '));
 await b.close(); console.log(fail?'\nПРОВАЛОВ: '+fail:'\nВсё прошло'); process.exit(fail?1:0);
})();
