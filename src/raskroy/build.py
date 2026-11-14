p=open('page.html').read(); e=open('engine.js').read().replace('if(typeof module !== "undefined") module.exports = RK;','')
m=open('/mnt/project-files/order-format/mebel-order.js').read()
assert '</script' not in m.lower()
open('index.html','w').write(p.replace('/*ORDER*/',m).replace('/*ENGINE*/',e))
