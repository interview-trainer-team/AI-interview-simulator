from django.urls import reverse 
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

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
        # Создаем пользователя для тестов логина
        self.client.post(self.register_url, self.user_data, format='json')

    def test_register_success(self):
        data = {"email": "new@example.com", "password": "StrongPass1", "fullName": "Петр"}
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('user', response.data)
        self.assertNotIn('accessToken', response.data)
        self.assertTrue(response.data['user']['createdAt'].endswith('Z')) # Проверка Z

    def test_register_duplicate_email(self):
        response = self.client.post(self.register_url, self.user_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['error']['code'], 'EMAIL_ALREADY_EXISTS')
        self.assertEqual(response.data['error']['details'], {}) # Проверка пустого details

    def test_register_invalid_email_format(self):
        data = {"email": "abc", "password": "StrongPass1", "fullName": "Иван"}
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error']['code'], 'VALIDATION_ERROR')

    def test_register_weak_password(self):
        data = {"email": "weak@example.com", "password": "weak", "fullName": "Иван"}
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error']['code'], 'VALIDATION_ERROR')
        self.assertIn('password', response.data['error']['details']['fields'])

    def test_login_success(self):
        response = self.client.post(self.login_url, {"email": self.user_data["email"], "password": self.user_data["password"]}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('accessToken', response.data)

    def test_login_case_insensitive_email(self):
        # Проверка User@Example.com
        response = self.client.post(self.login_url, {"email": "Test@Example.com", "password": self.user_data["password"]}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('accessToken', response.data)

    def test_login_wrong_password_or_email(self):
        res1 = self.client.post(self.login_url, {"email": self.user_data["email"], "password": "WrongPass1"}, format='json')
        res2 = self.client.post(self.login_url, {"email": "no@mail.com", "password": "StrongPass1"}, format='json')
        
        self.assertEqual(res1.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res2.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res1.data['error']['code'], 'INVALID_CREDENTIALS')
        self.assertEqual(res1.data, res2.data)

    def test_login_inactive_user(self):
        user = User.objects.get_by_natural_key(self.user_data["email"])
        user.is_active = False
        user.save()
        response = self.client.post(self.login_url, {"email": self.user_data["email"], "password": self.user_data["password"]}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['error']['code'], 'INVALID_CREDENTIALS')

    def test_me_unauthorized(self):
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['error']['code'], 'UNAUTHORIZED')

    def test_token_invalid_after_password_change(self):
        login_res = self.client.post(self.login_url, {"email": self.user_data["email"], "password": self.user_data["password"]}, format='json')
        token = login_res.data['accessToken']
        
        user = User.objects.get_by_natural_key(self.user_data["email"])
        user.password_changed_at = timezone.now() + timedelta(seconds=5) # Меняем время в будущее
        user.save()

        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_and_reuse(self):
        login_res = self.client.post(self.login_url, {"email": self.user_data["email"], "password": self.user_data["password"]}, format='json')
        token = login_res.data['accessToken']
        
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        
        # 1. Успешный /me
        me_res = self.client.get(self.me_url)
        self.assertEqual(me_res.status_code, status.HTTP_200_OK)
        
        # 2. Logout
        logout_res = self.client.post(self.logout_url)
        self.assertEqual(logout_res.status_code, status.HTTP_204_NO_CONTENT)
        
        # 3. Повторный /me после logout
        me_res2 = self.client.get(self.me_url)
        self.assertEqual(me_res2.status_code, status.HTTP_401_UNAUTHORIZED)
        
        # 4. Повторный logout тем же токеном
        logout_res2 = self.client.post(self.logout_url)
        self.assertEqual(logout_res2.status_code, status.HTTP_401_UNAUTHORIZED)