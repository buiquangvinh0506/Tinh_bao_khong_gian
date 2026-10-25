from django.db import models


class Place(models.Model):
    CATEGORY_CHOICES = [
        ('civic', 'Cong trinh cong cong'),
        ('heritage', 'Di san va lich su'),
        ('transport', 'Giao thong'),
        ('environment', 'Moi truong'),
        ('research', 'Diem nghien cuu'),
        ('other', 'Khac'),
    ]
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='research')
    source_url = models.URLField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class ActivityLog(models.Model):
    ACTION_CHOICES = [
        ('created', 'Tao dia diem'),
        ('updated', 'Cap nhat dia diem'),
        ('deleted', 'Xoa dia diem'),
        ('imported', 'Nhap GeoJSON'),
    ]
    action = models.CharField(max_length=12, choices=ACTION_CHOICES)
    place_id_ref = models.PositiveBigIntegerField(null=True, blank=True)
    place_name = models.CharField(max_length=160)
    detail = models.CharField(max_length=300, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp', '-id']

    def __str__(self):
        return f'{self.action}: {self.place_name}'


class ModelAsset(models.Model):
    """Local GLB uploaded by the developer (not public cloud hosting)."""
    name = models.CharField(max_length=160)
    file = models.FileField(upload_to='geoint_models/%Y/%m/')
    longitude = models.FloatField()
    latitude = models.FloatField()
    height = models.FloatField(default=0)
    scale = models.FloatField(default=1)
    heading = models.FloatField(default=0)
    source_url = models.URLField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name
