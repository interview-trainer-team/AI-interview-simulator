import { NavLink, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

// Логотип: салатовый квадрат с облачком «</>»
export function LogoMark({ className = "" }) {
  return (
    <div className={`flex size-10 items-center justify-center rounded-lg bg-[#D2FF52] text-black ${className}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M10 8 7 11l3 3M14 14l3-3-3-3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12h15M14 6l6 6-6 6" />
    </svg>
  );
}

// Пункты меню. «Главная» активна и на экранах интервью, как в макете
export const navItems = [
  { to: "/", label: "Главная", Icon: ChatIcon, match: ["/", "/interview"] },
  { to: "/history", label: "История интервью", Icon: ClockIcon, match: ["/history"] },
];

// Активен ли пункт для текущего пути
export function isNavActive(item, pathname) {
  return item.match.some((path) =>
    path === "/" ? pathname === "/" || pathname.startsWith("/interview") : pathname.startsWith(path)
  );
}

function Sidebar({ pathname }) {
  const { logout } = useAuth();

  return (
    <aside className="hidden md:flex w-[156px] lg:w-[200px] shrink-0 flex-col border-r border-[#2A2D2A] bg-[#151715]">
      {/* Логотип */}
      <Link to="/" className="flex items-center gap-3 px-4 py-4">
        <LogoMark />
        <span className="text-sm font-extrabold tracking-wide text-white">ИИ-ТРЕНАЖЁР</span>
      </Link>

      {/* Меню */}
      <p className="mt-6 px-4 text-[10px] font-medium uppercase tracking-wider text-gray-400">Меню</p>
      <nav className="mt-3 space-y-1 border-b border-[#2A2D2A] px-3 pb-4">
        {navItems.map((item) => {
          const active = isNavActive(item, pathname);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`outline-none focus-visible:ring-2 focus-visible:ring-[#D2FF52]/50 relative flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${
                active ? "bg-[#262A26] font-semibold text-white" : "text-gray-400 hover:bg-[#1E211E] hover:text-white"
              }`}
            >
              {/* Салатовая полоска слева у активного пункта */}
              {active && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-[#D2FF52]" />}
              <span className={active ? "text-[#D2FF52]" : ""}>
                <item.Icon />
              </span>
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Низ: профиль и выход */}
      <div className="mt-auto border-t border-[#2A2D2A] px-4 py-4">
        <Link to="/profile" className="flex items-center gap-3 text-white">
          <UserIcon />
          <div>
            <p className="text-sm font-semibold leading-tight">Мой профиль</p>
            <p className="text-[11px] text-gray-400">Настройки аккаунта</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={logout}
          className="mt-4 flex items-center gap-3 text-xs text-gray-400 transition-colors hover:text-white"
        >
          <LogoutIcon />
          Выйти
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;