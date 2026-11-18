import { createContext, useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMeRequest, logoutRequest } from "@/api/auth";

const AuthContext = createContext(null);

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

function clearSession() {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSavedUser);
  const [isCheckingAuth, setIsCheckingAuth] = useState(
    () => !!localStorage.getItem("token")
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      clearSession();
      setUser(null);
      return;
    }

    getMeRequest()
      .then((data) => {
        setUser(data);
        localStorage.setItem("user", JSON.stringify(data));
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

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const updateToken = (accessToken) => {
    localStorage.setItem("token", accessToken);
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } catch {
      // ignore
    } finally {
      clearSession();
      setUser(null);
      navigate("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, isCheckingAuth, login, logout, updateUser, updateToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
