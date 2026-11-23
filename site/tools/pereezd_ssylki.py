#!/usr/bin/env python3
"""Страницы-переадресации со старого адреса витрин на новый (последний шаг переезда, см. site/pereezd/PEREEZD.md).

Пока файла site/pereezd.json нет, ничего не происходит: старый сайт работает как раньше.
Когда новый сайт проверен, создать site/pereezd.json:

    {"novyj_adres": "https://ИМЯ-ОРГАНИЗАЦИИ.github.io/"}

и собрать сайт как обычно (python3 site/build.py . --project src). build.py вызовет stubs(): каждая страница
index.html в vitriny/, vitrina/, krasnodar/ заменится короткой страницей, которая сразу открывает ту же страницу
на новом адресе, с тем же ?... и #... (ссылки клиентов вида krasnodar/klient/#rabota=... продолжают работать).
Остальные файлы (скрипты, зашифрованные данные) остаются на месте, поэтому откат - удалить site/pereezd.json
и собрать заново.

Можно запустить и руками на готовой сборке:  python3 site/tools/pereezd_ssylki.py ПАПКА_САЙТА https://новый.адрес/
"""
import html, json, os, re, sys

DIRS = ("vitriny", "vitrina", "krasnodar")

STUB = """<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Витрина переехала</title>
<script>location.replace(%(js)s + location.search + location.hash);</script>
<meta http-equiv="refresh" content="0; url=%(url)s">
<link rel="canonical" href="%(url)s">
</head><body style="font:16px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;padding:24px">
<p>Витрина переехала на новый адрес: <a id="go" href="%(url)s">открыть</a></p>
<script>document.getElementById("go").href = %(js)s + location.search + location.hash;</script>
</body></html>
"""


def check_base(base):
    assert re.match(r"^https://[a-z0-9.-]+\.[a-z]{2,}/([A-Za-z0-9._-]+/)*$", base), \
        "новый адрес должен начинаться с https:// и кончаться на / (например https://vitrina-mastera.github.io/): %r" % base
    return base


def stubs(site_dir, base):
    base = check_base(base)
    n = 0
    for d in DIRS:
        root = os.path.join(site_dir, d)
        if not os.path.isdir(root): continue
        for dp, dn, fn in os.walk(root):
            if "index.html" not in fn: continue
            rel = os.path.relpath(dp, site_dir).replace(os.sep, "/") + "/"
            url = base + rel
            open(os.path.join(dp, "index.html"), "w", encoding="utf-8").write(
                STUB % {"js": json.dumps(url), "url": html.escape(url, quote=True)})
            n += 1
    return n


def from_config(site_src, site_dir):
    """Вызывается из build.py: если есть site/pereezd.json - ставит переадресации. Возвращает число страниц или 0."""
    f = os.path.join(site_src, "pereezd.json")
    if not os.path.exists(f): return 0
    cfg = json.load(open(f, encoding="utf-8"))
    n = stubs(site_dir, cfg["novyj_adres"])
    print("Переезд: %d страниц витрин ведут на %s" % (n, cfg["novyj_adres"]))
    return n


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__); sys.exit(1)
    print("Готово, страниц:", stubs(os.path.abspath(sys.argv[1]), sys.argv[2]))
