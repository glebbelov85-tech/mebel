const fs=require('fs');global.localStorage={getItem(){return null},setItem(){}};
const files=['a_core','b_engine','c_univ','d_kupe','e_kitchen','j_voice','k_edit'];
const src=files.map(f=>fs.readFileSync(__dirname+'/../src/'+f+'.js','utf8')).join('\n');
const body=fs.readFileSync(process.argv[2]||__dirname+'/t1.js','utf8');
new Function('require',src+';loadPrice();'+body)(require);
