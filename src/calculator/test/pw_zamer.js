// Замер голосом: кухня по шагам. Компьютер (печатаем ответы) и телефон (поддельное распознавание речи).
// Запуск: node test/pw_zamer.js [адрес]   (по умолчанию http://localhost:8770/ - сервер в src/calculator/dist)
const {chromium,devices}=require('playwright');
const URL0=process.argv[2]||'http://localhost:8770/';
const MOCK=`(()=>{ window.__phr=[]; window.__log=[];
 class FakeSR{ constructor(){ this.continuous=false; } start(){ window.__log.push('start'); this._on=true; setTimeout(()=>this._next(),150); }
  _next(){ if(!this._on) return; const p=window.__phr.shift(); if(!p){ setTimeout(()=>this._next(),150); return; }
    const mk=(t,fin)=>{ const r=[{transcript:t}]; r.isFinal=fin; return r; };
    this.onresult&&this.onresult({resultIndex:0,results:[mk(p.slice(0,5),false)]});
    setTimeout(()=>{ this.onresult&&this.onresult({resultIndex:0,results:[mk(p,true)]}); if(!this.continuous){ this._on=false; setTimeout(()=>{ window.__log.push('end'); this.onend&&this.onend(); },40); } else setTimeout(()=>this._next(),150); },120); }
  stop(){ window.__log.push('stop'); if(this._on){ this._on=false; setTimeout(()=>this.onend&&this.onend(),30);} } abort(){ this.stop(); } }
 window.SpeechRecognition=FakeSR; window.webkitSpeechRecognition=FakeSR; })();`;
const PH=['прямая','3 метра 60','потолок 2700','мойка 800','посудомойка','полка 300','модуль 3 ящика один большой два маленьких 600','модуль 600 распашной','пенал под технику','дальше','заглушка',
 'шкаф 800 сушка 800','над вытяжкой','шкаф 600','дальше','остаток','эмаль 19 мм по 38 тысяч','корпус 18','дальше','дальше','направляющие шариковые','дальше','по городу, пятый этаж, лифта нет'];
let fail=0; const ok=(c,m)=>{ console.log((c?'  ok  ':'  FAIL ')+m); if(!c) fail++; };
(async()=>{ const b=await chromium.launch();
 for(const dev of ['desktop','phone']){
  const ctx=await b.newContext(dev==='phone'?{...devices['Pixel 7']}:{viewport:{width:1280,height:800}}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(MOCK); await p.goto(URL0); await p.waitForTimeout(700);
  console.log('=== '+dev);
  ok(await p.isVisible('#zmOpenBtn'),'кнопка "Замер голосом" в шапке');
  await p.click('#zmOpenBtn'); await p.waitForTimeout(400);
  ok(await p.isVisible('#zm'),'экран замера открыт');
  ok((await p.textContent('#zmQ')).length>5,'вопрос: '+(await p.textContent('#zmQ')).slice(0,70));
  const say=async t=>{ if(dev==='phone'){ await p.evaluate(x=>window.__phr.push(x),t); await p.waitForTimeout(650); } else { await p.fill('#zmIn',t); await p.press('#zmIn','Enter'); await p.waitForTimeout(120); } };
  if(dev==='phone') ok((await p.getAttribute('#zmMic','class')).includes('rec'),'микрофон включился сам');
  let i=0;
  for(const t of PH){ await say(t); i++; if(process.env.V) console.log('   >',t,'=>',await p.evaluate(()=>S.zm.step+'/'+(S.zm.sub?S.zm.sub.k:'')),'|',(await p.textContent('#zmQ')).slice(0,60)); if(i===8) await p.screenshot({path:__dirname+'/shots/zm_'+dev+'_mid.png'}); }
  const st=await p.evaluate(()=>({step:S.zm.step, low:S.kit.walls[0].lower.map(m=>m.t+m.w).join(','), up:S.kit.walls[0].upper.map(m=>m.t+m.w).join(','), fac:S.kit.facade, body:S.kit.body, dlv:S.dlv, guides:S.kit.guides}));
  console.log('  ',JSON.stringify(st));
  ok(st.step==='total','дошли до итога');
  ok(/l_sink800,l_dish600,l_open300,l_dr3b600,l_shelf600/.test(st.low),'нижний ряд по порядку');
  ok(st.dlv&&st.dlv.floor===5&&!st.dlv.lift,'доставка: 5 этаж без лифта');
  ok(await p.isVisible('#zmTotal'),'карточка цены видна');
  const cnt=await p.$$eval('#zmCnt .zm-c',d=>d.map(x=>x.textContent)); console.log('   счёт:',cnt.join(' | '));
  ok(cnt.some(x=>/Петли/.test(x))&&cnt.some(x=>/Направляющ/.test(x))&&cnt.some(x=>/ЛДСП/.test(x)),'счётчики: листы, петли, направляющие');
  const t1=await p.textContent('#zmTotal .zm-tot-h b'); console.log('   цена:',t1);
  await p.screenshot({path:__dirname+'/shots/zm_'+dev+'_total.png'});
  await say('дорого'); await p.waitForTimeout(200);
  const alts=await p.$$eval('#zmLog .zm-alt',d=>d.map(x=>x.textContent)); console.log('   варианты:',alts.join(' | ').slice(0,300));
  ok(alts.length>1,'"дорого" - показаны варианты');
  await say('поменяй направляющие на роликовые'); await p.waitForTimeout(200);
  const t2=await p.textContent('#zmTotal .zm-tot-h b'); ok(t2!==t1,'цена пересчитана: '+t1+' -> '+t2);
  ok((await p.$$eval('#zmLog .zm-price',d=>d.length))>0,'в ленте "Было - стало"');
  await say('отмена'); await p.waitForTimeout(200);
  ok((await p.textContent('#zmTotal .zm-tot-h b'))===t1,'"отмена" вернула цену');
  await p.screenshot({path:__dirname+'/shots/zm_'+dev+'_alt.png'});
  // раскрой
  if(dev==='phone'){ await p.click('#zmMic'); await p.waitForTimeout(200); }
  await p.click('#zmCnt button.zm-c'); await p.waitForTimeout(600);
  const maps=await p.$$eval('.zm-maps svg',d=>d.length); ok(maps>0,'раскрой: нарисовано листов '+maps);
  await p.screenshot({path:__dirname+'/shots/zm_'+dev+'_map.png'});
  await p.evaluate(()=>closeModal());
  // перезагрузка: замер продолжается
  await p.goto(URL0+'?zamer=1'); await p.waitForTimeout(800);
  ok(await p.isVisible('#zm') && await p.evaluate(()=>S.zm.step==='total'),'после перезагрузки замер на том же шаге');
  await p.click('#zmX'); await p.waitForTimeout(200);
  ok(!(await p.isVisible('#zm')) && await p.evaluate(()=>S.mode==='kitchen'&&S.kit.walls[0].lower.length>4),'закрыли - кухня осталась в калькуляторе');
  await p.screenshot({path:__dirname+'/shots/zm_'+dev+'_calc.png'});
  ok(errs.length===0,'ошибок страницы нет '+errs.join(' / '));
  await ctx.close(); }
 await b.close(); console.log(fail?('ПРОВАЛОВ: '+fail):'ВСЁ ПРОШЛО'); process.exit(fail?1:0); })();
