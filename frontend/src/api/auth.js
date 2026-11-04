export const loginRequest = async (email, password) => {
  await new Promise((resolve) => setTimeout(resolve, 1000)); 
  
  if (email === "test@itmo.ru" && password === "12345678") {
    // Убрали обертку data! Теперь LoginPage сразу получит user и token
    return { 
      user: { id: "6f1c2b0e-8a3d-4c1e-9d4f-2a7b5c9e1f30", email: email }, 
      token: "fake-jwt-token" 
    };
  } else {
    const error = new Error("Неверный email или пароль");
    throw error;
  }
  
  // Реальный запрос оставляем так (axios сам возвращает response, а мы берем .data)
  // const response = await api.post('/auth/login', { email, password });
  // return response.data;
};