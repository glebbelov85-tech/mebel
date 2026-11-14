# Калькулятор мебели v2 (исходники)

Артефакт: https://claude.ai/artifact/2SVwTwsvCJtPjY3sGyVuSm (slug 0ba89135-fab6-498a-b9cc-ec0af5439de6, capability downloads).
Сборка: `python3 build.py` склеивает src/style.css + src/body.html + src/*.js (по алфавиту) в dist/index.html. Готовая страница: kalkulyator-mebel-v2.html.

- a_core.js - утилиты, прайс (PRICE_DEF, позиция = {id,g,name,s,u,v,sku,link,m}), материалы = позиции прайса с m {kind,t,sw,sh,css,edge,facade,cut}
- b_engine.js - деталь {name,mat,o,x,y,z,a,b,edge,t?,f?,hd?,mod?,w?}, преобразования, costParts, cutList, stretch ("резиновый" размер)
- c_univ.js - шаблоны "Любое изделие"; d_kupe.js - генератор шкафа-купе; e_kitchen.js - MODLIB (модули кухни), углы, genKitchen
- f_ui.js - состояние S, формы, calc(), эскизы (общая проекция деталей); g_3d.js - three.js 0.187 (ES-модуль, грузится по требованию)
- h_price.js - страница прайса, импорт Excel (SheetJS 0.20.3 через @e965/xlsx c SRI), сохранение файлов; i_lib.js - модули, сохранения, резервная копия, toOrder() в формат mebel-order 1.0
- localStorage: mk2_price, mk2_lib, mk2_saved, mk2_current (старые kupe_* переносятся автоматически)
- Тесты: test/run.js (node, логика), test/pw.js и pw2.js (Playwright; CDN подменяется локальными npm-пакетами)

## Описание словами и демо (2026-11-14)
- j_voice.js - parseSpeech(text): русская фраза -> параметры кухни / купе / шаблона, авторасстановка модулей кухни; окно "Описать словами". Микрофон: capability dictation (только владелец и его организация, Chromium), иначе Web Speech API если страница открыта файлом, иначе диктовка клавиатурой телефона в текстовое поле. Тест фраз: `node test/run.js test/t2.js`.
- Демо: build.py собирает dist/demo/index.html (const DEMO=true - баннер с пояснением). Артефакт демо: https://claude.ai/artifact/LDu756Wkhgvgi1eDM2pyoo (slug 9baaaba0-b3da-4b92-b5fb-4282e419a2e2). При изменениях публиковать оба артефакта.
