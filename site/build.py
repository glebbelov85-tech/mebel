#!/usr/bin/env python3
"""Собирает сайт "Мебельный конструктор" из исходников инструментов.

    python3 build.py [ПАПКА_ВЫВОДА] [--project ПАПКА_ПРОЕКТА]

ПАПКА_ПРОЕКТА - где лежат инструменты (calculator/, configurator/, kp-dogovor/, raskroy/,
uchet-zakazov/, order-format/). По умолчанию /mnt/project-files, а если её нет - папка src/
рядом с этим файлом (так сборка работает и из клона репозитория).

Что делает: собирает каждый инструмент его же способом, кладёт в свою папку сайта и
добавляет общую полоску сайта (shared/site.js, site.css) и адаптер из adapters/ -
маленький кусок кода, который учит инструмент отдавать и принимать заказ.
"""
import datetime, json, os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:]]
PROJECT = None
if "--project" in args:
    i = args.index("--project"); PROJECT = args[i + 1]; del args[i:i + 2]
if not PROJECT:
    PROJECT = "/mnt/project-files" if os.path.isdir("/mnt/project-files/order-format") else os.path.join(HERE, "src")
OUT = os.path.abspath(args[0]) if args else os.path.join(HERE, "dist")


def rd(p): return open(p, encoding="utf-8").read()
def wr(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(s)
def P(*a): return os.path.join(PROJECT, *a)


ORDER_JS = rd(P("order-format", "mebel-order.js"))
assert "</script" not in ORDER_JS.lower()


def inject(html, tool, adapter=True):
    """Общие стили и site.js - в <head> (до кода инструмента), адаптер - в конец <body>."""
    head = ('<link rel="stylesheet" href="../shared/site.css">\n'
            '<script>window.MEBEL_TOOL = "%s";</script>\n<script src="../shared/golos.js"></script>\n<script src="../shared/site.js"></script>\n' % tool)
    assert "</head>" in html, tool  # первое вхождение - настоящий head (дальше бывает внутри строк)
    html = html.replace("</head>", head + "</head>", 1)
    if adapter:
        a = rd(os.path.join(HERE, "adapters", tool + ".js"))
        assert "</script" not in a.lower()
        i = html.rindex("</body>")
        html = html[:i] + "<script>\n" + a + "</script>\n" + html[i:]
    return html


def version():
    now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
    note = ""
    f = os.path.join(HERE, "obnovlenie.txt")
    if os.path.exists(f):
        for line in rd(f).splitlines():
            line = line.strip()
            if line and not line.startswith("#"): note = line; break
    return {"v": now.strftime("%Y%m%d%H%M%S"), "at": now.isoformat().replace("+00:00", "Z"), "note": note}


def krasnodar():
    out = os.path.join(OUT, "krasnodar")
    shutil.copytree(os.path.join(HERE, "krasnodar"), out)
    assert os.path.exists(os.path.join(out, "enc", "d.bin")), "нет krasnodar/enc - запустите site/tools/zashifrovat-krasnodar.js"
    noindex = '<meta name="robots" content="noindex, nofollow, noarchive, noimageindex">\n<meta name="referrer" content="no-referrer">\n'

    def locked(html, tool, scripts, repl, back="tr", head="", depth=1, sub=False):
        html = html.replace("<head>\n", "<head>\n" + noindex + head, 1)
        html = re.sub(r"<title>.*?</title>", "<title>Закрытая витрина</title>", html, count=1)
        html = re.sub(r'<meta (name="description"|property="og:[a-z]+")[^>]*>\n', "", html)
        for a, b in repl:
            assert a in html, (tool, a)
            html = html.replace(a, b)
        i, j = html.index('<script>window.MEBEL_TOOL'), html.rindex("</script>") + len("</script>")
        up = "../" * depth  # depth - на сколько папок страница глубже krasnodar/
        if back == "none" and depth == 1 and not sub: up = ""  # sub: страница в подпапке krasnodar/, но без кнопки "назад"
        tail = ('<script>window.MEBEL_TOOL = "%s";</script>\n<script src="%s../shared/site.js"></script>\n'
                '<script src="%szamok.js"></script>\n<script>KrZamok.page({ scripts: %s, back: "%s" });</script>' % (tool, up, up, json.dumps(scripts), back))
        return html[:i] + tail + html[j:]

    v3 = rd(os.path.join(HERE, "vitrina", "index.html"))
    wr(os.path.join(out, "vitrina", "index.html"), locked(v3, "kr-vitrina", ["../../vitrina/risunki.js", "../../vitrina/vitrina.js"], [
        ('href="../shared/site.css"', 'href="../../shared/site.css"'),
        ('href="redaktor/"', 'href="../../vitrina/redaktor/"'),
        ('href="../konfigurator/"', 'href="../../konfigurator/"')]))
    # главная закрытой витрины = путешествие по дому (вариант 4). Вопросы и правки для мастера - в master/.
    v4 = rd(os.path.join(HERE, "vitrina", "puteshestvie", "index.html"))
    old = '<script>if(/^#(raboty|voprosy|otzyv)$/.test(location.hash))location.replace("master/"+location.hash);</script>\n'  # старые ссылки на вкладки
    wr(os.path.join(out, "index.html"), locked(v4, "kr-dom", ["kr-dom.js", "../vitrina/risunki.js", "../vitrina/puteshestvie/puteshestvie.js"], [
        ('href="../../shared/site.css"', 'href="../shared/site.css"'),
        ('href="../redaktor/"', 'href="../vitrina/redaktor/"'),
        ('href="../#raschet"', 'href="vitrina/#raschet"')], back="none", head=old))
    # Пробные оформления главной (дом): krasnodar/dizajn/v1..v4 - та же страница, что главная, плюс оформление
    # из site/vitrina/dizajn/ (фон, дом, вход). Выбор и описание - krasnodar/dizajn/ (страница из site/krasnodar/dizajn/).
    # Главную не меняют, пока Александр не выберет вариант.
    dz = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap">\n' +
          "".join('<link rel="stylesheet" href="../../../vitrina/dizajn/%s.css">\n' % f for f in ("dizajn", "tema-vecher", "tema-utro", "tema-premium", "tema-zhivoj")))
    for n, t in ((1, "vecher"), (2, "utro"), (3, "premium"), (4, "zhivoj")):
        h = locked(v4, "kr-dizajn", ["../../../vitrina/risunki.js", "../../../vitrina/dizajn/dizajn.js", "../../../vitrina/puteshestvie/puteshestvie.js"], [
            ('href="../../shared/site.css"', 'href="../../../shared/site.css"'),
            ('href="../redaktor/"', 'href="../../../vitrina/redaktor/"'),
            ('href="../#raschet"', 'href="../../vitrina/#raschet"'),
            ("</head>", dz + "</head>")],
            back="none", depth=2,
            head='<script>window.VP_TEMA = "%s"; window.VP_TRY = true; window.VP_PREVIEW = true; document.documentElement.setAttribute("data-tema", "%s");</script>\n' % (t, t))
        wr(os.path.join(out, "dizajn", "v%d" % n, "index.html"), h)
    # Новые пробные оформления (2026-11-23): krasnodar/dizajn/v5..v8 - строгий минимализм по мотивам сайтов фабрик,
    # объёмный дом, меню на весь экран, видео на фоне. Слой site/vitrina/dizajn2/ (d2.css + d2.js), шрифты рядом.
    # v9..v11 (2026-11-23, по отзыву на "Кино"): тот же фон, другие формы дома (window.D2_DOM) - разрез, окна, силуэт.
    d2 = [(5, "galereya", "Галерея", ""), (6, "kino", "Кино", ""), (7, "grafit", "Тёмный зал", ""), (8, "liniya", "Линия", ""),
          (9, "kino", "Кино: разрез", "razrez"), (10, "kino", "Кино: окна", "okna"), (11, "kino", "Кино: силуэт", "siluet"),
          (12, "kino", "Кино: линии", "linii"),
          (13, "kino", "Кино: просто", "linii"),
          (14, "kino", "Просто: поворот", "linii")]  # v14 (пробный, 2026-11-23): дом 13-го можно поворачивать (D2_3D)  # v12 (выбор Александра): основа 10, дом линиями из 11, комнаты как в 6, журнал-"сцена"
    d2try = json.dumps({"list": [{"n": n, "name": nm} for n, _, nm, _ in d2]}, ensure_ascii=False)
    for n, t, nm, dom in d2:
        h = locked(v4, "kr-dizajn", ["../../../vitrina/risunki.js", "../../../vitrina/dizajn2/d2.js", "../../../vitrina/puteshestvie/puteshestvie.js"], [
            ('href="../../shared/site.css"', 'href="../../../shared/site.css"'),
            ('href="../redaktor/"', 'href="../../../vitrina/redaktor/"'),
            ('href="../#raschet"', 'href="../../vitrina/#raschet"'),
            ('<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">\n', ""),
            ('<meta name="theme-color" content="#110F0C">', '<meta name="theme-color" content="%s">' % ("#ECEAE5" if t in ("galereya", "liniya") else "#0F0F0E")),
            ("</head>", '<link rel="stylesheet" href="../../../vitrina/dizajn2/d2.css">\n</head>')],
            back="none", depth=2,
            head='<script>window.D2_TEMA = "%s"; window.D2_TRY = %s; window.D2_TRY.n = %d; window.D2_DOM = "%s"; window.D2_ZH = %s; %swindow.VP_PREVIEW = true;</script>\n' % (t, d2try, n, dom, "true" if n == 12 else "false",
                 ('window.D2_P = true; window.VP_VID = "plitki"; ' if n in (13, 14) else "") + ("window.D2_3D = true; " if n == 14 else "")))  # v13 "Просто": см. d2.js
        wr(os.path.join(out, "dizajn", "v%d" % n, "index.html"), h)
    # Чистый вход для клиента (2026-11-23, просьба Александра): krasnodar/klient/ - вариант 13 "Просто" без служебной
    # полосы ("Варианты дизайна", путь, пометка "Пробный дизайн"). Пин-код тот же. Страницы сравнения не трогает.
    h = locked(v4, "kr-klient", ["../../vitrina/risunki.js", "../../vitrina/dizajn2/d2.js", "../../vitrina/puteshestvie/puteshestvie.js"], [
        ('href="../redaktor/"', 'href="../../vitrina/redaktor/"'),
        ('href="../#raschet"', 'href="../vitrina/#raschet"'),
        ('<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">\n', ""),
        ('<meta name="theme-color" content="#110F0C">', '<meta name="theme-color" content="#0F0F0E">'),
        ("</head>", '<link rel="stylesheet" href="../../vitrina/dizajn2/d2.css">\n</head>')],
        back="none", depth=1, sub=True,
        head='<script>window.D2_TEMA = "kino"; window.D2_DOM = "linii"; window.D2_ZH = true; window.D2_P = true; window.VP_VID = "zhurnal"; window.VP_PREVIEW = true; window.D2_KLIENT = true; window.VP_ZASTAVKA = true;</script>\n')
    wr(os.path.join(out, "klient", "index.html"), h)
    # старый адрес дома ведёт на главную (с тем же #rabota=/#komnata=)
    wr(os.path.join(out, "dom", "index.html"), '<!DOCTYPE html>\n<html lang="ru"><head><meta charset="UTF-8">\n' + noindex +
       '<title>Закрытая витрина</title>\n<script>location.replace("../" + location.search + location.hash);</script>\n'
       '<meta http-equiv="refresh" content="0; url=../"></head><body></body></html>\n')


def run_build(folder):
    subprocess.run([sys.executable, "build.py"], cwd=P(folder), check=True, stdout=subprocess.DEVNULL)


def main():
    if os.path.isdir(OUT):
        # чистим всё, кроме служебных файлов git и исходников
        for n in os.listdir(OUT):
            if n in (".git", "src", "site", "README.md", ".gitignore"): continue
            p = os.path.join(OUT, n)
            shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    os.makedirs(OUT, exist_ok=True)

    # общая часть и главная
    for f in ("site.css", "golos.js"):
        os.makedirs(os.path.join(OUT, "shared"), exist_ok=True)
        shutil.copy(os.path.join(HERE, "shared", f), os.path.join(OUT, "shared", f))
    # пометка "Обновление": время сборки + что нового (первая строка obnovlenie.txt).
    # Тот же номер вшивается в site.js, а version.json сайт перечитывает, чтобы
    # подсказать "Доступно обновление", если открыта старая страница.
    ver = version()
    wr(os.path.join(OUT, "version.json"), json.dumps(ver, ensure_ascii=False) + "\n")
    sj = rd(os.path.join(HERE, "shared", "site.js"))
    assert "/*SITE_VERSION*/null" in sj
    wr(os.path.join(OUT, "shared", "site.js"), sj.replace("/*SITE_VERSION*/null", json.dumps(ver, ensure_ascii=False)))
    wr(os.path.join(OUT, "shared", "mebel-order.js"), ORDER_JS)
    # Корень сайта - стартовая страница: два раздела, "Инструменты мастера" (instrumenty/) и "Витрины" (vitriny/).
    # Главная Конструктора (сводка, путь заказа, настройки) - в konstruktor/.
    wr(os.path.join(OUT, "index.html"), rd(os.path.join(HERE, "start", "index.html")))
    wr(os.path.join(OUT, "konstruktor", "index.html"), rd(os.path.join(HERE, "home", "index.html")))
    wr(os.path.join(OUT, ".nojekyll"), "")
    wr(os.path.join(OUT, "404.html"), rd(os.path.join(HERE, "home", "404.html")))
    wr(os.path.join(OUT, "otzyv", "index.html"), rd(os.path.join(HERE, "home", "otzyv.html")))
    # Блокнот мастера - второй продукт: отдельная страница со своими файлами, общий site.js
    shutil.copytree(os.path.join(HERE, "bloknot"), os.path.join(OUT, "bloknot"))
    # Витрина мастера - третий вариант: страница для клиентов + Мастерская (redaktor/)
    shutil.copytree(os.path.join(HERE, "vitrina"), os.path.join(OUT, "vitrina"))
    # Карточка "Витрины" на стартовой странице: экран выбора витрины (мастера, путешествие, Краснодар)
    shutil.copytree(os.path.join(HERE, "vitriny"), os.path.join(OUT, "vitriny"))
    # Раздел "Инструменты мастера" (2026-11-23): Конструктор и Блокнот мастера
    shutil.copytree(os.path.join(HERE, "instrumenty"), os.path.join(OUT, "instrumenty"))
    # Закрытая витрина для Краснодара: страница входа по пин-коду + зашифрованные данные и фото (enc/).
    # Внутри - те же витрины вариантов 3 и 4, но данные они получают из расшифровки (zamok.js).
    krasnodar()

    # 1. Калькулятор (+ демо для коллег без полоски сайта)
    run_build("calculator")
    wr(os.path.join(OUT, "kalkulyator", "index.html"), inject(rd(P("calculator", "dist", "index.html")), "kalkulyator"))
    wr(os.path.join(OUT, "kalkulyator", "demo", "index.html"), rd(P("calculator", "dist", "demo", "index.html")))

    # 2. Конфигуратор: та же склейка, что в его build.py, адаптер - внутри его модуля
    src = P("configurator", "src")
    page = rd(os.path.join(src, "page.html"))
    app = "".join(rd(os.path.join(src, f)) + "\n" for f in ("gen.js", "view.js", "edit.js", "ui.js"))
    app += rd(os.path.join(HERE, "adapters", "konfigurator.js")) + "\n"
    assert "</script" not in app
    html = page.replace("/*MEBEL_ORDER*/", ORDER_JS).replace("/*APP*/", '(function(){"use strict";\n' + app + "})();")
    wr(os.path.join(OUT, "konfigurator", "index.html"), inject(html, "konfigurator", adapter=False))

    # 3. КП и договор: страница + свои библиотеки, модуль заказа - свежий
    kp = os.path.join(OUT, "kp")
    shutil.copytree(P("kp-dogovor", "lib"), os.path.join(kp, "lib"))
    shutil.copy(P("kp-dogovor", "kp-docs.js"), kp)
    wr(os.path.join(kp, "lib", "mebel-order.js"), ORDER_JS)
    wr(os.path.join(kp, "index.html"), inject(rd(P("kp-dogovor", "index.html")), "kp"))

    # 4. Карта раскроя: его build.py вклеивает движок и модуль заказа
    # (то же, что его build.py, но без жёсткого пути к модулю заказа)
    eng = rd(P("raskroy", "engine.js")).replace('if(typeof module !== "undefined") module.exports = RK;', "")
    html = rd(P("raskroy", "page.html")).replace("/*ORDER*/", ORDER_JS).replace("/*ENGINE*/", eng)
    wr(os.path.join(OUT, "raskroy", "index.html"), inject(html, "raskroy"))

    # 5. Учёт заказов
    wr(os.path.join(OUT, "zakazy", "mebel-order.js"), ORDER_JS)
    wr(os.path.join(OUT, "zakazy", "index.html"), inject(rd(P("uchet-zakazov", "index.html")), "zakazy"))

    # Переезд витрин (site/pereezd/PEREEZD.md): только если есть site/pereezd.json - страницы витрин
    # заменяются переадресациями на новый адрес. Без этого файла ничего не меняется.
    # Сборка для нового репозитория (site/tools/vitriny-vynos.py) этот шаг выключает.
    if not os.environ.get("MEBEL_BEZ_PEREEZDA"):
        sys.path.insert(0, os.path.join(HERE, "tools"))
        import pereezd_ssylki
        pereezd_ssylki.from_config(HERE, OUT)

    print("Сайт собран в", OUT)


if __name__ == "__main__":
    main()
