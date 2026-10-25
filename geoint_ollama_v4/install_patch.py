"""Run from GEOINT_Vinh project root: python path/to/install_patch.py"""
from pathlib import Path
import shutil
import sys
from datetime import datetime

root = Path.cwd()
package = Path(__file__).resolve().parent
if not (root / 'manage.py').is_file() or not (root / 'intelligence/models.py').is_file():
    sys.exit('ERROR: Run from Django project root containing manage.py and intelligence/models.py')

models = root / 'intelligence/models.py'
urls = root / 'intelligence/urls.py'
dashboard = root / 'intelligence/templates/intelligence/dashboard.html'
if not urls.exists() or not dashboard.exists():
    sys.exit('ERROR: v3 intelligence/urls.py and dashboard.html are required')

stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
backup = root / f'backup_intelligence_v4_{stamp}'
for original in (models, urls, dashboard):
    dest = backup / original.relative_to(root)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(original, dest)

for relative in (
    'intelligence/ai_models.py', 'intelligence/ollama_pipeline.py',
    'intelligence/views_analysis.py',
    'intelligence/management/commands/analyze_osint.py',
    'intelligence/management/commands/build_osint_report.py',
    'intelligence/templates/intelligence/analysis_workspace.html',
):
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(package / relative, target)

model_text = models.read_text(encoding='utf-8')
line = '\n# GEOINT v4 local Ollama models\nfrom .ai_models import ArticleAnalysis, DailyReport\n'
if 'from .ai_models import ArticleAnalysis, DailyReport' not in model_text:
    models.write_text(model_text + line, encoding='utf-8')

url_text = urls.read_text(encoding='utf-8')
if 'views_analysis' not in url_text:
    url_text = 'from . import views_analysis as analysis_ui\n' + url_text
if 'analysis/workspace/' not in url_text:
    insertion = '''    path('analysis/workspace/', analysis_ui.workspace, name='intelligence_analysis_workspace'),
    path('analysis/articles/', analysis_ui.classified_articles, name='intelligence_analysis_articles'),
    path('analysis/reports/', analysis_ui.reports, name='intelligence_analysis_reports'),
    path('analysis/reports/<int:pk>/', analysis_ui.report_detail, name='intelligence_analysis_report_detail'),
'''
    url_text = url_text.replace('urlpatterns = [', 'urlpatterns = [\n' + insertion, 1)
urls.write_text(url_text, encoding='utf-8')

html = dashboard.read_text(encoding='utf-8')
link = '<a href="/api/intelligence/analysis/workspace/" style="display:inline-block;padding:10px 14px;background:#15547a;color:#eaf8ff;border:1px solid #3e8fb7;border-radius:8px;text-decoration:none;margin:0 0 12px">🧠 Phân loại & Báo cáo AI (Ollama)</a>'
if '/api/intelligence/analysis/workspace/' not in html:
    if '<main>' in html:
        html = html.replace('<main>', '<main>' + link, 1)
    else:
        sys.exit('ERROR: Dashboard markup does not contain <main>')
    dashboard.write_text(html, encoding='utf-8')
print('Patch installed. Backup:', backup)
print('Next: python manage.py check')
print('Then: python manage.py makemigrations intelligence && python manage.py migrate')
