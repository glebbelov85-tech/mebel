// убрать дверь и вернуть: "Вернуть", "Отменить", "Добавить деталь > Дверь", меню по правому клику и долгому нажатию
const {open,OUT,chromium}=require('./pw.js');
(async()=>{
  const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  const {page,errs}=await open(browser,{vp:{width:1280,height:900}});
  const st=()=>page.evaluate(()=>({n:S.u.panels.length, doors:S.u.panels.filter(p=>/^Дверь/.test(p.name)).map(p=>p.name+' '+p.x+' '+p.a+'x'+p.b).join('; '), hinge:(S.u.hw.find(h=>h.id==='hinge')||{}).q, handle:(S.u.hw.find(h=>h.id==='handle')||{}).q}));
  await page.click('[data-mode=univ]'); await page.waitForTimeout(300);
  console.log('start',await st());
  // убрать дверь 2 крестиком -> "Вернуть"
  const i2=await page.evaluate(()=>S.u.panels.findIndex(p=>p.name==='Дверь 2'));
  await page.click(`#u_panels [data-del="${i2}"]`); console.log('after del',await st(), await page.textContent('#toastA'));
  await page.click('#toastA button'); console.log('after Вернуть',await st());
  // снова убрать, потом "Добавить деталь > Дверь"
  await page.click(`#u_panels [data-del="${i2}"]`); await page.click('#u_add'); await page.click('[data-add=door]'); console.log('add door',await st(), await page.textContent('#toastA'));
  await page.click('#u_undo'); console.log('undo',await st());
  await page.click('#u_undo'); console.log('undo2',await st());
  // полка, ящик
  await page.click('#u_add'); await page.click('[data-add=drawer]'); console.log('drawer',await st(), await page.textContent('#toastA'));
  await page.click('#u_add'); await page.click('[data-add=shelf]'); console.log('shelf',await page.textContent('#toastA'));
  await page.screenshot({path:OUT+'/menu-added.png'});
  // правый клик в 3D по двери 1
  await page.waitForTimeout(1200);
  const box=await page.$eval('#u3d canvas',c=>{ const r=c.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height}; });
  // найдём точку на двери 1 через проекцию
  const pt=await page.evaluate(()=>{ const i=S.u.panels.findIndex(p=>p.name==='Дверь 1'), m=R3.grp.children.find(o=>o.userData.i===i), v=m.position.clone().project(R3.cam), r=R3.r.domElement.getBoundingClientRect(); return {x:r.left+(v.x+1)/2*r.width, y:r.top+(1-v.y)/2*r.height}; });
  await page.mouse.click(pt.x,pt.y,{button:'right'}); await page.waitForTimeout(200);
  console.log('menu 3d:',await page.$$eval('#pmenu button',b=>b.map(x=>x.textContent)).catch(()=>'нет'));
  await page.screenshot({path:OUT+'/menu-3d.png'});
  await page.click('#pmenu button:has-text("Убрать эту деталь")'); console.log('3d removed',await st());
  await page.mouse.click(pt.x,pt.y,{button:'right'}); await page.waitForTimeout(150);
  console.log('menu on empty spot:',await page.$eval('#pmenu .pmh',e=>e.textContent));
  await page.click('#pmenu button:has-text("Поставить дверь")'); console.log('door back from 3d',await st());
  // вид спереди, правый клик
  await page.click('#viewTabs [data-v=front]'); await page.waitForTimeout(200);
  const r=await page.$eval('#sketch [data-i]',e=>{ const b=e.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2}; });
  await page.mouse.click(r.x,r.y,{button:'right'}); console.log('menu 2d:',await page.$eval('#pmenu .pmh',e=>e.textContent));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z'); console.log('ctrl+z',await st());
  // кухня: правый клик на развёртке
  await page.click('[data-mode=kitchen]'); await page.waitForTimeout(200);
  const kr=await page.$eval('#sketch rect[data-i]',e=>{ const b=e.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2}; });
  await page.mouse.click(kr.x,kr.y,{button:'right'}); console.log('kitchen menu:',await page.$$eval('#pmenu button',b=>b.map(x=>x.textContent).join(' | ')));
  await page.screenshot({path:OUT+'/menu-kitchen.png'});
  const before=await page.evaluate(()=>JSON.stringify(S.kit.walls[0].lower.map(m=>m.t)));
  await page.click('#pmenu button:has-text("Убрать модуль")'); const mid=await page.evaluate(()=>JSON.stringify(S.kit.walls[0].lower.map(m=>m.t)));
  await page.click('#toastA button'); const after=await page.evaluate(()=>JSON.stringify(S.kit.walls[0].lower.map(m=>m.t)));
  console.log('kitchen rm/return',before===after, before, mid);
  // купе
  await page.click('[data-mode=kupe]'); await page.waitForTimeout(200);
  const ur=await page.$eval('#sketch rect[data-i]',e=>{ const b=e.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2}; });
  await page.mouse.click(ur.x,ur.y,{button:'right'}); console.log('kupe menu:',await page.$$eval('#pmenu button',b=>b.map(x=>x.textContent).join(' | ')));
  await page.keyboard.press('Escape');
  // телефон: долгое нажатие
  const m=await open(browser,{vp:{width:390,height:844}}); const P=m.page;
  await P.click('[data-mode=univ]'); await P.waitForTimeout(300);
  await P.click('#viewTabs [data-v=front]'); await P.waitForTimeout(200);
  const cdp=await P.context().newCDPSession(P);
  const tr=await P.$eval('#sketch rect[data-i]',e=>{ e.scrollIntoView({block:'center'}); return 1; }); await P.waitForTimeout(300);
  const t2=await P.$eval('#sketch rect[data-i]',e=>{ const b=e.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2}; });
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:t2.x,y:t2.y}]}); await P.waitForTimeout(800);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await P.waitForTimeout(200);
  console.log('phone long press menu:',await P.$eval('#pmenu',e=>e.className+' / '+e.querySelector('.pmh').textContent).catch(()=>'нет'));
  await P.screenshot({path:OUT+'/menu-phone.png'});
  console.log('errors:',errs.concat(m.errs).filter(e=>!/ERR_FAILED|net::|favicon/.test(e)));
  await browser.close();
})();
// разбор по деталям
(async()=>{
  const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  const {page,errs}=await open(browser,{vp:{width:1280,height:900}});
  await page.click('[data-mode=univ]'); await page.waitForTimeout(1500);
  await page.click('#exp3d'); await page.waitForTimeout(1200);
  const pos=()=>page.evaluate(()=>{ const i=S.u.panels.findIndex(p=>p.name==='Дверь 1'), m=R3.grp.children.find(o=>o.userData.i===i); return [Math.round(m.position.x),Math.round(m.position.y),Math.round(m.position.z)]; });
  console.log('exploded door1',await pos(), await page.textContent('#exp3d'));
  await page.screenshot({path:OUT+'/explode.png'});
  const pt=await page.evaluate(()=>{ const i=S.u.panels.findIndex(p=>p.name==='Дверь 1'), m=R3.grp.children.find(o=>o.userData.i===i), v=m.position.clone().project(R3.cam), r=R3.r.domElement.getBoundingClientRect(); return {x:r.left+(v.x+1)/2*r.width, y:r.top+(1-v.y)/2*r.height}; });
  await page.mouse.move(pt.x,pt.y); await page.mouse.down(); await page.mouse.move(pt.x-120,pt.y,{steps:6}); await page.mouse.up(); await page.waitForTimeout(100);
  console.log('dragged door1',await pos());
  await page.mouse.click(pt.x-120,pt.y,{button:'right'}); await page.waitForTimeout(150);
  console.log('menu',await page.$$eval('#pmenu button',b=>b.slice(0,3).map(x=>x.textContent).join(' | ')));
  await page.click('#pmenu button:has-text("Приблизить")'); await page.waitForTimeout(600);
  await page.screenshot({path:OUT+'/explode-zoom.png'});
  await page.click('#exp3d'); await page.waitForTimeout(1200); console.log('assembled door1',await pos());
  console.log('explode errors:',errs.filter(e=>!/ERR_FAILED|net::|favicon/.test(e)));
  await browser.close();
})();
