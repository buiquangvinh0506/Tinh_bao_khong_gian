from pathlib import Path
from datetime import datetime
import shutil

ROOT=Path(__file__).resolve().parent
if not (ROOT/'manage.py').exists():
    raise SystemExit('ERROR: Extract ZIP directly into GEOINT_Vinh (next to manage.py).')
asset_css='/static/atlas/brand-vinh.css?v=1'
asset_js='/static/atlas/brand-vinh.js?v=1'
head_css=f'<link rel="stylesheet" href="{asset_css}">'
body_js=f'<script defer src="{asset_js}"></script>'
paths=[]
for p in (ROOT/'atlas').rglob('*.html'):
    try: s=p.read_text(encoding='utf-8')
    except UnicodeError: continue
    if 'GEOINT / 3D ATLAS' in s and '{% load static %}' in s:
        paths.append(p)
for rel in ('intelligence/templates/intelligence/dashboard.html','intelligence/templates/intelligence/analysis_workspace.html'):
    p=ROOT/rel
    if p.exists():paths.append(p)
if not paths:raise SystemExit('ERROR: No known templates found; no changes made.')
backup=ROOT/('backup_brand_'+datetime.now().strftime('%Y%m%d_%H%M%S'))
for p in paths:
    content=p.read_text(encoding='utf-8')
    new=content
    if asset_css not in new:new=new.replace('</head>',head_css+'\n</head>',1)
    if asset_js not in new:new=new.replace('</body>',body_js+'\n</body>',1)
    if new==content:
        print('Already installed:',p.relative_to(ROOT));continue
    dest=backup/p.relative_to(ROOT);dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(p,dest)
    p.write_text(new,encoding='utf-8')
    print('Updated:',p.relative_to(ROOT))
print('Backup:',backup if backup.exists() else 'No changes needed')
print('Next: python manage.py check; restart runserver; Ctrl+F5')
