from datetime import date
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from intelligence.ai_models import ArticleAnalysis, DailyReport
from intelligence.ollama_pipeline import report_markdown

class Command(BaseCommand):
    help = 'Build sourced daily OSINT draft from saved article analyses'
    def add_arguments(self, parser):
        parser.add_argument('--date', default='')
    def handle(self, *args, **opts):
        try: day = date.fromisoformat(opts['date']) if opts['date'] else timezone.localdate()
        except ValueError: raise CommandError('Use --date YYYY-MM-DD')
        analyses = list(ArticleAnalysis.objects.select_related('article', 'article__source').filter(article__collected_at__date=day).order_by('category','article_id')[:500])
        if not analyses: raise CommandError('No analyzed articles for this date. Run analyze_osint first.')
        report = DailyReport.objects.create(report_date=day, title=f'Ban tin OSINT {day}', body=report_markdown(day, analyses), article_count=len(analyses), model_name='local-ollama / extractive')
        self.stdout.write(self.style.SUCCESS(f'Report #{report.pk} created with {len(analyses)} articles'))
