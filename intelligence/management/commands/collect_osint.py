"""Public OSINT collector: RSS/Atom plus explicitly configured public HTML pages."""
from html.parser import HTMLParser
from urllib.parse import urlsplit
from urllib.request import Request, build_opener
from django.core.management.base import BaseCommand
from django.utils import timezone
from intelligence.models import Source, Article, AgentRun
from .collect_feeds import get_xml, parse, pubdate, validate_url, NoRedirect, MAX_BYTES

class PageText(HTMLParser):
    def __init__(self):
        super().__init__(); self.title=[]; self.body=[]; self.skip=0; self.in_title=False
    def handle_starttag(self, tag, attrs):
        if tag in ('script','style','noscript'): self.skip+=1
        if tag=='title': self.in_title=True
    def handle_endtag(self, tag):
        if tag in ('script','style','noscript'): self.skip=max(0,self.skip-1)
        if tag=='title': self.in_title=False
    def handle_data(self, data):
        if self.skip: return
        if self.in_title: self.title.append(data)
        elif data.strip(): self.body.append(data.strip())

def get_page(url):
    validate_url(url)
    req=Request(url, headers={'User-Agent':'GEOINT-Vinh-Public-Research/1.0', 'Accept':'text/html'})
    with build_opener(NoRedirect).open(req,timeout=12) as resp:
        ctype=resp.headers.get('Content-Type','').lower()
        if 'text/html' not in ctype: raise ValueError('Expected HTML page')
        data=resp.read(MAX_BYTES+1)
        if len(data)>MAX_BYTES: raise ValueError('Page too large')
    parser=PageText(); parser.feed(data.decode('utf-8',errors='replace'))
    return ' '.join(parser.title).strip()[:500], ' '.join(parser.body).strip()[:4000]

class Command(BaseCommand):
    help='Collect explicitly approved RSS/Atom feeds and public HTML pages'
    def handle(self,*args,**kwargs):
        run=AgentRun.objects.create(); errors=[]; count=0
        for source in Source.objects.filter(enabled=True):
            try:
                if source.kind=='html':
                    title, summary=get_page(source.feed_url)
                    if title:
                        article,created=Article.objects.get_or_create(url=source.feed_url,defaults={'source':source,'title':title,'summary':summary})
                        if not created and (article.title != title or article.summary != summary):
                            article.title=title; article.summary=summary; article.save(update_fields=['title','summary'])
                        count+=int(created)
                else:
                    for title,url,summary,published in parse(get_xml(source.feed_url)):
                        if not title or not url or len(url)>1500 or urlsplit(url).scheme!='https': continue
                        _,created=Article.objects.get_or_create(url=url,defaults={'source':source,'title':title[:500], 'summary':summary[:4000], 'published_at':pubdate(published)})
                        count+=int(created)
                source.last_checked=timezone.now(); source.save(update_fields=['last_checked'])
            except Exception as exc:
                errors.append(f'Source #{source.pk}: {type(exc).__name__}: {exc}')
        run.status='partial' if errors else 'success'; run.errors='\n'.join(errors)[:10000]
        run.new_articles=count; run.finished_at=timezone.now(); run.save()
        self.stdout.write(f'New items: {count}; errors: {len(errors)}')
