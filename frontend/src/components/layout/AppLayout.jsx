import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

// Заголовок в хлебных крошках для каждого раздела
function getPageTitle(pathname) {
  if (pathname === "/") return "Главная";
  if (pathname === "/interview/setup") return "Настройка интервью";
  if (pathname.endsWith("/results")) return "Результаты";
  if (pathname.startsWith("/interview")) return "Прохождение интервью";
  if (pathname.startsWith("/history")) return "История интервью";
  if (pathname.startsWith("/profile")) return "Мой профиль";
  return "";
}

// Общий каркас приватных страниц: сайдбар + шапка + контент страницы (Outlet)
function AppLayout() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen bg-[#1B1D1B] font-sans text-white">
      <Sidebar pathname={pathname} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={getPageTitle(pathname)} pathname={pathname} />

        <main className="flex-1 px-4 py-8 md:px-8 lg:px-12">
          <Outlet />
        </main>

        <footer className="px-4 pb-6 text-right text-[11px] text-gray-500 md:px-8 lg:px-12">
          ИИ-ТРЕНАЖЁР · {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}

export default AppLayout;