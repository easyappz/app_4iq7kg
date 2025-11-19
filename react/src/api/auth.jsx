import instance from './axios';

export function register(data) {
  return instance.post('/api/auth/register/', data);
}

export function login(data) {
  return instance.post('/api/auth/login/', data);
}

export function logout() {
  return instance.post('/api/auth/logout/');
}

export function getCurrentMember() {
  return instance.get('/api/auth/me/');
}
