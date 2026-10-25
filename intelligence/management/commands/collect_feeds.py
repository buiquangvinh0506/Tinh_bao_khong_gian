import ipaddress
import socket
from datetime import datetime, timezone
from urllib.parse import urlsplit
from urllib.request import Request, urlopen, build_opener, HTTPRedirectHandler
from xml.etree import ElementTree as ET
from email.utils import parsedate_to_datetime
from django.core.management.base import BaseCommand
from django.utils import timezone as djtz
from intelligence.models import Source, Article, AgentRun

MAX_BYTES=2_000_000
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None

def validate_url(url):
    u=urlsplit(url)
    if u.scheme!='https' or not u.hostname or u.username or u.password or u.port not in (None,443):
        raise ValueError('Only standard HTTPS feed URLs permitted')
    for family,_,_,_,sockaddr in socket.getaddrinfo(u.hostname,443,type=socket.SOCK_STREAM):
        ip=ipaddress.ip_address(sockaddr[0])
        if not ip.is_global: raise ValueError('Non-public destination blocked')

def get_xml(url):
    validate_url(url)
    req=Request(url,headers={'User-Agent':'GEOINT-Vinh-Research/1.0','Accept':'application/rss+xml, application/atom+xml, application/xml'})
    with build_opener(NoRedirect).open(req,timeout=12) as resp:
        if resp.status != 200: raise ValueError('Unexpected HTTP status')
        data=resp.read(MAX_BYTES+1)
        if len(data)>MAX_BYTES: raise ValueError('Feed too large')
    return ET.fromstring(data)

def parse(root):
    atom='{http://www.w3.org/2005/Atom}'
    items=root.findall('.//item')
    if items:
        for e in items:
            yield ((e.findtext('title') or '').strip(),(e.findtext('link') or '').strip(),(e.findtext('description') or '').strip(),e.findtext('pubDate'))
    else:
        for e in root.findall(f'.//{atom}entry'):
            link=next((x.get('href','') for x in e.findall(f'{atom}link') if x.get('rel','alternate')=='alternate'), '')
            if not link:
                link=next((x.get('href','') for x in e.findall(f'{atom}link')), '')
            yield ((e.findtext(f'{atom}title') or '').strip(),link.strip(),(e.findtext(f'{atom}summary') or '').strip(),e.findtext(f'{atom}updated'))

def pubdate(value):
    if not value:return None
    try:
        d=parsedate_to_datetime(value)
    except (ValueError,TypeError):
        try:d=datetime.fromisoformat(value.replace('Z','+00:00'))
        except ValueError:return None
    if d.tzinfo is None:d=d.replace(tzinfo=timezone.utc)
    return d

class Command(BaseCommand):
    help='Collect approved public RSS/Atom feeds (run from scheduler)'
    def handle(self,*args,**kwargs):
        run=AgentRun.objects.create(); errors=[]; count=0
        for source in Source.objects.filter(enabled=True):
            try:
                root=get_xml(source.feed_url)
                for title,url,summary,published in parse(root):
                    if not title or not url or len(url)>1500:continue
                    # Only store HTTPS article links; do not visit article URLs.
                    if urlsplit(url).scheme!='https':continue
                    _,created=Article.objects.get_or_create(url=url,defaults={'source':source,'title':title[:500], 'summary':summary[:4000], 'published_at':pubdate(published)})
                    count+=int(created)
                source.last_checked=djtz.now();source.save(update_fields=['last_checked'])
            except Exception as exc:
                errors.append(f'Source #{source.pk}: {type(exc).__name__}: {exc}')
        run.status='partial' if errors else 'success';run.errors='\n'.join(errors)[:10000]
        run.new_articles=count;run.finished_at=djtz.now();run.save()
        self.stdout.write(f'New articles: {count}; errors: {len(errors)}')
