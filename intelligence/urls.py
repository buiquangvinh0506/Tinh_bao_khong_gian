from . import views_analysis as analysis_ui
from django.urls import path
from . import views, views_dashboard as ui
urlpatterns = [
    path('analysis/workspace/', analysis_ui.workspace, name='intelligence_analysis_workspace'),
    path('analysis/articles/', analysis_ui.classified_articles, name='intelligence_analysis_articles'),
    path('analysis/reports/', analysis_ui.reports, name='intelligence_analysis_reports'),
    path('analysis/reports/<int:pk>/', analysis_ui.report_detail, name='intelligence_analysis_report_detail'),

    path('dashboard/',ui.dashboard,name='intelligence_dashboard'),
    path('overview/',ui.overview,name='intelligence_overview'),
    path('sources/',ui.sources,name='intelligence_sources'),
    path('cases/list/',ui.cases,name='intelligence_cases_list'),
    path('runs/',ui.runs,name='intelligence_runs'),
    path('decisions/',ui.decisions,name='intelligence_decisions'),
    path('export/articles.csv',ui.export_articles,name='intelligence_export'),
    path('inbox/',views.inbox,name='intelligence_inbox'),
    path('brief/',views.daily_brief,name='intelligence_brief'),
    path('cases/',views.create_case,name='intelligence_create_case'),
    path('cases/<int:pk>/decision/',views.decide,name='intelligence_decide'),
]
