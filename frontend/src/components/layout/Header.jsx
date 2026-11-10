import { NavLink, Link } from "react-router-dom";
import { LogoMark, navItems, isNavActive } from "./Sidebar";

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function Header({ title, pathname }) {
  return (
    <header className="border-b border-[#2A2D2A] bg-[#151715]">
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-8">
        {/* На телефоне вместо сайдбара логотип */}
        <Link to="/" className="md:hidden">
          <LogoMark className="size-9" />
        </Link>

        {/* Хлебные крошки */}
        <p className="hidden min-w-0 truncate text-xs md:block">
          <span className="font-semibold text-gray-400">ИИ-ТРЕНАЖЁР</span>
          <span className="mx-4 text-gray-600">/</span>
          <span className="font-semibold text-white">{title}</span>
        </p>

        <div className="flex items-center gap-4">
          {/* Поиск: пока только внешний вид, логики нет */}
          <label className="relative hidden sm:block">
            <span className="sr-only">Поиск</span>
            <input
              type="search"
              className="h-8 w-40 rounded-md border border-[#2E322E] bg-[#1B1D1B] pl-3 pr-8 text-xs text-white outline-none focus:border-[#D2FF52]"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
              <SearchIcon />
            </span>
          </label>
          <span className="hidden h-6 w-px bg-[#2E322E] sm:block" />
          <button type="button" className="text-xs text-gray-300 transition-colors hover:text-white">
            Помощь
          </button>
        </div>
      </div>

      {/* Меню для телефона: на md+ его заменяет сайдбар */}
      <nav className="flex gap-2 overflow-x-auto px-4 pb-3 md:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
              isNavActive(item, pathname) ? "bg-[#262A26] text-[#D2FF52]" : "text-gray-400"
            }`}
          >
            {item.label}
          </NavLink>
        ))}
        <NavLink
          to="/profile"
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
            pathname === "/profile" ? "bg-[#262A26] text-[#D2FF52]" : "text-gray-400"
          }`}
        >
          Профиль
        </NavLink>
      </nav>
    </header>
  );
}

export default Header;