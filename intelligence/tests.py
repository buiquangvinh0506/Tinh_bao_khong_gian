from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from .models import Source,Article,ResearchCase,DecisionLog

class IntelligenceTests(TestCase):
    def setUp(self):
        User=get_user_model()
        self.user=User.objects.create_user(username='reader',password='testpass123')
        self.staff=User.objects.create_user(username='editor',password='testpass123',is_staff=True)
        self.source=Source.objects.create(name='Test',feed_url='https://example.org/rss')
        self.article=Article.objects.create(source=self.source,url='https://example.org/a',title='Sample')
    def test_inbox_requires_login(self):
        self.assertEqual(self.client.get(reverse('intelligence_inbox')).status_code,302)
    def test_case_and_staff_decision(self):
        self.client.force_login(self.user)
        response=self.client.post(reverse('intelligence_create_case'),data='{"article_id":%d}'%self.article.id,content_type='application/json')
        self.assertEqual(response.status_code,201)
        pk=response.json()['id']
        self.assertEqual(self.client.post(reverse('intelligence_decide',args=[pk]),data='{"status":"approved","reason":"Verified"}',content_type='application/json').status_code,403)
        self.client.force_login(self.staff)
        response=self.client.post(reverse('intelligence_decide',args=[pk]),data='{"status":"approved","reason":"Verified"}',content_type='application/json')
        self.assertEqual(response.status_code,200)
        self.assertEqual(DecisionLog.objects.filter(case_id=pk).count(),1)
