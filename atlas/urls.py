from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='home'),
    path('api/places/', views.places, name='places'),
    path('api/places/geojson/', views.export_geojson, name='export_geojson'),
    path('api/places/import/', views.import_geojson, name='import_geojson'),
    path('api/places/<int:pk>/', views.place_detail, name='place_detail'),
    path('api/activity/', views.activity, name='activity'),
    path('api/models/', views.models_collection, name='models_collection'),
    path('api/models/<int:pk>/', views.model_detail, name='model_detail'),
]
