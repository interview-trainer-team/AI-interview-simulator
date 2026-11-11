import api from "./axios";

// Пока бэкенд не готов, работаем на моках (как в api/auth.js и api/interview.js)
const USE_MOCK = true;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MOCK_PASSWORD_KEY = "mockPassword";
export const MOCK_CURRENT_PASSWORD = "12345678";

function getMockPassword() {
  return localStorage.getItem(MOCK_PASSWORD_KEY) || MOCK_CURRENT_PASSWORD;
}

function createApiError(message, fields) {
  const error = new Error(message);
  if (fields) error.details = { fields };
  return error;
}

// ФИО: обязательное, 2–100 символов после обрезки пробелов
export function validateFullName(fullName) {
  const value = String(fullName || "").trim();
  if (value.length < 2 || value.length > 100) {
    return "Укажи ФИО от 2 до 100 символов";
  }
  return "";
}

// Имя пользователя: 3–30 символов, только латиница, цифры и _
export function validateUsername(username) {
  const value = String(username || "").trim();
  if (value.length < 3 || value.length > 30) {
    return "Имя пользователя — от 3 до 30 символов";
  }
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    return "Только латинские буквы, цифры и нижнее подчёркивание";
  }
  return "";
}

// Смена пароля: FR-5.1.4, совпадение повтора и отличие от текущего
export function validatePasswordChange({ currentPassword, newPassword, repeatPassword }) {
  if (!String(currentPassword || "").trim()) {
    return { field: "currentPassword", message: "Укажи текущий пароль" };
  }
  if (!newPassword) {
    return { field: "newPassword", message: "Укажи новый пароль" };
  }
  if (newPassword.length < 8 || newPassword.length > 30) {
    return { field: "newPassword", message: "Пароль должен быть от 8 до 30 символов" };
  }
  if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return { field: "newPassword", message: "Нужны заглавная и строчная латинские буквы и цифра" };
  }
  if (newPassword === currentPassword) {
    return { field: "newPassword", message: "Новый пароль не должен совпадать с текущим" };
  }
  if (newPassword !== repeatPassword) {
    return { field: "repeatPassword", message: "Пароли не совпадают" };
  }
  return { field: "", message: "" };
}

// ---------- ЗАПРОСЫ ----------
// Форматы предварительные: реальные пути уточнить, когда утвердят API

// Обновление ФИО -> { fullName }
// Реальный путь (предположение): PATCH /users/me
export const updateFullNameRequest = async ({ fullName }) => {
  const message = validateFullName(fullName);
  if (message) throw createApiError(message, { fullName: message });

  if (USE_MOCK) {
    await delay(600);
    return { fullName: fullName.trim() };
  }

  const response = await api.patch("/users/me", { fullName: fullName.trim() });
  return response.data;
};

// Обновление имени пользователя -> { username }
// Реальный путь (предположение): PATCH /users/me
export const updateUsernameRequest = async ({ username }) => {
  const message = validateUsername(username);
  if (message) throw createApiError(message, { username: message });

  if (USE_MOCK) {
    await delay(600);
    return { username: username.trim() };
  }

  const response = await api.patch("/users/me", { username: username.trim() });
  return response.data;
};

// Смена пароля -> { ok: true }
// Реальный путь (предположение): POST /users/me/change-password
export const changePasswordRequest = async ({ currentPassword, newPassword }) => {
  if (USE_MOCK) {
    await delay(600);
    if (currentPassword !== getMockPassword()) {
      throw createApiError("Текущий пароль указан неверно", { currentPassword: "Текущий пароль указан неверно" });
    }
    localStorage.setItem(MOCK_PASSWORD_KEY, newPassword);
    return { ok: true };
  }

  const response = await api.post("/users/me/change-password", { currentPassword, newPassword });
  return response.data;
};