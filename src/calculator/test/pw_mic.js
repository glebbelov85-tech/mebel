// микрофон на телефоне (Android, поддельное распознавание): кнопка не мигает между фразами. Нужен сервер в корне репо на :8765.
const {chromium,devices}=require('playwright');
const MOCK=`(()=>{ window.__phr=[]; window.__log=[];
 class FakeSR{ constructor(){ this.continuous=false; } start(){ window.__log.push('start'); this._on=true; window.__cur=this; setTimeout(()=>this._next(),300); }
  _next(){ if(!this._on) return; const p=window.__phr.shift(); if(!p){ setTimeout(()=>this._next(),300); return; }
    const mk=(t,fin)=>{ const r=[{transcript:t}]; r.isFinal=fin; return r; };
    this.onresult&&this.onresult({resultIndex:0,results:[mk(p.slice(0,5),false)]});
    setTimeout(()=>{ this.onresult&&this.onresult({resultIndex:0,results:[mk(p,true)]}); if(!this.continuous){ this._on=false; setTimeout(()=>{ window.__log.push('end'); this.onend&&this.onend(); },50); } else setTimeout(()=>this._next(),300); },200); }
  stop(){ window.__log.push('stop'); if(this._on){ this._on=false; setTimeout(()=>this.onend&&this.onend(),30);} } abort(){ this.stop(); } }
 window.SpeechRecognition=FakeSR; window.webkitSpeechRecognition=FakeSR; })();`;
(async()=>{ const b=await chromium.launch();
 for(const url of ['http://localhost:8765/kalkulyator/','http://localhost:8765/raskroy/']){
 const ctx=await b.newContext({...devices['Pixel 7']}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(MOCK); await p.goto(url); await p.waitForTimeout(800);
 const isCalc=url.includes('kalk');
 console.log(url,'top voice btn visible:',isCalc?await p.isVisible('#voiceBtn'):'-');
 const pill=isCalc?'#edPill':'#msvPill', mic=isCalc?'#edMic':'#msvMic', live=isCalc?'#edLive':'#msvLive';
 await p.click(pill); await p.waitForTimeout(200);
 // record state of mic button every 50ms
 await p.evaluate(m=>{ window.__st=[]; setInterval(()=>{ const e=document.querySelector(m); window.__st.push(e.className.includes('rec')||e.className.includes(' on')?1:0); },50); },mic);
 const phrases=isCalc?['угловая кухня 3 на 2 метра','добавь ящик','убери ручки']:['что здесь можно нажать','прокрути вниз'];
 for(const ph of phrases){ await p.evaluate(x=>window.__phr.push(x),ph); await p.waitForTimeout(900); console.log('  live:',(await p.textContent(live)).trim().slice(0,60)); }
 await p.screenshot({path:__dirname+'/shots/mic_'+(isCalc?'calc':'site')+'.png'});
 const st=await p.evaluate(()=>window.__st); const flips=st.reduce((a,v,i)=>a+(i&&v!==st[i-1]?1:0),0);
 console.log('  mic text:',(await p.textContent(mic)).trim(),'| state flips while listening:',flips,'| samples',st.length,'| sr log:',(await p.evaluate(()=>window.__log)).join(','));
 await p.click(mic); await p.waitForTimeout(300); console.log('  after stop:',(await p.textContent(mic)).trim(),'live hidden:',!(await p.isVisible(live)));
 if(isCalc) console.log('  log:',(await p.$$eval('#edLog > div',d=>d.map(x=>x.textContent.slice(0,50)))).slice(-6).join(' | '));
 console.log('  errors',errs); await ctx.close(); }
 await b.close(); })();
