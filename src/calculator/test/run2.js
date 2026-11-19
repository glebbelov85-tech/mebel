// логика вместе с расчётом цены (calcCore) и замером по шагам: node test/run2.js test/t6.js
const fs=require('fs');global.window=global.window||{};const store={};global.localStorage={getItem(k){return k in store?store[k]:null},setItem(k,v){store[k]=String(v)}};
const files=['a_core','b_engine','c_univ','d_kupe','e_kitchen','f_ui','i_lib','j_voice','k_edit','k_more','k_syn','p_zamer','q_scan'];
const mo=fs.readFileSync(__dirname+'/../../order-format/mebel-order.js','utf8');
const src=files.filter(f=>fs.existsSync(__dirname+'/../src/'+f+'.js')).map(f=>fs.readFileSync(__dirname+'/../src/'+f+'.js','utf8')).join('\n');
const body=fs.readFileSync(process.argv[2]||__dirname+'/t6.js','utf8');
new Function('require',mo+'\n'+src+';loadPrice();'+body)(require);
