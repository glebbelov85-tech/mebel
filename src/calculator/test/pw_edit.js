// панель "Правка голосом" в браузере
const {open,OUT,chromium}=require('./pw.js');
(async()=>{
  const browser=await chromium.launch();
  const {page,errs}=await open(browser,{vp:{width:1280,height:900}});
  await page.click('#voiceBtn'); await page.fill('#voTxt','угловая кухня основная стена 3 метра 60 вторая 1 метр 80 встроенный холодильник посудомойка 60'); await page.click('#voGo'); await page.waitForTimeout(200);
  await page.click('#viewTabs [data-v=elev]');
  await page.click('#edPill');
  for(const c of ['убери посудомойку','добавь посудомойку 45 после мойки','добавь сушку над мойкой','фасады эмаль и без ручек','что-то непонятное']){ await page.fill('#edIn',c); await page.press('#edIn','Enter'); await page.waitForTimeout(150); }
  console.log('log:',await page.textContent('#edLog'));
  console.log('walls form:',await page.$$eval('#walls .wall',w=>w.map(x=>[...x.querySelectorAll('select')].map(s=>s.value).join(','))));
  await page.screenshot({path:OUT+'/edit-desk.png'});
  await page.click('#edUndo'); await page.waitForTimeout(100); console.log('after undo fac:',await page.evaluate(()=>S.kit.fac+' '+S.kit.handles));
  await page.click('[data-mode=price]'); console.log('bar hidden on price:',await page.evaluate(()=>$('edBar').classList.contains('hide')));
  await page.click('[data-mode=kupe]'); await page.fill('#edIn','4 двери, все двери зеркало'); await page.press('#edIn','Enter'); await page.waitForTimeout(150); console.log('kupe M:',await page.evaluate(()=>S.kupe.M+' '+S.kupe.doors[3].segs[0]));
  const m=await open(browser,{vp:{width:390,height:844}}); await m.page.click('[data-mode=kitchen]'); await m.page.click('#edPill'); await m.page.fill('#edIn','добавь бутылочницу'); await m.page.press('#edIn','Enter'); await m.page.waitForTimeout(150);
  await m.page.screenshot({path:OUT+'/edit-phone.png'});
  console.log('errors:',errs.concat(m.errs).filter(e=>!/jsdelivr|ERR_FAILED|net::/.test(e)));
  await browser.close();
})();
