#!/usr/bin/env python3
"""Manavao ny version: version.json, VERSION ao amin'ny js/app.js, ary manampy ?v=<version>
amin'ny import rehetra (mba tsy hampiasain'ny navigateur ny fichier taloha ao amin'ny cache).
Ampandehano alohan'ny commit: python3 tools/version.py"""
import json, os, re, datetime
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3)))  # Antananarivo
version = now.strftime('%Y-%m-%d %H:%M')
tag = now.strftime('%Y%m%d%H%M')
PAGES = ['index.html', 'connexion.html', 'client.html', 'livreur.html']
files = PAGES + ['config.js']
imp = re.compile(r"""((?:from|import)\s*\(?\s*['"])(\.{1,2}/[^'"?]+?\.(?:js|mjs))(?:\?v=\d+)?(['"])""")
for d in ('js', 'css'):
    for dirpath, _, names in os.walk(os.path.join(root, d)):
        for n in sorted(names):
            if not n.endswith(('.js', '.css')):
                continue
            fp = os.path.join(dirpath, n)
            files.append(os.path.relpath(fp, root).replace(os.sep, '/'))
            if n.endswith('.js'):
                s = open(fp).read()
                s2 = imp.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={tag}{m.group(3)}", s)
                if s2 != s:
                    open(fp, 'w').write(s2)
p = os.path.join(root, 'js', 'app.js')
s = open(p).read()
s = re.sub(r"export const VERSION = '[^']*';", f"export const VERSION = '{version}';", s)
open(p, 'w').write(s)
for page in PAGES:
    p = os.path.join(root, page)
    if not os.path.exists(p):
        continue
    s = open(p).read()
    s = re.sub(r'(src="js/[\w/.-]+?\.js)(\?v=\d+)?(")', rf'\1?v={tag}\3', s)
    s = re.sub(r'(href="css/[\w/.-]+?\.css)(\?v=\d+)?(")', rf'\1?v={tag}\3', s)
    open(p, 'w').write(s)
with open(os.path.join(root, 'version.json'), 'w') as f:
    json.dump({'version': version, 'tag': tag, 'date': now.isoformat(timespec='minutes'), 'files': sorted(files)}, f, indent=1)
print(version, len(files), 'files')
