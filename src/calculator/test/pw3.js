const {open,OUT,chromium}=require('./pw.js'); const path=require('path');
(async()=>{
  const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  let {page,errs}=await open(browser);
  await page.goto('file://'+path.resolve(__dirname,'../dist/demo/index.html')); await page.waitForTimeout(300);
  await page.screenshot({path:OUT+'/demo.png'});
  await page.click('#voiceBtn'); await page.fill('#voTxt','Угловая кухня, основная длина 5 метров, меньшая длина 1,5 метра, высота верхних шкафов 900, встроенный холодильник'); await page.waitForTimeout(200);
  await page.screenshot({path:OUT+'/voice.png'});
  console.log('mic visible:',await page.isVisible('#voMic'));
  await page.click('#voGo'); await page.waitForTimeout(1800); await page.screenshot({path:OUT+'/voice-res.png'});
  console.log(await page.evaluate(()=>[S.mode,S.kit.layout,S.kit.walls[0].len,CUR.warns]));
  await page.click('#voiceBtn'); await page.click('[data-ex="3"]'); await page.click('#voGo'); await page.waitForTimeout(300); console.log(await page.evaluate(()=>[S.mode,CUR.title,CUR.warns.length]));
  await page.click('#voiceBtn'); await page.click('[data-ex="4"]'); await page.click('#voGo'); await page.waitForTimeout(300); console.log(await page.evaluate(()=>[S.mode,CUR.title]));
  console.log('ERR',errs);
  ({page,errs}=await open(browser,{vp:{width:390,height:800}})); await page.click('#voiceBtn'); await page.click('[data-ex="0"]'); await page.screenshot({path:OUT+'/m-voice.png'}); console.log('m overflow',await page.evaluate(()=>document.documentElement.scrollWidth),errs);
  await browser.close();
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
