import csv
from pathlib import Path
from urllib.parse import urlsplit
from django.core.management.base import BaseCommand, CommandError
from intelligence.models import Source

class Command(BaseCommand):
    help = 'Import reviewed public OSINT source metadata from a UTF-8 CSV file.'

    def add_arguments(self, parser):
        parser.add_argument('csv_path')
        parser.add_argument('--apply', action='store_true', help='Write changes; otherwise preview only')
        parser.add_argument('--enable-rss', action='store_true', help='Enable RSS entries explicitly')

    def handle(self, *args, **options):
        path = Path(options['csv_path'])
        if not path.is_file():
            raise CommandError(f'CSV not found: {path}')
        created = updated = skipped = 0
        with path.open('r', encoding='utf-8-sig', newline='') as handle:
            reader = csv.DictReader(handle)
            required = {'name', 'kind', 'url', 'enabled'}
            if not required.issubset(set(reader.fieldnames or [])):
                raise CommandError(f'CSV needs columns: {sorted(required)}')
            for line, row in enumerate(reader, start=2):
                name = (row.get('name') or '').strip()
                kind = (row.get('kind') or '').strip().lower()
                url = (row.get('url') or '').strip()
                parsed = urlsplit(url)
                if not name or len(name) > 160 or kind not in ('rss', 'html') or parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
                    self.stderr.write(f'Line {line}: invalid row, skipped')
                    skipped += 1
                    continue
                # HTML entries are references for manual review, not continuous crawlers.
                enable = kind == 'rss' and options['enable_rss'] and (row.get('enabled') or '').strip().lower() in ('1', 'true', 'yes')
                self.stdout.write(f'{"APPLY" if options["apply"] else "PREVIEW"}: {kind:4} enabled={enable} {name} -> {url}')
                if not options['apply']:
                    continue
                obj, was_created = Source.objects.get_or_create(feed_url=url, defaults={'name': name, 'kind': kind, 'enabled': enable})
                if was_created:
                    created += 1
                else:
                    # Preserve user's existing enabled setting and edited metadata.
                    updated += 1
        self.stdout.write(self.style.SUCCESS(f'Created={created}; existing={updated}; skipped={skipped}; apply={options["apply"]}'))
