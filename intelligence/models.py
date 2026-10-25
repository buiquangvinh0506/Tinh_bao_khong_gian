from django.conf import settings
from django.db import models

class Source(models.Model):
    kind = models.CharField(max_length=12, choices=[("rss", "RSS / Atom"), ("html", "Public HTML page")], default="rss")
    name = models.CharField(max_length=160)
    feed_url = models.URLField(unique=True)
    enabled = models.BooleanField(default=False)
    last_checked = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self): return self.name

class Article(models.Model):
    source = models.ForeignKey(Source, on_delete=models.PROTECT, related_name='articles')
    url = models.URLField(max_length=1500, unique=True)
    title = models.CharField(max_length=500)
    summary = models.TextField(blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    collected_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['-collected_at']

class ResearchCase(models.Model):
    STATUS = [('pending','Cho xem'),('review','Can kiem chung'),('approved','Da duyet'),('rejected','Bac bo')]
    title = models.CharField(max_length=250)
    notes = models.TextField(blank=True)
    article = models.ForeignKey(Article, on_delete=models.PROTECT, related_name='cases')
    status = models.CharField(max_length=12, choices=STATUS, default='pending')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='research_cases')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class DecisionLog(models.Model):
    case = models.ForeignKey(ResearchCase, on_delete=models.PROTECT, related_name='decisions')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    previous_status = models.CharField(max_length=12)
    new_status = models.CharField(max_length=12)
    reason = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['-timestamp']

class AgentRun(models.Model):
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, default='running')
    new_articles = models.PositiveIntegerField(default=0)
    errors = models.TextField(blank=True)

# GEOINT v4 local Ollama models
from .ai_models import ArticleAnalysis, DailyReport
