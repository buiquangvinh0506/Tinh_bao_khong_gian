import json
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from .models import Article, ResearchCase, DecisionLog

@login_required
@require_GET
def inbox(request):
    articles = Article.objects.select_related('source').order_by('-collected_at')[:100]
    return JsonResponse({'items': [{'id': a.id, 'title': a.title, 'url': a.url,
        'source': a.source.name, 'summary': a.summary[:1000],
        'collected_at': a.collected_at.isoformat()} for a in articles]})

@login_required
@require_GET
def daily_brief(request):
    articles = Article.objects.select_related('source').order_by('-collected_at')[:30]
    return JsonResponse({'note': 'Danh sach tin, chua phai nhan dinh AI',
        'items': [{'id':a.id,'title':a.title,'source':a.source.name,'url':a.url} for a in articles]})

@login_required
@require_POST
def create_case(request):
    try:
        if len(request.body)>16384: raise ValueError('Payload too large')
        data=json.loads(request.body)
        article=Article.objects.get(pk=int(data['article_id']))
        title=str(data.get('title',article.title)).strip()[:250]
        if not title: raise ValueError('Title required')
        case=ResearchCase.objects.create(article=article,title=title,created_by=request.user)
        return JsonResponse({'id':case.id,'status':case.status},status=201)
    except (ValueError,KeyError,TypeError,Article.DoesNotExist,json.JSONDecodeError) as exc:
        return JsonResponse({'error':str(exc)},status=400)

@login_required
@require_POST
def decide(request, pk):
    if not request.user.is_staff: return JsonResponse({'error':'Staff permission required'},status=403)
    try:
        if len(request.body)>16384: raise ValueError('Payload too large')
        data=json.loads(request.body)
        status=data['status']; reason=str(data.get('reason','')).strip()
        if status not in dict(ResearchCase.STATUS): raise ValueError('Invalid status')
        if not reason or len(reason)>3000: raise ValueError('Reason required (max 3000)')
        with transaction.atomic():
            case=ResearchCase.objects.select_for_update().get(pk=pk)
            old=case.status; case.status=status; case.save(update_fields=['status','updated_at'])
            DecisionLog.objects.create(case=case,actor=request.user,previous_status=old,new_status=status,reason=reason)
        return JsonResponse({'id':case.id,'status':status})
    except ResearchCase.DoesNotExist:
        return JsonResponse({'error':'Not found'},status=404)
    except (ValueError,KeyError,TypeError,json.JSONDecodeError) as exc:
        return JsonResponse({'error':str(exc)},status=400)
