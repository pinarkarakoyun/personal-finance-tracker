const API = '/api';

const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const authMessage = document.getElementById('auth-message');
const userName = document.getElementById('user-name');

function getToken() {
  return localStorage.getItem('token');
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(API + path, { ...options, headers });
  const data = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    if (response.status === 401 && token) {
      logout();
    }
    throw new Error((data && data.message) || 'Bir hata oluştu');
  }
  return data;
}

function showApp(user) {
  userName.textContent = user.FullName;
  authSection.hidden = true;
  appSection.hidden = false;
}

function showAuth() {
  authSection.hidden = false;
  appSection.hidden = true;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showAuth();
}

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  authMessage.textContent = '';

  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value,
      }),
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    event.target.reset();
    showApp(data.user);
  } catch (err) {
    authMessage.textContent = err.message;
  }
});

document.getElementById('register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  authMessage.textContent = '';

  try {
    await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: document.getElementById('register-name').value,
        email: document.getElementById('register-email').value,
        password: document.getElementById('register-password').value,
      }),
    });
    event.target.reset();
    authMessage.textContent = 'Kayıt başarılı, şimdi giriş yapabilirsin.';
  } catch (err) {
    authMessage.textContent = err.message;
  }
});

document.getElementById('logout-button').addEventListener('click', logout);

const savedUser = localStorage.getItem('user');
if (getToken() && savedUser) {
  showApp(JSON.parse(savedUser));
} else {
  showAuth();
}