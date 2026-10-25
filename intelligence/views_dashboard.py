import csv
from datetime import timedelta
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.http import require_GET
from .models import Article, Source, ResearchCase, AgentRun, DecisionLog

@login_required
@require_GET
def dashboard(request):
    return render(request, 'intelligence/dashboard.html')

@login_required
@require_GET
def overview(request):
    cutoff = timezone.now()-timedelta(days=1)
    return JsonResponse({'articles':Article.objects.count(),'last24h':Article.objects.filter(collected_at__gte=cutoff).count(), 'sources':Source.objects.count(),'enabled_sources':Source.objects.filter(enabled=True).count(), 'cases':ResearchCase.objects.count(), 'pending':ResearchCase.objects.filter(status='pending').count(), 'review':ResearchCase.objects.filter(status='review').count(), 'last_run':list(AgentRun.objects.order_by('-started_at').values('started_at','finished_at','status','new_articles','errors')[:1])})

@login_required
@require_GET
def sources(request):
    return JsonResponse({'items':list(Source.objects.order_by('name').values('id','name','kind','feed_url','enabled','last_checked')[:500])})

@login_required
@require_GET
def cases(request):
    qs=ResearchCase.objects.select_related('article','article__source','created_by').order_by('-updated_at')
    status=request.GET.get('status','')
    if status in dict(ResearchCase.STATUS): qs=qs.filter(status=status)
    items=[{'id':c.pk,'title':c.title,'status':c.status,'notes':c.notes,'article_id':c.article_id,'source':c.article.source.name,'url':c.article.url,'created_by':c.created_by.username,'updated_at':c.updated_at.isoformat()} for c in qs[:200]]
    return JsonResponse({'items':items})

@login_required
@require_GET
def runs(request):
    return JsonResponse({'items':list(AgentRun.objects.order_by('-started_at').values('id','started_at','finished_at','status','new_articles','errors')[:50])})

@login_required
@require_GET
def decisions(request):
    qs=DecisionLog.objects.select_related('actor','case').order_by('-timestamp')[:100]
    return JsonResponse({'items':[{'id':x.id,'case':x.case.title,'actor':x.actor.username,'previous':x.previous_status,'status':x.new_status,'reason':x.reason,'timestamp':x.timestamp.isoformat()} for x in qs]})

@login_required
@require_GET
def export_articles(request):
    resp=HttpResponse(content_type='text/csv; charset=utf-8')
    resp['Content-Disposition']='attachment; filename="geoint_osint_articles.csv"'
    resp.write('\ufeff')
    writer=csv.writer(resp)
    writer.writerow(['id','title','source','url','published_at','collected_at','summary'])
    for a in Article.objects.select_related('source').order_by('-collected_at')[:10000].iterator():
        writer.writerow([a.pk,a.title,a.source.name,a.url,a.published_at,a.collected_at,a.summary])
    return resp
