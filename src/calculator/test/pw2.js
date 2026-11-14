const {open,OUT,chromium}=require('./pw.js'); const fs=require('fs');
const MO=require('/mnt/project-files/order-format/mebel-order.js');
const XLSX=require('/tmp/claude-0/-home-user/77058368-1894-5923-a618-faca5e9284bc/scratchpad/w/libs/e965-xlsx-0.20.3/package/xlsx.js');
(async()=>{
  const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  // --- 1. order export for all modes validates
  let {page,errs}=await open(browser);
  for(const m of ['kupe','kitchen','univ']){
    await page.click(`[data-mode=${m}]`); await page.waitForTimeout(200);
    const o=await page.evaluate(()=>toOrder());
    const rep=MO.validate(o); const q=MO.quote(o);
    console.log(m,'valid:',rep.ok,'errors:',rep.errors.slice(0,5),'warn:',rep.warnings.length, rep.warnings.slice(0,4),'| my total',o.quote.total,'their total',q.total);
  }
  // --- 2. import xlsx
  const wb=XLSX.utils.book_new();
  const rows=[["Прайс-лист ТОО Поставщик"],[],["Код","Наименование товара","Ед.изм","Цена розн."],["A-100","ЛДСП 16 мм (корпус), лист 2800×2070","лист","24 500,00"],["H-7","Петля Blum clip top с доводчиком","шт",1850],["H-8","Петля с доводчиком","шт",1300],["X-1","Ручка скоба 128 хром","шт",900],["Z","Раздел: прочее","",""]];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),"Лист1");
  fs.writeFileSync(OUT+'/supplier.xlsx',XLSX.write(wb,{type:'buffer',bookType:'xlsx'}));
  await page.click('[data-mode=price]'); await page.click('#p_import');
  await page.setInputFiles('#impFile',OUT+'/supplier.xlsx'); await page.waitForSelector('#impNext');
  await page.screenshot({path:OUT+'/imp2.png'});
  console.log('cols',await page.evaluate(()=>JSON.stringify([IMP.hdr,IMP.cols])));
  await page.click('#impNext'); await page.waitForSelector('#impApply');
  // manual link "Ручка"
  await page.fill('tr[data-id=handle] [data-find]','ручка скоба'); await page.waitForTimeout(100);
  await page.click('tr[data-id=handle] [data-pick]');
  await page.screenshot({path:OUT+'/imp3.png'});
  console.log('apply btn:',await page.textContent('#impApply'));
  await page.click('#impApply');
  console.log('prices after',await page.evaluate(()=>JSON.stringify([P.ldsp16,P.hinge,P.handle,PI.handle.link,PI.handle.sku])));
  // --- 3. export price (download)
  const [dl]=await Promise.all([page.waitForEvent('download',{timeout:5000}).catch(()=>null),page.click('#p_export')]);
  if(dl){ const pth=OUT+'/price-out.xlsx'; await dl.saveAs(pth); const w=XLSX.readFile(pth); const a=XLSX.utils.sheet_to_json(w.Sheets[w.SheetNames[0]],{header:1}); console.log('exported rows',a.length,a[0],a[1]);
    // reimport own file with changed price
    a[2][5]=27777; const w2=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w2,XLSX.utils.aoa_to_sheet(a),"Прайс"); fs.writeFileSync(OUT+'/own.xlsx',XLSX.write(w2,{type:'buffer',bookType:'xlsx'}));
    await page.click('#p_import'); await page.setInputFiles('#impFile',OUT+'/own.xlsx'); await page.waitForSelector('#impNext'); await page.click('#impNext'); await page.waitForSelector('#impApply');
    console.log('own apply:',await page.textContent('#impApply')); await page.click('#impApply'); console.log('ldsp16f',await page.evaluate(()=>P.ldsp16f));
  } else console.log('no download');
  // paste TSV
  await page.click('#p_import'); await page.fill('#impPaste','Петля с доводчиком\t999\nКромка ПВХ 2 мм (фасады, видимые торцы), м\t310'); await page.click('#impParse'); await page.waitForSelector('#impNext');
  console.log('paste cols',await page.evaluate(()=>JSON.stringify([IMP.hdr,IMP.cols]))); await page.click('#impNext'); console.log('paste apply:',await page.textContent('#impApply')); await page.click('#modalX');
  // add custom material & use it
  await page.click('[data-padd="Плиты"]'); await page.waitForTimeout(100);
  const cid=await page.evaluate(()=>PRICE.filter(x=>!x.sys).pop().id);
  await page.fill(`tr[data-id="${cid}"] [data-f=name]`,'ЛДСП Egger дуб'); await page.fill(`tr[data-id="${cid}"] [data-f=v]`,'31000');
  await page.click('[data-mode=kitchen]'); await page.selectOption('[data-b="kit.body"]',cid); await page.waitForTimeout(200);
  console.log('custom mat row:',await page.evaluate(()=>CUR.quote.rows[0].join(' | ')));
  // --- 4. kitchen interactions
  await page.click('[data-act="add,0,lower"]'); await page.waitForSelector('.mcard'); await page.screenshot({path:OUT+'/picker.png'});
  await page.click('.mcard[data-t=l_bottle]'); await page.waitForTimeout(200);
  console.log('fit text:',await page.textContent('#fitL0'));
  await page.click('#fitL0 button'); await page.waitForTimeout(100); console.log('occ:',await page.textContent('#occL0'));
  await page.selectOption('[data-c="R,low,t"]','blindB'); await page.waitForTimeout(100); console.log('blindB warns',await page.evaluate(()=>CUR.warns));
  await page.selectOption('[data-c="R,low,t"]','L');
  // click part in sketch
  await page.click('#sketch rect[data-i="5"]',{force:true}); console.log('sel:',await page.textContent('#selInfo'));
  // toUniv
  await page.click('#toUniv'); await page.waitForTimeout(300); console.log('univ panels',await page.evaluate(()=>[S.mode,S.u.panels.length,CUR.warns.length]));
  // save module from template
  await page.selectOption('#u_tpl','tumba'); await page.click('#u_rebuild'); await page.click('#u_saveMod'); await page.selectOption('#smCat','low'); await page.click('#smOk');
  await page.click('[data-mode=kitchen]'); 
  await page.evaluate(()=>{ S.kit.walls[0].lower.push({t:LIB.custom[0].id,w:1200}); renderWalls(); calc(); });
  console.log('custom module in kitchen parts',await page.evaluate(()=>CUR.parts.filter(p=>p.mod==="0l"+(S.kit.walls[0].lower.length-1)).map(p=>p.name+" "+p.a+"x"+p.b).slice(0,4)));
  await page.click('#save'); console.log('saved',await page.evaluate(()=>savedList().length));
  await page.click('[data-mode=lib]'); await page.screenshot({path:OUT+'/lib.png',fullPage:true});
  console.log('ERRORS',errs); await page.context().close();
  // --- 5. migration from old version
  const old=JSON.parse(fs.readFileSync('/mnt/project-files/order-format/examples/staryj-raschet-kalkulyatora.json','utf8'));
  const st=old.state||old; console.log('old keys',Object.keys(st).slice(0,8), st.mode);
  ({page,errs}=await open(browser,{ls:{kupe_current:JSON.stringify(st),kupe_prices:JSON.stringify({ldsp:25000,fac_film:23000}),kupe_saved:JSON.stringify([{name:"Тест",date:"01.11.2026",total:1000,state:st}])}}));
  console.log('migrated',await page.evaluate(()=>[S.mode,S.v,P.ldsp16,P.mdf,savedList().length,$("total").textContent]),'ERR',errs);
  for(const m of ['kupe','kitchen','univ']){ await page.click(`[data-mode=${m}]`); await page.waitForTimeout(150); }
  console.log('after modes ERR',errs);
  await page.context().close();
  // --- 6. mobile
  ({page,errs}=await open(browser,{vp:{width:390,height:800}}));
  await page.screenshot({path:OUT+'/m-kupe.png'}); await page.click('[data-mode=kitchen]'); await page.evaluate(()=>window.scrollTo(0,900)); await page.waitForTimeout(200); await page.screenshot({path:OUT+'/m-kit.png'});
  await page.click('[data-mode=price]'); await page.screenshot({path:OUT+'/m-price.png'});
  console.log('mobile overflow',await page.evaluate(()=>document.documentElement.scrollWidth),'ERR',errs);
  await browser.close();
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
