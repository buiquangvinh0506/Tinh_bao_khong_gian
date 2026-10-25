from django.contrib import admin
from .models import Source, Article, ResearchCase, DecisionLog, AgentRun
@admin.register(Source)
class SourceAdmin(admin.ModelAdmin):
    list_display = ('name','kind','feed_url','enabled','last_checked')
    list_filter = ('kind','enabled',)
@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ('title','source','collected_at')
    search_fields = ('title','summary')
@admin.register(ResearchCase)
class ResearchCaseAdmin(admin.ModelAdmin):
    list_display = ('title','status','created_by','updated_at')
    list_filter = ('status',)
    readonly_fields = ('created_by',)
    def save_model(self, request, obj, form, change):
        if not change: obj.created_by = request.user
        super().save_model(request,obj,form,change)
@admin.register(DecisionLog)
class DecisionLogAdmin(admin.ModelAdmin):
    list_display = ('case','actor','new_status','timestamp')
    def has_add_permission(self,request): return False
    def has_change_permission(self,request,obj=None): return False
    def has_delete_permission(self,request,obj=None): return False
admin.site.register(AgentRun)
