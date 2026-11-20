import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute() {
  const { user, isCheckingAuth } = useAuth();

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D0D0D] text-gray-400">
        Загрузка…
      </div>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
