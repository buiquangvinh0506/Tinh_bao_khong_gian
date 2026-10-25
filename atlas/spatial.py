"""PostGIS spatial queries. Coordinates are EPSG:4326 (lon, lat).

Django's standard PostgreSQL backend is deliberately retained so the existing
Windows installation does not require a local GDAL/GEOS runtime yet.
"""
import math
from django.db import connection


def numeric(raw, name, low, high):
    try:
        n = float(raw)
    except (TypeError, ValueError, OverflowError) as exc:
        raise ValueError(f'{name} phai la so') from exc
    if not math.isfinite(n) or not low <= n <= high:
        raise ValueError(f'{name} phai trong [{low}, {high}]')
    return n


def bbox_query(west, south, east, north, limit=1000):
    west = numeric(west, 'west', -180, 180)
    east = numeric(east, 'east', -180, 180)
    south = numeric(south, 'south', -90, 90)
    north = numeric(north, 'north', -90, 90)
    if south > north:
        raise ValueError('south khong duoc lon hon north')
    # The two-envelope case handles crossing the antimeridian.
    if west <= east:
        predicate = 'geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)'
        params = [west, south, east, north]
    else:
        predicate = """(geom && ST_MakeEnvelope(%s, %s, 180, %s, 4326)
                     OR geom && ST_MakeEnvelope(-180, %s, %s, %s, 4326))"""
        params = [west, south, north, south, east, north]
    sql = f"""SELECT id, name, category, latitude, longitude, source_url
              FROM atlas_place WHERE {predicate}
              ORDER BY id DESC LIMIT %s"""
    with connection.cursor() as cur:
        cur.execute(sql, [*params, limit])
        rows = cur.fetchall()
    return [dict(zip(('id','name','category','latitude','longitude','source_url'), row)) for row in rows]


def nearby_query(longitude, latitude, radius_m, limit=100):
    longitude = numeric(longitude, 'longitude', -180, 180)
    latitude = numeric(latitude, 'latitude', -90, 90)
    radius_m = numeric(radius_m, 'radius_m', 1, 500000)
    sql = """SELECT id, name, category, latitude, longitude,
                    ST_Distance(geom::geography,
                      ST_SetSRID(ST_MakePoint(%s, %s),4326)::geography) AS distance_m
             FROM atlas_place
             WHERE ST_DWithin(geom::geography,
                   ST_SetSRID(ST_MakePoint(%s, %s),4326)::geography, %s)
             ORDER BY distance_m ASC, id ASC LIMIT %s"""
    with connection.cursor() as cur:
        cur.execute(sql, [longitude, latitude, longitude, latitude, radius_m, limit])
        rows = cur.fetchall()
    return [dict(zip(('id','name','category','latitude','longitude','distance_m'), row)) for row in rows]


def status():
    with connection.cursor() as cur:
        cur.execute('SELECT PostGIS_Version()')
        version = cur.fetchone()[0]
        cur.execute("SELECT count(*), count(geom) FROM atlas_place")
        total, with_geom = cur.fetchone()
    return {'postgis_version': version, 'places': total, 'places_with_geometry': with_geom, 'srid': 4326}
