import sys, os
import unittest
import json

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
sys.path.insert(0, BASE_DIR)

from app import app, db, User, Business, Service, ServiceRequest, Review, Category, Favorite, PlatformSetting, Report

class LocalLinkAPITestCase(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()

    def tearDown(self):
        self.app_context.pop()

    def test_01_health_check(self):
        res = self.client.get('/api/health')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get('status'), 'ok')
        self.assertEqual(data.get('app'), 'LocalLink AI')

    def test_02_login_and_token(self):
        # Admin login
        res = self.client.post('/api/login', json={'email': 'admin@locallink.ai', 'password': 'Admin@123'})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('token', data)
        self.assertEqual(data['user']['role'], 'admin')

        # Business owner login
        res = self.client.post('/api/login', json={'email': 'owner@locallink.ai', 'password': 'Owner@123'})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['user']['role'], 'business')

        # Customer login
        res = self.client.post('/api/login', json={'email': 'customer@locallink.ai', 'password': 'User@123'})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['user']['role'], 'customer')

        # Invalid login
        res = self.client.post('/api/login', json={'email': 'customer@locallink.ai', 'password': 'WrongPassword!'})
        self.assertEqual(res.status_code, 401)

    def test_03_registration(self):
        email = f"new_test_user_{os.urandom(4).hex()}@example.com"
        res = self.client.post('/api/register', json={
            'name': 'Test Newbie',
            'email': email,
            'password': 'SecurePass@123',
            'role': 'customer',
            'phone': '+91 9988776655'
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertIn('token', data)
        self.assertEqual(data['user']['email'], email)

        # Duplicate registration fails
        res2 = self.client.post('/api/register', json={
            'name': 'Test Newbie',
            'email': email,
            'password': 'SecurePass@123',
            'role': 'customer'
        })
        self.assertEqual(res2.status_code, 409)

    def test_04_businesses_search_and_filters(self):
        # Search by query
        res = self.client.get('/api/businesses?q=laptop')
        self.assertEqual(res.status_code, 200)
        items = res.get_json()
        self.assertTrue(len(items) >= 1)
        self.assertTrue(any('Laptop' in b['name'] or 'laptop' in b['description'].lower() for b in items))

        # Filter by category
        res = self.client.get('/api/businesses?category=Electronics')
        self.assertEqual(res.status_code, 200)
        items = res.get_json()
        self.assertTrue(all(b['category'] == 'Electronics' for b in items))

        # Filter by verified
        res = self.client.get('/api/businesses?verified=true')
        self.assertEqual(res.status_code, 200)
        items = res.get_json()
        self.assertTrue(all(b['verified'] is True for b in items))

        # Filter by price range
        res = self.client.get('/api/businesses?max_price=200')
        self.assertEqual(res.status_code, 200)
        items = res.get_json()
        self.assertTrue(all(b['price_from'] <= 200 for b in items))

    def test_05_business_detail(self):
        res = self.client.get('/api/businesses/1')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['id'], 1)
        self.assertIn('services', data)
        self.assertIn('reviews', data)
        self.assertIn('working_hours', data)
        self.assertTrue(len(data['services']) > 0)

    def test_06_service_request_workflow(self):
        # 1. Customer creates request
        res = self.client.post('/api/requests', json={
            'customer_id': 3,
            'business_id': 1,
            'service_name': 'Screen & Display Replacement',
            'note': 'Cracked glass screen'
        })
        self.assertEqual(res.status_code, 201)
        req_id = res.get_json()['id']

        # 2. Owner fetches requests
        res = self.client.get('/api/requests?user_id=2&role=business')
        self.assertEqual(res.status_code, 200)
        reqs = res.get_json()
        self.assertTrue(any(r['id'] == req_id for r in reqs))

        # 3. Owner accepts request
        res = self.client.patch(f'/api/requests/{req_id}', json={'status': 'Accepted'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['status'], 'Accepted')

        # 4. Owner marks in progress
        res = self.client.patch(f'/api/requests/{req_id}', json={'status': 'In Progress'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['status'], 'In Progress')

        # 5. Owner marks completed
        res = self.client.patch(f'/api/requests/{req_id}', json={'status': 'Completed'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['status'], 'Completed')

    def test_07_reviews_and_owner_reply(self):
        # Post review
        res = self.client.post('/api/reviews', json={
            'customer_id': 3,
            'business_id': 1,
            'rating': 4,
            'comment': 'Good service overall, completed in a timely manner.'
        })
        self.assertEqual(res.status_code, 201)
        rev = res.get_json()['review']
        rev_id = rev['id']

        # Owner reply
        res = self.client.patch(f'/api/reviews/{rev_id}/reply', json={
            'reply': 'Thank you for your feedback! Glad we could help.'
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('Thank you', res.get_json()['review']['owner_reply'])

    def test_08_favorites_toggle(self):
        # Toggle on
        res = self.client.post('/api/favorites', json={'user_id': 3, 'business_id': 2})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json()['saved'])

        # Check in list
        res = self.client.get('/api/favorites?user_id=3')
        self.assertEqual(res.status_code, 200)
        favs = res.get_json()
        self.assertTrue(any(b['id'] == 2 for b in favs))

        # Toggle off
        res = self.client.post('/api/favorites', json={'user_id': 3, 'business_id': 2})
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.get_json()['saved'])

    def test_09_owner_services_crud(self):
        # Add service
        res = self.client.post('/api/owner/services', json={
            'business_id': 1,
            'name': 'Thermal Paste Replacement',
            'description': 'Arctic MX-4 compound application',
            'price': 499
        })
        self.assertEqual(res.status_code, 201)
        sid = res.get_json()['id']

        # Update service
        res = self.client.patch(f'/api/owner/services/{sid}', json={
            'price': 549,
            'available': False
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['price'], 549)
        self.assertFalse(res.get_json()['available'])

        # Delete service
        res = self.client.delete(f'/api/owner/services/{sid}')
        self.assertEqual(res.status_code, 200)

    def test_10_admin_operations(self):
        # Create a pending business to ensure test is fully self-contained
        create_res = self.client.post('/api/businesses', json={
            'owner_id': 2,
            'name': 'Pending Verification Test Biz',
            'category': 'Electronics',
            'price_from': 250
        })
        self.assertEqual(create_res.status_code, 201)
        created_bid = create_res.get_json()['id']

        # Overview
        res = self.client.get('/api/admin/overview')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('users', data)
        self.assertIn('businesses', data)
        self.assertIn('pending', data)

        # Pending businesses
        res = self.client.get('/api/admin/businesses/pending')
        self.assertEqual(res.status_code, 200)
        pending = res.get_json()
        self.assertTrue(any(b['id'] == created_bid for b in pending))

        # Verify business
        res = self.client.patch(f'/api/admin/businesses/{created_bid}/verify', json={'verified': True})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json()['verified'])

        # Categories CRUD
        cat_name = f"TestCategory_{os.urandom(3).hex()}"
        res = self.client.post('/api/categories', json={'name': cat_name})
        self.assertEqual(res.status_code, 201)

        res = self.client.delete(f'/api/categories/{cat_name}')
        self.assertEqual(res.status_code, 200)

        # Settings
        res = self.client.get('/api/admin/settings')
        self.assertEqual(res.status_code, 200)

        res = self.client.post('/api/admin/settings', json={'ai_matching': True, 'maintenance_mode': False})
        self.assertEqual(res.status_code, 200)

if __name__ == '__main__':
    unittest.main()
