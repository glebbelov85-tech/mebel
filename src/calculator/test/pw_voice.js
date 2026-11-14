// Голосовой ввод: поддельный SpeechRecognition, проверка "Очистить" посреди диктовки, команд и сборки проекта
const {open,OUT,chromium}=require('./pw.js');
(async()=>{
  const browser=await chromium.launch();
  const {page,errs,ctx}=await open(browser,{vp:{width:1100,height:1000}});
  await page.addInitScript(()=>{});
  await page.evaluate(()=>{
    class FakeSR{ constructor(){ window.__sr=this; this.res=[]; } start(){ window.__srStarts=(window.__srStarts||0)+1; }
      stop(){ setTimeout(()=>this.onend&&this.onend(),10); } abort(){ setTimeout(()=>this.onend&&this.onend(),10); }
      // как Chrome в непрерывном режиме: results накапливаются за всю сессию
      say(text,final){ const last=this.res[this.res.length-1]; if(last&&!last.isFinal) this.res.pop();
        const r=[{transcript:text}]; r.isFinal=!!final; this.res.push(r);
        this.onresult&&this.onresult({resultIndex:this.res.length-1,results:this.res}); } }
    window.webkitSpeechRecognition=FakeSR; delete window.SpeechRecognition;
  });
  const val=()=>page.inputValue('#voTxt');
  await page.evaluate(()=>openVoice()); await page.waitForSelector('#voMic:not(.hide)');
  await page.click('#voMic');
  await page.evaluate(()=>{ __sr.say("угловая кухня",false); }); console.log('interim live:',await page.textContent('#voLive'),'| field:',JSON.stringify(await val()));
  await page.evaluate(()=>{ __sr.say("угловая кухня основная стена 3 метра",true); __sr.say("вторая 2 метра",true); });
  console.log('after 2 finals:',JSON.stringify(await val()));
  await page.click('#voClear'); await page.waitForTimeout(50);
  console.log('after clear:',JSON.stringify(await val()),'starts',await page.evaluate(()=>__srStarts));
  await page.evaluate(()=>{ __sr.say("шкаф купе",false); __sr.say("шкаф купе ширина 2 метра 40",true); });
  console.log('after new speech:',JSON.stringify(await val()), (await val()).includes('кухня')?'BUG: old text back':'OK: old text gone');
  await page.evaluate(()=>{ __sr.say("в нишу",true); __sr.say("отмена",true); });
  console.log('after undo cmd:',JSON.stringify(await val()));
  await page.evaluate(()=>{ __sr.say("очистить",true); }); console.log('after clear cmd:',JSON.stringify(await val()));
  // автоперезапуск после паузы
  await page.evaluate(()=>{ __sr.onend(); }); await page.waitForTimeout(300); console.log('restarts after end:',await page.evaluate(()=>__srStarts),'mic:',await page.textContent('#voMic'));
  await page.evaluate(()=>{ __sr.say("угловая кухня основная стена 3 метра 60 вторая 1 метр 80 потолок 2 метра 70",true); __sr.say("фасады эмаль белые встроенный холодильник посудомойка 45",true); __sr.say("клиент Айгуль скидка 5 процентов",true); });
  await page.waitForTimeout(100);
  await page.screenshot({path:OUT+'/voice-sum.png',fullPage:true});
  console.log('ask items:',await page.$$eval('[data-ask]',a=>a.map(x=>x.textContent)));
  await page.click('[data-ask="0"]'); console.log('after ask click:',JSON.stringify((await val()).slice(-30)));
  await page.evaluate(()=>{ __sr.say("собрать проект",true); }); await page.waitForTimeout(300);
  console.log('modal closed:',!(await page.$('#voTxt')),'mode kitchen:',await page.evaluate(()=>S.mode),'client:',await page.evaluate(()=>S.client),'disc',await page.evaluate(()=>S.disc),'decor',await page.evaluate(()=>S.decor));
  await page.screenshot({path:OUT+'/voice-built.png'});
  // черновик: после сборки пусто, без сборки - сохраняется
  await page.evaluate(()=>openVoice()); console.log('draft after build:',JSON.stringify(await val()));
  await page.fill('#voTxt','комод ширина 1 метр'); await page.click('#modalX'); await page.evaluate(()=>openVoice()); console.log('draft kept:',JSON.stringify(await val()));
  // телефон
  const m=await open(browser,{vp:{width:390,height:844}}); await m.page.evaluate(()=>openVoice()); await m.page.fill('#voTxt',"шкаф купе 2400 на 2600 на 600 три двери все зеркальные"); await m.page.waitForTimeout(100);
  await m.page.screenshot({path:OUT+'/voice-phone.png',fullPage:true});
  console.log('errors:',errs.concat(m.errs).filter(e=>!/jsdelivr|ERR_FAILED|net::/.test(e)));
  await browser.close();
})();
