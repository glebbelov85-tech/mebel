import sys,os
d=os.path.dirname(os.path.abspath(__file__))
page=open(d+'/src/page.html').read()
mo=open('/mnt/project-files/order-format/mebel-order.js').read()
app=''.join(open(d+'/src/'+f).read()+'\n' for f in ['gen.js','view.js','ui.js'])
assert '</script' not in mo and '</script' not in app
out=page.replace('/*MEBEL_ORDER*/',mo).replace('/*APP*/','(function(){"use strict";\n'+app+'})();')
os.makedirs(d+'/out',exist_ok=True)
open(d+'/out/index.html','w').write(out)
open(d+'/out/test.html','w').write(out.replace('<script>\n/*!','<script>window.THREE_LOCAL="/three/build/three.module.min.js";</script><script>\n/*!',1).replace('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">',''))
print(len(out))
