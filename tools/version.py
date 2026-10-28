#!/usr/bin/env python3
"""Manavao ny version: version.json (lisitry ny fichier) + VERSION ao amin'ny js/app.js.
Ampandehano alohan'ny commit: python3 tools/version.py"""
import json, os, re, datetime
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3)))  # Antananarivo
version = now.strftime('%Y-%m-%d %H:%M')
files = ['index.html', 'config.js']
for d in ('js', 'css'):
    for dirpath, _, names in os.walk(os.path.join(root, d)):
        for n in sorted(names):
            if n.endswith(('.js', '.css')):
                files.append(os.path.relpath(os.path.join(dirpath, n), root).replace(os.sep, '/'))
with open(os.path.join(root, 'version.json'), 'w') as f:
    json.dump({'version': version, 'date': now.isoformat(timespec='minutes'), 'files': sorted(files)}, f, indent=1)
p = os.path.join(root, 'js', 'app.js')
s = open(p).read()
s = re.sub(r"export const VERSION = '[^']*';", f"export const VERSION = '{version}';", s)
open(p, 'w').write(s)
print(version, len(files), 'files')
