from django.core.management.base import BaseCommand
from intelligence.models import Article
from intelligence.ollama_pipeline import analyze_article

class Command(BaseCommand):
    help = 'Classify and optionally summarize collected articles with local Ollama'
    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=20)
        parser.add_argument('--rules-only', action='store_true')
        parser.add_argument('--force', action='store_true')
    def handle(self, *args, **opts):
        limit = opts['limit']
        if not 1 <= limit <= 500: raise ValueError('limit must be 1..500')
        qs = Article.objects.select_related('source').order_by('-collected_at')
        if not opts['force']: qs = qs.filter(ai_analysis__isnull=True)
        done = failed = 0
        for article in qs[:limit]:
            obj = analyze_article(article, use_ai=not opts['rules_only'], force=opts['force'])
            done += 1
            failed += (obj.status == 'error')
            self.stdout.write(f'Article {article.pk}: {obj.category} / {obj.status}')
        self.stdout.write(self.style.SUCCESS(f'Processed={done}; AI errors={failed}'))
