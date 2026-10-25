from django.contrib import admin
from .models import Place, ActivityLog, ModelAsset


@admin.register(Place)
class PlaceAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'category', 'latitude', 'longitude', 'updated_at')
    list_filter = ('category',)
    search_fields = ('name', 'description', 'source_url')


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'action', 'place_name', 'place_id_ref')
    list_filter = ('action',)
    search_fields = ('place_name', 'detail')
    readonly_fields = ('action', 'place_id_ref', 'place_name', 'detail', 'timestamp')

    def has_add_permission(self, request):
        return False


@admin.register(ModelAsset)
class ModelAssetAdmin(admin.ModelAdmin):
    list_display = ('name', 'latitude', 'longitude', 'scale', 'created_at')
    search_fields = ('name',)
