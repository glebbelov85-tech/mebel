const {open,OUT,chromium}=require('./pw.js');
(async()=>{
  const browser=await chromium.launch();
  const {page,errs}=await open(browser,{vp:{width:1280,height:900}});
  await page.click('[data-mode=kitchen]');
  await page.setInputFiles('#phFile',OUT+'/voice-sum.png'); await page.waitForSelector('#phCv'); await page.waitForTimeout(400);
  const box=await page.$eval('#phCv',c=>{ const r=c.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height}; });
  console.log('canvas',box);
  const at=(fx,fy)=>page.mouse.click(box.x+box.w*fx, box.y+box.h*fy);
  await at(0.1,0.5); await at(0.4,0.5);           // эталон: 30% ширины
  await page.fill('[data-ref="0"]','1000'); await page.waitForTimeout(50);
  await at(0.1,0.7); await at(0.85,0.7);          // 75% ширины -> 2500
  await page.waitForTimeout(100);
  console.log('lines:',await page.$$eval('#phLines tr',a=>a.map(x=>x.textContent.replace(/\s+/g,' ').trim())));
  await page.screenshot({path:OUT+'/photo-edit.png'});
  await page.selectOption('[data-to="1"]','основная стена'); await page.waitForTimeout(200);
  console.log('wall0:',await page.evaluate(()=>S.kit.walls[0].len));
  await page.click('#phDone'); console.log('thumbs:',await page.$$eval('.ph-th span',a=>a.map(x=>x.textContent)));
  await page.reload(); await page.waitForTimeout(300); console.log('after reload thumbs:',await page.$$eval('.ph-th img',a=>a.map(x=>!!x.src)));
  console.log('errors:',errs.filter(e=>!/jsdelivr|ERR_FAILED|net::/.test(e)));
  await browser.close();
})();
