from django.db import models

CATEGORIES = [
    ('vn', 'Thoi su Viet Nam'), ('world', 'Thoi su quoc te'),
    ('defense', 'Quoc phong va chinh sach'), ('geopolitics', 'Dia chinh tri'),
    ('economy', 'Kinh te'), ('technology', 'Khoa hoc va cong nghe'),
    ('geospatial', 'Vien tham va GIS'), ('other', 'Khac'),
]

class ArticleAnalysis(models.Model):
    article = models.OneToOneField('intelligence.Article', on_delete=models.CASCADE, related_name='ai_analysis')
    category = models.CharField(max_length=20, choices=CATEGORIES, default='other', db_index=True)
    abstract = models.TextField(blank=True)
    evidence_limits = models.TextField(blank=True)
    keywords = models.JSONField(default=list, blank=True)
    model_name = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=16, default='pending', db_index=True)
    error = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

class DailyReport(models.Model):
    report_date = models.DateField(db_index=True)
    title = models.CharField(max_length=250)
    body = models.TextField()
    article_count = models.PositiveIntegerField(default=0)
    model_name = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['-created_at']
