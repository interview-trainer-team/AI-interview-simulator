import api from './axios';

export const loginRequest = async (email, password) => {
  // --- ЭТО МОК (ЗАГЛУШКА) ---
  // Имитируем задержку сети в 1 секунду
  await new Promise((resolve) => setTimeout(resolve, 1000)); 
  
  if (email === "test@itmo.ru" && password === "12345678") {
    return { data: { user: { id: 1, email: email }, token: "fake-jwt-token" } };
  } else {
    throw new Error("Неверный email или пароль");
  }
  
  // --- РЕАЛЬНЫЙ ЗАПРОС (КОГДА БУДЕТ БЭКЕНД) ---
  // const response = await api.post('/auth/login', { email, password });
  // return response.data;
};