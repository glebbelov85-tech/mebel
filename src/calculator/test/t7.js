// разбор текста замера (PDF/фото): что приложение предложит подтвердить
[["Замер кухни. Основная стена 3200 мм, правая стена 1800 мм. Высота потолка 2700. Окно 1400, от угла 650","3200/1800/2700"],
 ["3,2 м   2.05 м   потолок 2,6 м","3200/-/2600"],
 ["320 180 60 85","3200/-/-"],
 ["3 200  600 600 800  2 700","3200/-/-"],
 ["стена А 4100 стена Б 2350 h=2650","4100/2350/2650"],
 ["привет",""]].forEach(([s,want])=>{ const p=zmScanParse(s), v=p.vals, got=v.len0?[v.len0,v.len1||"-",v.ceil||"-"].join("/"):""; console.log((got===want?"ok   ":"FAIL ")+s.slice(0,50)+" => "+got+"  nums "+p.nums.join(",")); });
S=defaultState(); S.mode="kitchen"; zmFresh(); S.zm.sub={k:"scan",vals:{len0:3200},nums:[2700,1800]};
["вторая стена 1800","потолок 2700","основная стена 3400","да"].forEach(x=>{ const r=zmRun(x); console.log("> "+x+" => "+r.out.map(o=>o.html).join(" | ")+"  ["+S.zm.step+"/"+(S.zm.sub?S.zm.sub.k+" "+zmScanTxt(S.zm.sub):"")+"]"); });
console.log(S.kit.layout, S.kit.walls.map(w=>w.len), S.kit.ceil||S.kit.upperH, JSON.stringify(S.zm.scanRest||null));
