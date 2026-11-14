import glob,os
d=os.path.dirname(os.path.abspath(__file__))
css=open(d+'/src/style.css').read(); body=open(d+'/src/body.html').read()
js='\n'.join(open(f).read() for f in sorted(glob.glob(d+'/src/*.js')))
html=f'''<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Калькулятор мебели: шкафы-купе и кухни</title>
<script type="importmap">{{"imports":{{"three":"https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/"}}}}</script>
<style>
{css}</style>
</head>
<body>
{body}
<script>
{js}</script>
</body>
</html>
'''
os.makedirs(d+'/dist',exist_ok=True); open(d+'/dist/index.html','w').write(html); print(len(html))
os.makedirs(d+'/dist/demo',exist_ok=True); open(d+'/dist/demo/index.html','w').write(html.replace('<script>\n"use strict";','<script>\n"use strict";\nconst DEMO=true;',1).replace('<title>Калькулятор мебели: шкафы-купе и кухни</title>','<title>Калькулятор мебели - демо</title>'))
