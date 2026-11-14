const { chromium } = require('playwright'); const fs=require('fs'), path=require('path');
const LIBS='/tmp/claude-0/-home-user/77058368-1894-5923-a618-faca5e9284bc/scratchpad/w/libs';
const OUT=__dirname+'/shots'; fs.mkdirSync(OUT,{recursive:true});
async function open(browser,opts={}){
  const ctx=await browser.newContext({viewport:opts.vp||{width:1280,height:900},deviceScaleFactor:1,acceptDownloads:true});
  await ctx.route('https://cdn.jsdelivr.net/**',route=>{
    const u=route.request().url(); let f=null;
    if(u.includes('three@0.187.0/')) f=LIBS+'/three-0.187.0/package/'+u.split('three@0.187.0/')[1];
    if(u.includes('@e965/xlsx@0.20.3/')) f=LIBS+'/e965-xlsx-0.20.3/package/'+u.split('xlsx@0.20.3/')[1];
    if(f&&fs.existsSync(f)) route.fulfill({body:fs.readFileSync(f),contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}}); else route.abort();
  });
  const page=await ctx.newPage(); const errs=[];
  page.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); }); page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  if(opts.ls) await page.addInitScript(ls=>{ for(const k in ls) localStorage.setItem(k,ls[k]); },opts.ls);
  await page.goto('file://'+path.resolve(__dirname,'../dist/index.html'));
  return {page,errs,ctx};
}
module.exports={open,OUT,chromium};
if(require.main===module)(async()=>{
  const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  const {page,errs}=await open(browser);
  const shot=async n=>{ await page.waitForTimeout(250); await page.screenshot({path:`${OUT}/${n}.png`,fullPage:false}); };
  await shot('kupe-in');
  await page.click('#viewTabs [data-v=door]'); await shot('kupe-door');
  await page.click('#viewTabs [data-v="3d"]'); await page.waitForTimeout(1500); await shot('kupe-3d');
  await page.click('[data-mode=kitchen]'); await shot('kit-elev');
  await page.click('#viewTabs [data-v=plan]'); await shot('kit-plan');
  await page.click('#viewTabs [data-v="3d"]'); await page.waitForTimeout(800); await shot('kit-3d');
  await page.selectOption('#k_layout','3'); await page.waitForTimeout(300); await shot('kit3-3d');
  await page.click('#viewTabs [data-v=elev]'); await shot('kit3-elev');
  await page.click('[data-mode=univ]'); await page.waitForTimeout(500); await shot('univ');
  await page.click('[data-mode=price]'); await shot('price');
  await page.click('[data-mode=lib]'); await shot('lib');
  console.log('total',await page.textContent('#total').catch(()=>'-')); console.log('ERRORS',errs);
  await browser.close();
})();
