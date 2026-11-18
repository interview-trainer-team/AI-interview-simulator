import api from "./axios";

function createApiError(message, fields) {
  const error = new Error(message);
  if (fields) error.details = { fields };
  return error;
}

export function validateFullName(fullName) {
  const value = String(fullName || "").trim();
  if (value.length < 2 || value.length > 150) {
    return "Укажи ФИО от 2 до 150 символов";
  }
  return "";
}

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

export const updateFullNameRequest = async ({ fullName }) => {
  const message = validateFullName(fullName);
  if (message) throw createApiError(message, { fullName: message });

  const response = await api.patch("/users/me", { fullName: fullName.trim() });
  return response.data;
};

export const changePasswordRequest = async ({ currentPassword, newPassword }) => {
  const response = await api.put("/users/me/password", {
    currentPassword,
    newPassword,
  });
  return response.data;
};

export const deleteAccountRequest = async ({ password }) => {
  const response = await api.delete("/users/me", { data: { password } });
  return response.data;
};
