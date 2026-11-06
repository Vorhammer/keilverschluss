# Baut index.html aus shell.html, core.js und app.js
import pathlib
d = pathlib.Path(__file__).parent
s = (d / 'shell.html').read_text()
core = (d / 'core.js').read_text().replace("if (typeof module !== 'undefined') module.exports = KV;", "")
s = s.replace('/*CORE*/', core).replace('/*APP*/', (d / 'app.js').read_text())
html = '<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#0B0B0B">\n</head>\n<body style="margin:0">\n' + s + '\n</body>\n</html>\n'
(d.parent / 'index.html').write_text(html)
