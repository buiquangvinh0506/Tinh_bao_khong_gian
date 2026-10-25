
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Django Admin
    path("admin/", admin.site.urls),

    # GEOINT Vinh - WebGIS 3D hiện tại
    path("", include("atlas.urls")),

    # OSINT Intelligence Dashboard
    path("api/intelligence/", include("intelligence.urls")),
]

# Phục vụ tệp media trong môi trường phát triển
if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )
