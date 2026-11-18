/**
 * API-слой профиля пользователя.
 * Все запросы требуют Bearer-токен.
 */
import api from "./axios";

function createApiError(message, fields) {
  const error = new Error(message);
  if (fields) error.details = { fields };
  return error;
}

/**
 * Валидация ФИО: 2–150 символов после trim.
 * @param {string} fullName
 * @returns {string} сообщение об ошибке или пустая строка
 */
export function validateFullName(fullName) {
  const value = String(fullName || "").trim();
  if (value.length < 2 || value.length > 150) {
    return "Укажи ФИО от 2 до 150 символов";
  }
  return "";
}

/**
 * Валидация смены пароля (клиентская).
 * @param {{currentPassword: string, newPassword: string, repeatPassword: string}} params
 * @returns {{field: string, message: string}} пустой field/месседж если всё ок
 */
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

/**
 * Обновляет ФИО текущего пользователя.
 * @param {{fullName: string}} params
 * @returns {Promise<object>} актуальный объект пользователя
 */
export const updateFullNameRequest = async ({ fullName }) => {
  const message = validateFullName(fullName);
  if (message) throw createApiError(message, { fullName: message });

  const response = await api.patch("/users/me", { fullName: fullName.trim() });
  return response.data;
};

/**
 * Меняет пароль. В ответе приходит новый accessToken.
 * @param {{currentPassword: string, newPassword: string}} params
 * @returns {Promise<{accessToken: string}>}
 */
export const changePasswordRequest = async ({ currentPassword, newPassword }) => {
  const response = await api.put("/users/me/password", {
    currentPassword,
    newPassword,
  });
  return response.data;
};

/**
 * Удаляет аккаунт (требует подтверждение паролем).
 * @param {{password: string}} params
 * @returns {Promise<void>}
 */
export const deleteAccountRequest = async ({ password }) => {
  const response = await api.delete("/users/me", { data: { password } });
  return response.data;
};
