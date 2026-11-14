for(const lay of ["1","2R","2L","3"]){
  const K=kitDefaults(); K.layout=lay;
  const r=genKitchen(K), c=costParts(r.parts,r.hw);
  console.log("==",lay,r.parts.length,"parts; top",r.info.topM,"joints",r.info.joints, bounds(r.parts));
  console.log(r.warns.join("\n"));
  const ov=checkParts(r.parts,{overlap:1}); console.log("overlaps:",ov.slice(0,8));
  if(lay==="2R"){ console.log(c.rows.map(x=>x[0]+" | "+x[1]+" | "+Math.round(x[2])).join("\n")); console.log(facadeList(r.parts,"mdf")); console.log(r.desc); }
}
const K=kitDefaults(); K.corners.R.low={t:"blindB",A:0,B:1050}; let r=genKitchen(K); console.log("blindB",r.warns, checkParts(r.parts,{overlap:1}));
K.corners.R.low={t:"blindA",A:1050,B:0}; r=genKitchen(K); console.log("blindA",r.warns, checkParts(r.parts,{overlap:1}));
K.corners.R.low={t:"none"}; K.corners.R.up={t:"none"}; r=genKitchen(K); console.log("none",r.warns, checkParts(r.parts,{overlap:1}));
