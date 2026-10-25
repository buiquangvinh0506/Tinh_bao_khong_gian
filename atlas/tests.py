import json
from django.test import TestCase
from .models import Place, ActivityLog


class AtlasApiTests(TestCase):
    def post(self, route, payload):
        return self.client.post(route, data=json.dumps(payload), content_type='application/json')

    def test_home(self):
        r = self.client.get('/')
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, 'GEOINT')

    def test_create_update_delete_and_journal(self):
        payload = {'name': 'Bao tang mau', 'description': 'Cong khai',
                   'latitude': 21.025, 'longitude': 105.85,
                   'category': 'heritage', 'source_url': 'https://example.org/a'}
        result = self.post('/api/places/', payload)
        self.assertEqual(result.status_code, 201)
        pid = result.json()['id']
        self.assertEqual(Place.objects.count(), 1)
        self.assertEqual(self.client.get('/api/places/').json()['places'][0]['category'], 'heritage')
        patch = self.client.patch(f'/api/places/{pid}/', data=json.dumps({'name': 'Ten moi'}), content_type='application/json')
        self.assertEqual(patch.status_code, 200)
        self.assertEqual(patch.json()['name'], 'Ten moi')
        self.assertEqual(self.client.delete(f'/api/places/{pid}/').status_code, 200)
        self.assertEqual(Place.objects.count(), 0)
        self.assertEqual(list(ActivityLog.objects.values_list('action',flat=True)), ['deleted', 'updated', 'created'])

    def test_invalid_coordinate_does_not_write(self):
        r = self.post('/api/places/', {'name':'Sai', 'latitude': 100, 'longitude': 105})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Place.objects.count(), 0)

    def test_geojson_import_export(self):
        data = {'type':'FeatureCollection','features':[
            {'type':'Feature','geometry': {'type':'Point','coordinates':[105.8,21.02]},
             'properties': {'name':'Cong vien','category':'civic'}},
            {'type':'Feature','geometry': {'type':'LineString','coordinates':[[0,0],[1,1]]},'properties':{}}
        ]}
        result = self.post('/api/places/import/', data)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json(), {'imported':1, 'ignored':1})
        export = self.client.get('/api/places/geojson/')
        self.assertEqual(export.status_code, 200)
        features = export.json()['features']
        self.assertEqual(features[0]['geometry']['coordinates'], [105.8,21.02])
        self.assertEqual(features[0]['properties']['category'], 'civic')

    def test_invalid_import_is_atomic(self):
        data = {'type':'FeatureCollection','features':[
            {'type':'Feature','geometry': {'type':'Point','coordinates':[105,21]},'properties':{'name':'Dung'}},
            {'type':'Feature','geometry': {'type':'Point','coordinates':[900,21]},'properties':{'name':'Sai'}}
        ]}
        self.assertEqual(self.post('/api/places/import/', data).status_code,400)
        self.assertEqual(Place.objects.count(), 0)
        self.assertEqual(ActivityLog.objects.count(), 0)

    def test_activity_endpoint(self):
        self.post('/api/places/', {'name':'Vi du','latitude':21,'longitude':105,'category':'research'})
        data = self.client.get('/api/activity/').json()
        self.assertEqual(data['events'][0]['action'], 'created')

class ModelAssetApiTests(TestCase):
    def test_upload_list_delete_and_invalid_glb(self):
        import tempfile
        from pathlib import Path
        from django.core.files.uploadedfile import SimpleUploadedFile
        from .models import ModelAsset
        sample = Path(__file__).resolve().parent.parent / 'samples' / 'cong_trinh_minh_hoa.glb'
        raw = sample.read_bytes()
        with tempfile.TemporaryDirectory() as directory, self.settings(MEDIA_ROOT=directory):
            bad = SimpleUploadedFile('bad.glb', b'not glTF' * 10)
            response = self.client.post('/api/models/', {'model': bad, 'name': 'Bad', 'latitude': 21,
                                                          'longitude': 105})
            self.assertEqual(response.status_code, 400)
            self.assertEqual(ModelAsset.objects.count(), 0)
            good = SimpleUploadedFile('building.glb', raw, content_type='model/gltf-binary')
            response = self.client.post('/api/models/', {'model': good, 'name': 'Mau', 'latitude': 21.02,
                'longitude': 105.85, 'height': 6, 'scale': 1.2, 'heading': 12})
            self.assertEqual(response.status_code, 201)
            pk = response.json()['id']
            self.assertTrue(response.json()['url'].startswith('/media/geoint_models/'))
            self.assertEqual(self.client.get('/api/models/').json()['models'][0]['name'], 'Mau')
            self.assertEqual(self.client.delete(f'/api/models/{pk}/').status_code, 200)
            self.assertEqual(ModelAsset.objects.count(), 0)
