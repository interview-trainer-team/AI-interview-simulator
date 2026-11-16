from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()

class AuthAPITests(APITestCase):
    def setUp(self):
        self.register_url = '/api/auth/register'
        self.login_url = '/api/auth/login'
        self.me_url = '/api/users/me'
        self.logout_url = '/api/auth/logout'
        self.user_data = {
            "email": "test@example.com",
            "password": "StrongPass1",
            "fullName": "Иван Иванов"
        }

    def test_register_success(self):
        response = self.client.post(self.register_url, self.user_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('user', response.data)
        self.assertNotIn('accessToken', response.data)

    def test_register_duplicate_email(self):
        self.client.post(self.register_url, self.user_data)
        response = self.client.post(self.register_url, self.user_data)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['error']['code'], 'EMAIL_ALREADY_EXISTS')

    def test_register_weak_password(self):
        data = self.user_data.copy()
        data['password'] = 'weak'
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_success(self):
        self.client.post(self.register_url, self.user_data)
        response = self.client.post(self.login_url, {"email": self.user_data["email"], "password": self.user_data["password"]})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('accessToken', response.data)

    def test_login_wrong_password_or_email(self):
        self.client.post(self.register_url, self.user_data)
        # Неверный пароль
        res1 = self.client.post(self.login_url, {"email": self.user_data["email"], "password": "WrongPass1"})
        # Неверный email
        res2 = self.client.post(self.login_url, {"email": "no@mail.com", "password": "StrongPass1"})
        
        self.assertEqual(res1.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res2.status_code, status.HTTP_401_UNAUTHORIZED)
        # Проверка, что ответы одинаковые
        self.assertEqual(res1.data, res2.data)

    def test_me_and_logout_flow(self):
        self.client.post(self.register_url, self.user_data)
        login_res = self.client.post(self.login_url, {"email": self.user_data["email"], "password": self.user_data["password"]})
        token = login_res.data['accessToken']
        
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        
        # /me success
        me_res = self.client.get(self.me_url)
        self.assertEqual(me_res.status_code, status.HTTP_200_OK)
        self.assertIn('createdAt', me_res.data)
        
        # logout
        logout_res = self.client.post(self.logout_url)
        self.assertEqual(logout_res.status_code, status.HTTP_204_NO_CONTENT)
        
        # /me after logout
        me_res2 = self.client.get(self.me_url)
        self.assertEqual(me_res2.status_code, status.HTTP_401_UNAUTHORIZED)