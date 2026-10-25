from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET
from .ai_models import ArticleAnalysis, DailyReport, CATEGORIES

@login_required
@require_GET
def workspace(request):
    return render(request, 'intelligence/analysis_workspace.html')

@login_required
@require_GET
def classified_articles(request):
    category = request.GET.get('category','')
    qs = ArticleAnalysis.objects.select_related('article','article__source').order_by('-article__collected_at')
    if category and category in dict(CATEGORIES): qs = qs.filter(category=category)
    items = [{'id':x.article_id,'title':x.article.title,'url':x.article.url,'source':x.article.source.name,
              'collected_at':x.article.collected_at.isoformat(), 'category':x.category,
              'abstract':x.abstract,'limits':x.evidence_limits,'status':x.status} for x in qs[:500]]
    return JsonResponse({'items':items, 'categories':dict(CATEGORIES)})

@login_required
@require_GET
def reports(request):
    qs = DailyReport.objects.order_by('-created_at')[:30]
    return JsonResponse({'items':[{'id':x.pk,'title':x.title,'date':x.report_date.isoformat(),
        'count':x.article_count,'created_at':x.created_at.isoformat()} for x in qs]})

@login_required
@require_GET
def report_detail(request, pk):
    try: x = DailyReport.objects.get(pk=pk)
    except DailyReport.DoesNotExist: return JsonResponse({'error':'Not found'},status=404)
    return JsonResponse({'id':x.pk,'title':x.title,'body':x.body,'created_at':x.created_at.isoformat()})
