import axios from "axios";

// Общий инстанс axios для всех запросов к бэкенду
const api = axios.create({
  baseURL: "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Эндпоинты, где 401/400 означает «неверный пароль», а не «токен протух».
// На них не разлогиниваем пользователя.
const AUTH_EXCEPTIONS = ["/auth/login", "/auth/change-password"];

// Перед каждым запросом подставляем JWT, если он есть
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = error.response?.data?.error;

    // Приводим ошибку API к единому виду: message + details (в т.ч. details.fields)
    if (apiError) {
      error.message = apiError.message || error.message;
      error.details = apiError.details;
    }

    const status = error.response?.status;
    const url = error.config?.url || "";
    const isException = AUTH_EXCEPTIONS.some((path) => url.includes(path));

    // Токен недействителен: чистим хранилище и отправляем на страницу входа
    if (status === 401 && !isException) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    return Promise.reject(error);
  }
);

export default api;