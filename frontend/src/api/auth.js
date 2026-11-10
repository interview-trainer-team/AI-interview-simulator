import api from "./axios";

// Пока бэкенд не готов, работаем на моках.
// Когда API заработает, поменять на false: страницы трогать не нужно.
const USE_MOCK = true;

// Задержка для имитации сети
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Создаёт ошибку в том же формате, что и перехватчик axios
function createApiError(message, fields) {
  const error = new Error(message);
  if (fields) {
    error.details = { fields };
  }
  return error;
}

// Тестовый пользователь для мока (пароль соответствует FR-5.1.4)
const MOCK_USER = {
  id: "6f1c2b0e-8a3d-4c1e-9d4f-2a7b5c9e1f30",
  email: "test@itmo.ru",
  fullName: "Тестовый Пользователь",
  createdAt: "2026-11-01T10:00:00.000Z",
};
const MOCK_PASSWORD = "Secret123";

// POST /api/auth/login → 200 { user, accessToken }
export const loginRequest = async (email, password) => {
  if (USE_MOCK) {
    await delay(1000);
    if (email === MOCK_USER.email && password === MOCK_PASSWORD) {
      return { user: MOCK_USER, accessToken: "fake-jwt-token" };
    }
    throw createApiError("Неверный email или пароль");
  }

  const response = await api.post("/auth/login", { email, password });
  return response.data;
};

// POST /api/auth/register → 201 { user }
export const registerRequest = async (fullName, email, password) => {
  if (USE_MOCK) {
    await delay(800);
    if (email === MOCK_USER.email) {
      throw createApiError("Пользователь с таким email уже существует", {
        email: "Пользователь с таким email уже существует",
      });
    }
    return {
      user: {
        id: crypto.randomUUID(),
        email,
        fullName,
        createdAt: new Date().toISOString(),
      },
    };
  }

  const response = await api.post("/auth/register", { fullName, email, password });
  return response.data;
};

// POST /api/auth/logout (#17)
export const logoutRequest = async () => {
  if (USE_MOCK) {
    await delay(300);
    return;
  }

  await api.post("/auth/logout");
};

// GET /api/users/me (#15): проверка сохранённого токена
export const getMeRequest = async () => {
  if (USE_MOCK) {
    await delay(300);
    if (localStorage.getItem("token") === "fake-jwt-token") {
      return { user: MOCK_USER };
    }
    throw createApiError("Не авторизован");
  }

  const response = await api.get("/users/me");
  return response.data;
};