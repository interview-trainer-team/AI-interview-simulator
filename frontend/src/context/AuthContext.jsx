import { createContext, useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMeRequest, logoutRequest } from "@/api/auth";

const AuthContext = createContext(null);

// Безопасно читаем пользователя из localStorage (битые данные просто удаляем)
function readSavedUser() {
  try {
    const savedUser = localStorage.getItem("user");
    if (savedUser && savedUser !== "undefined") {
      return JSON.parse(savedUser);
    }
  } catch {
    localStorage.removeItem("user");
  }
  return null;
}

// Полная очистка данных сессии
function clearSession() {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSavedUser);
  // true, пока проверяем сохранённый токен через GET /api/users/me
  const [isCheckingAuth, setIsCheckingAuth] = useState(
    () => !!localStorage.getItem("token")
  );
  const navigate = useNavigate();

  // При запуске приложения не верим localStorage, а спрашиваем бэкенд (#15)
  useEffect(() => {
    if (!localStorage.getItem("token")) {
      clearSession();
      setUser(null);
      return;
    }

    getMeRequest()
      .then((data) => {
        setUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
      })
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setIsCheckingAuth(false));
  }, []);

  const login = (userData, accessToken) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", accessToken);
    navigate("/");
  };

  // Выход (#17): сообщаем бэкенду, но токен чистим при любом ответе
  const logout = async () => {
    try {
      await logoutRequest();
    } catch {
      // Ошибку игнорируем: локально пользователь всё равно выходит
    } finally {
      clearSession();
      setUser(null);
      navigate("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, isCheckingAuth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}