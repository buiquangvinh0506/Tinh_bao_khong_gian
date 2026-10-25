"""Local research atlas API. No external source polling or sensitive target tracking."""

import json
import math
import struct
import uuid
from urllib.parse import urlsplit
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_http_methods
from .models import ActivityLog, Place, ModelAsset

MAX_BODY_BYTES = 2_500_000
MAX_IMPORT_POINTS = 300


def index(request):
    return render(request, 'atlas/index.html')


def serialise(place):
    return {
        'id': place.id,
        'name': place.name,
        'description': place.description,
        'latitude': place.latitude,
        'longitude': place.longitude,
        'category': place.category,
        'source_url': place.source_url,
        'created_at': place.created_at.isoformat(),
        'updated_at': place.updated_at.isoformat() if place.updated_at else place.created_at.isoformat(),
    }


def read_json(request):
    if len(request.body) > MAX_BODY_BYTES:
        raise ValueError('Tep hoac noi dung vuot gioi han 2,5 MB')
    try:
        return json.loads(request.body.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError('JSON khong hop le') from error


def validate_place(payload, partial=False):
    if not isinstance(payload, dict):
        raise ValueError('Du lieu phai la doi tuong JSON')

    data = {}
    for key in ('name', 'description', 'latitude', 'longitude', 'category', 'source_url'):
        if partial and key not in payload:
            continue
        if key in ('name', 'description', 'category', 'source_url'):
            value = payload.get(key, 'research' if key == 'category' else '')
            if not isinstance(value, str):
                raise ValueError(f'{key} phai la chuoi')
            data[key] = value.strip()
        else:
            try:
                data[key] = float(payload[key])
            except (KeyError, ValueError, TypeError) as error:
                raise ValueError(f'{key} khong hop le') from error

    if 'name' in data and not (1 <= len(data['name']) <= 160):
        raise ValueError('Ten phai co tu 1 den 160 ky tu')
    if 'description' in data and len(data['description']) > 5000:
        raise ValueError('Mo ta toi da 5000 ky tu')
    if 'category' in data and data['category'] not in dict(Place.CATEGORY_CHOICES):
        raise ValueError('Loai dia diem khong duoc ho tro')
    if 'source_url' in data:
        uri = data['source_url']
        if len(uri) > 500 or (uri and urlsplit(uri).scheme not in ('http', 'https')) or (uri and not urlsplit(uri).netloc):
            raise ValueError('URL nguon phai la http/https hop le')
    if 'latitude' in data and (not math.isfinite(data['latitude']) or not -90 <= data['latitude'] <= 90):
        raise ValueError('Vi do phai nam trong [-90, 90]')
    if 'longitude' in data and (not math.isfinite(data['longitude']) or not -180 <= data['longitude'] <= 180):
        raise ValueError('Kinh do phai nam trong [-180, 180]')
    return data


def bad_request(error):
    return JsonResponse({'error': str(error)}, status=400)


@require_http_methods(['GET', 'POST'])
def places(request):
    if request.method == 'GET':
        qs = Place.objects.all()[:5000]
        return JsonResponse({'places': [serialise(p) for p in qs]})
    try:
        data = validate_place(read_json(request))
        with transaction.atomic():
            place = Place.objects.create(**data)
            ActivityLog.objects.create(action='created', place_id_ref=place.id, place_name=place.name)
    except ValueError as error:
        return bad_request(error)
    return JsonResponse(serialise(place), status=201)


@require_http_methods(['PATCH', 'DELETE'])
def place_detail(request, pk):
    place = Place.objects.filter(pk=pk).first()
    if place is None:
        return JsonResponse({'error': 'Khong tim thay dia diem'}, status=404)
    if request.method == 'DELETE':
        with transaction.atomic():
            ActivityLog.objects.create(action='deleted', place_id_ref=place.pk, place_name=place.name)
            place.delete()
        return JsonResponse({'ok': True})
    try:
        data = validate_place(read_json(request), partial=True)
        if not data:
            raise ValueError('Khong co truong nao de cap nhat')
        with transaction.atomic():
            changed = ', '.join(data.keys())
            for key, value in data.items():
                setattr(place, key, value)
            place.save()
            ActivityLog.objects.create(
                action='updated', place_id_ref=place.pk,
                place_name=place.name, detail=f'Truong: {changed}'
            )
    except ValueError as error:
        return bad_request(error)
    return JsonResponse(serialise(place))


@require_http_methods(['GET'])
def activity(request):
    entries = ActivityLog.objects.all()[:80]
    return JsonResponse({'events': [
        {'id': log.id, 'action': log.action, 'place_name': log.place_name,
         'place_id': log.place_id_ref, 'detail': log.detail,
         'timestamp': log.timestamp.isoformat()}
        for log in entries
    ]})


@require_http_methods(['GET'])
def export_geojson(request):
    features = []
    for p in Place.objects.all()[:5000]:
        features.append({
            'type': 'Feature',
            'id': p.id,
            'geometry': {'type': 'Point', 'coordinates': [p.longitude, p.latitude]},
            'properties': {
                'name': p.name, 'description': p.description,
                'category': p.category, 'source_url': p.source_url
            }
        })
    response = JsonResponse({'type': 'FeatureCollection', 'features': features},
                            json_dumps_params={'ensure_ascii': False})
    response['Content-Disposition'] = 'attachment; filename="geoint_places.geojson"'
    return response


@require_http_methods(['POST'])
def import_geojson(request):
    try:
        body = read_json(request)
        if not isinstance(body, dict) or body.get('type') != 'FeatureCollection':
            raise ValueError('Can tep GeoJSON FeatureCollection')
        features = body.get('features')
        if not isinstance(features, list) or len(features) > MAX_IMPORT_POINTS:
            raise ValueError('Toi da 300 doi tuong moi lan')
        valid_rows = []
        ignored = 0
        for position, f in enumerate(features, start=1):
            if not isinstance(f, dict) or f.get('type') != 'Feature':
                raise ValueError(f'Feature {position} khong hop le')
            geometry = f.get('geometry') or {}
            if not isinstance(geometry, dict):
                raise ValueError(f'Hinh hoc Feature {position} khong hop le')
            if geometry.get('type') != 'Point':
                ignored += 1
                continue
            coords = geometry.get('coordinates')
            if not isinstance(coords, list) or len(coords) < 2:
                raise ValueError(f'Toa do Feature {position} khong hop le')
            properties = f.get('properties') or {}
            if not isinstance(properties, dict):
                raise ValueError(f'Thuoc tinh Feature {position} khong hop le')
            row = {
                'name': properties.get('name') or f'Diem {position}',
                'description': properties.get('description', ''),
                'longitude': coords[0], 'latitude': coords[1],
                'category': properties.get('category', 'research'),
                'source_url': properties.get('source_url', ''),
            }
            valid_rows.append(validate_place(row))
        with transaction.atomic():
            for row in valid_rows:
                p = Place.objects.create(**row)
                ActivityLog.objects.create(action='imported', place_id_ref=p.pk, place_name=p.name)
        return JsonResponse({'imported': len(valid_rows), 'ignored': ignored})
    except ValueError as error:
        return bad_request(error)


# GLB files are developer-provided local assets. No remote URL fetching is performed.
MAX_GLB_SIZE = 500 * 1024 * 1024
MAX_MODELS = 100

def serialise_model(asset):
    return {
        'id': asset.pk, 'name': asset.name,
        'url': asset.file.url,
        'longitude': asset.longitude, 'latitude': asset.latitude,
        'height': asset.height, 'scale': asset.scale, 'heading': asset.heading,
        'source_url': asset.source_url, 'created_at': asset.created_at.isoformat(),
    }


@require_http_methods(['GET', 'POST'])
def models_collection(request):
    if request.method == 'GET':
        return JsonResponse({'models': [serialise_model(x) for x in ModelAsset.objects.all()[:MAX_MODELS]]})

    uploaded = request.FILES.get('model')
    if uploaded is None or not uploaded.name.lower().endswith('.glb'):
        return bad_request('Chi ho tro tep .glb')
    if uploaded.size < 20 or uploaded.size > MAX_GLB_SIZE:
        return bad_request('Tep GLB phai tu 20 byte den 500 MiB')
    header = uploaded.read(12)
    uploaded.seek(0)
    if (len(header) != 12 or header[:4] != b'glTF' or
            struct.unpack_from('<I', header, 4)[0] != 2 or
            struct.unpack_from('<I', header, 8)[0] != uploaded.size):
        return bad_request('GLB version 2 khong hop le (header/length)')
    if ModelAsset.objects.count() >= MAX_MODELS:
        return bad_request('Vuot gioi han 100 mo hinh')
    try:
        name = str(request.POST.get('name', '')).strip()
        if not 1 <= len(name) <= 160:
            raise ValueError('Ten mo hinh phai co tu 1 den 160 ky tu')
        def numeric(key, lower, upper, fallback=None):
            value = request.POST.get(key, fallback)
            try:
                n = float(value)
            except (ValueError, TypeError):
                raise ValueError(f'{key} khong hop le')
            if not math.isfinite(n) or not lower <= n <= upper:
                raise ValueError(f'{key} ngoai pham vi')
            return n
        latitude = numeric('latitude', -90, 90)
        longitude = numeric('longitude', -180, 180)
        height = numeric('height', -1000, 12000, 0)
        scale = numeric('scale', 0.001, 1000, 1)
        heading = numeric('heading', -360, 360, 0)
        source_url = request.POST.get('source_url', '').strip()
        validate_place({'name': name, 'latitude': latitude, 'longitude': longitude,
                        'source_url': source_url})
        # Use an opaque server-created filename rather than trusting client paths.
        uploaded.name = f'{uuid.uuid4().hex}.glb'
        with transaction.atomic():
            model = ModelAsset.objects.create(
                name=name, file=uploaded, latitude=latitude, longitude=longitude,
                height=height, scale=scale, heading=heading, source_url=source_url
            )
        return JsonResponse(serialise_model(model), status=201)
    except ValueError as error:
        return bad_request(error)


@require_http_methods(['DELETE'])
def model_detail(request, pk):
    instance = ModelAsset.objects.filter(pk=pk).first()
    if instance is None:
        return JsonResponse({'error': 'Khong tim thay mo hinh'}, status=404)
    # Delete database row first; remove file afterward.
    field = instance.file
    storage, name = field.storage, field.name
    instance.delete()
    storage.delete(name)
    return JsonResponse({'ok': True})


# ---------------- v0.7: spatial APIs backed by indexed PostGIS geometry ----------------
from . import spatial

@require_http_methods(['GET'])
def spatial_bbox(request):
    try:
        p = request.GET
        rows = spatial.bbox_query(p.get('west'), p.get('south'), p.get('east'), p.get('north'))
        return JsonResponse({'count': len(rows), 'places': rows})
    except ValueError as error:
        return bad_request(error)

@require_http_methods(['GET'])
def spatial_nearby(request):
    try:
        p = request.GET
        rows = spatial.nearby_query(p.get('longitude'), p.get('latitude'), p.get('radius_m', 5000))
        return JsonResponse({'count': len(rows), 'places': rows})
    except ValueError as error:
        return bad_request(error)

@require_http_methods(['GET'])
def spatial_status(request):
    try:
        return JsonResponse(spatial.status())
    except Exception:
        # Do not expose connection strings or SQL error details to the browser.
        return JsonResponse({'error': 'PostGIS chua san sang. Kiem tra migration 0004.'}, status=503)
