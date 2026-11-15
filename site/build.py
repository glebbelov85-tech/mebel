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
    wr(os.path.join(OUT, "index.html"), rd(os.path.join(HERE, "home", "index.html")))
    wr(os.path.join(OUT, ".nojekyll"), "")
    wr(os.path.join(OUT, "404.html"), rd(os.path.join(HERE, "home", "404.html")))
    wr(os.path.join(OUT, "otzyv", "index.html"), rd(os.path.join(HERE, "home", "otzyv.html")))

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

    print("Сайт собран в", OUT)


if __name__ == "__main__":
    main()
