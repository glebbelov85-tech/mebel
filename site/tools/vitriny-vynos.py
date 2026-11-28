#!/usr/bin/env python3
"""Собирает сайт витрин для отдельного репозитория (переезд витрин, см. site/pereezd/PEREEZD.md).

    python3 site/tools/vitriny-vynos.py ПАПКА_ВЫВОДА

Что делает:
  1. собирает весь сайт обычным site/build.py во временную папку (ничего в репозитории не меняет);
  2. берёт из сборки только витрины: vitriny/ (выбор витрины), vitrina/ (вариант 3, Мастерская, путешествие,
     дизайны), krasnodar/ (закрытая витрина) и общие shared/site.js, site.css, golos.js, version.json;
  3. правит то, что ведёт на инструменты мастера (их в новом репозитории нет): верх дерева навигации -
     "Витрины", кнопка "Собрать шкаф в 3D" (конфигуратор) скрыта;
  4. кладёт README.md нового репозитория, 404.html, корневую страницу (ведёт на vitriny/) и ISTOCHNIK.txt
     (из какого коммита собрано);
  5. проверяет: все относительные ссылки href/src в html ведут на существующие файлы, в файлах нет имени
     владельца старого репозитория и адреса старого сайта.

Исходники витрин остаются в этом репозитории (site/vitrina, site/vitriny, site/krasnodar) - одно место правок.
Папку вывода можно целиком положить в новый репозиторий (git) и опубликовать через GitHub Pages.
Папку вывода скрипт очищает (кроме .git), поэтому её можно держать клоном нового репозитория.
"""
import datetime, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)            # site/
REPO = os.path.dirname(SITE)            # корень репозитория mebel
TAKE_DIRS = ("vitriny", "vitrina", "krasnodar")
TAKE_SHARED = ("site.js", "site.css", "golos.js")
# Чего не должно быть в файлах нового сайта (имя владельца старого репозитория и адрес старого сайта)
FORBIDDEN = ("glebbelov", "github.io/mebel", "Белов", "Belov")


def rd(p): return open(p, encoding="utf-8").read()
def wr(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(s)


def patch(path, pairs):
    """Заменяет строки в файле. Каждая замена обязана сработать - иначе исходник изменился и правку надо пересмотреть."""
    s = rd(path)
    for a, b in pairs:
        assert a in s, "правка не подошла (исходник изменился?): %s\n  нет строки: %s" % (path, a[:120])
        s = s.replace(a, b)
    wr(path, s)


def build_full(tmp):
    subprocess.run([sys.executable, os.path.join(SITE, "build.py"), tmp, "--project", os.path.join(REPO, "src")],
                   check=True, stdout=subprocess.DEVNULL, env=dict(os.environ, MEBEL_BEZ_PEREEZDA="1"))


def clean(out):
    os.makedirs(out, exist_ok=True)
    for n in os.listdir(out):
        if n in (".git", ".github"): continue  # .github - автообновление нового репо (Actions)
        p = os.path.join(out, n)
        shutil.rmtree(p) if os.path.isdir(p) and not os.path.islink(p) else os.remove(p)


def commit_info():
    try:
        h = subprocess.run(["git", "-C", REPO, "rev-parse", "--short=12", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
        dirty = subprocess.run(["git", "-C", REPO, "status", "--porcelain", "--", "site", "src"], capture_output=True, text=True).stdout.strip()
        return h + (" (+ несохранённые правки)" if dirty else "")
    except Exception:
        return "неизвестно"


ROOT_HTML = """<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Витрины мастеров</title>
<script>location.replace("vitriny/" + location.search + location.hash);</script>
<meta http-equiv="refresh" content="0; url=vitriny/">
</head><body style="font:16px/1.5 system-ui,sans-serif;padding:24px">
<p><a href="vitriny/">Открыть витрины</a></p>
</body></html>
"""

NOT_FOUND = """<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Страница не найдена</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f6f4ef;color:#24302c;text-align:center;padding:24px;box-sizing:border-box}a{color:inherit}</style>
</head><body><div>
<h1 style="font-size:22px;margin:0 0 8px">Такой страницы нет</h1>
<p style="margin:0 0 16px;opacity:.75">Возможно, ссылка устарела или в ней опечатка.</p>
<p style="margin:0"><a id="home" href="/">На главную</a></p>
</div>
<script>
// Сайт может лежать не в корне домена (адрес вида имя.github.io/репозиторий/): ведём в корень этого репозитория.
(function () { var p = location.pathname.split("/").filter(Boolean); var a = document.getElementById("home");
  if (location.hostname.slice(-10) === ".github.io" && p.length && location.hostname.split(".")[0].toLowerCase() + ".github.io" !== p[0].toLowerCase()) a.href = "/" + p[0] + "/"; })();
</script>
</body></html>
"""


def adapt(out):
    """Правки под сайт без инструментов мастера."""
    # Верх дерева навигации - "Витрины": кнопки "назад"/"Главная" не ведут на стартовую страницу инструментов.
    patch(os.path.join(out, "shared", "site.js"), [
        ('vitriny: ["Витрины", "vitriny/", "start"]', 'vitriny: ["Витрины", "vitriny/", null]'),
    ])
    # Экран выбора витрин здесь - единственный раздел сайта
    patch(os.path.join(out, "vitriny", "index.html"), [
        ('<span class="tag">Раздел 2 из 2, в разработке</span>', '<span class="tag">В разработке</span>'),
        ('<title>Витрины мастеров - Мебельный конструктор</title>', '<title>Витрины мастеров</title>'),
    ])
    # "Собрать шкаф в 3D" ведёт в конфигуратор - его здесь нет. Кнопку прячем совсем.
    patch(os.path.join(out, "vitrina", "vitrina.js"), [
        ('$("c3d").classList.toggle("hide", !/shkaf|garderob|prihozhaya/.test(it.id));', '$("c3d").classList.add("hide");'),
    ])
    for f, href in ((os.path.join(out, "vitrina", "index.html"), "../konfigurator/"),
                    (os.path.join(out, "krasnodar", "vitrina", "index.html"), "../../konfigurator/")):
        patch(f, [('<a class="btn gh" href="%s" id="c3d">' % href, '<a class="btn gh hide" href="#" id="c3d" hidden>')])
    # Мастерская: в копии на новом адресе не светим имя владельца старого репозитория. Куда публиковать, хранит
    # зашифрованная настройка публикации (enc/p.json); если её ещё нет, название репо вводится при настройке.
    pj = os.path.join(out, "krasnodar", "masterskaya", "publik.js")
    if os.path.exists(pj):
        s = rd(pj)
        s = re.sub(r"\(main glebbelov[\w-]*/[\w.-]+\)", "(main, см. настройку публикации)", s)
        s = re.sub(r'repo: "glebbelov[\w-]*/[\w.-]+"', 'repo: ""', s)
        wr(pj, s)


LINK_RE = re.compile(r'''(?:href|src)\s*=\s*["']([^"'#?]+)''', re.I)


def check(out):
    bad = []
    for dp, dn, fn in os.walk(out):
        dn[:] = [d for d in dn if d not in (".git", ".github")]
        for f in fn:
            p = os.path.join(dp, f)
            rel = os.path.relpath(p, out)
            if f.endswith((".html", ".js", ".css", ".json", ".md", ".txt")):
                s = rd(p)
                for w in FORBIDDEN:
                    if w.lower() in s.lower(): bad.append("%s: есть \"%s\"" % (rel, w))
            if not f.endswith(".html") or rel == "404.html": continue
            for m in LINK_RE.finditer(rd(p)):
                u = m.group(1).strip()
                if not u or re.match(r"^(https?:|data:|mailto:|tel:|javascript:|//|blob:)", u) or "'" in u or "+" in u or "{" in u: continue
                t = os.path.normpath(os.path.join(dp, u))
                if u.endswith("/"): t = os.path.join(t, "index.html")
                if not os.path.exists(t): bad.append("%s: битая ссылка %s" % (rel, u))
    return bad


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    out = os.path.abspath(sys.argv[1])
    assert not out.startswith(REPO + os.sep) or out.startswith(os.path.join(REPO, ".")), \
        "папку вывода держите вне репозитория mebel (иначе build.py и git увидят лишнее)"
    tmp = tempfile.mkdtemp(prefix="vitriny-")
    keep = tempfile.mkdtemp(prefix="vitriny-enc-")
    try:
        build_full(tmp)
        # Файлы krasnodar/enc/, которые уже лежат в новом репозитории, но которых нет в свежей сборке
        # (например, мастер опубликовал правки прямо туда), не теряем: откладываем и возвращаем.
        enc_out, enc_new, kept = os.path.join(out, "krasnodar", "enc"), os.path.join(tmp, "krasnodar", "enc"), []
        if os.path.isdir(enc_out):
            for f in os.listdir(enc_out):
                # otkryto.json (ключ открытого входа) не сохраняем: его удаляют в исходниках, чтобы вернуть пин-код
                if f != "otkryto.json" and not os.path.exists(os.path.join(enc_new, f)):
                    shutil.copy2(os.path.join(enc_out, f), os.path.join(keep, f)); kept.append(f)
        clean(out)
        for d in TAKE_DIRS:
            shutil.copytree(os.path.join(tmp, d), os.path.join(out, d))
        for f in TAKE_SHARED:
            os.makedirs(os.path.join(out, "shared"), exist_ok=True)
            shutil.copy(os.path.join(tmp, "shared", f), os.path.join(out, "shared", f))
        shutil.copy(os.path.join(tmp, "version.json"), os.path.join(out, "version.json"))
        for f in kept:
            shutil.copy2(os.path.join(keep, f), os.path.join(out, "krasnodar", "enc", f))
        if kept:
            print("Внимание: в новом репозитории были файлы krasnodar/enc/, которых нет в исходниках, они сохранены:", ", ".join(sorted(kept)))
            print("  Перенесите их в site/krasnodar/enc/ этого репозитория, чтобы источник был один.")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        shutil.rmtree(keep, ignore_errors=True)
    adapt(out)
    wr(os.path.join(out, ".nojekyll"), "")
    wr(os.path.join(out, "index.html"), ROOT_HTML)
    wr(os.path.join(out, "404.html"), NOT_FOUND)
    wr(os.path.join(out, "README.md"), rd(os.path.join(SITE, "pereezd", "README-novogo-repo.md")))
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    wr(os.path.join(out, "ISTOCHNIK.txt"),
       "Собрано из исходников витрин (site/vitrina, site/vitriny, site/krasnodar) скриптом site/tools/vitriny-vynos.py\n"
       "Коммит: %s\nВремя: %s\n" % (commit_info(), now))
    bad = check(out)
    if bad:
        print("Проверка не прошла:\n  " + "\n  ".join(bad)); sys.exit(2)
    n = sum(len(fn) for _, _, fn in os.walk(out) if ".git" not in _)
    print("Сайт витрин собран в %s (%d файлов), проверка ссылок пройдена" % (out, n))


if __name__ == "__main__":
    main()
