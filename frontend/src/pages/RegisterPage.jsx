// Готовые компоненты shadcn/ui, которые уже есть в проекте (их добавил Влад)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Link нужен для перехода на /login без перезагрузки страницы,
// useNavigate позволяет перейти на другую страницу из кода (после регистрации)
import { Link, useNavigate } from "react-router-dom";
// useState хранит значения полей и ошибку
import { useState } from "react";

// ---------- ИКОНКИ ----------
// Рисуем их прямо в коде (SVG), чтобы не тащить картинки.
// stroke="currentColor" красит линии в цвет текста, поэтому они чёрные, как в макете

// Облачко-диалог для пункта «Практика»
function PracticeIcon() {
  return (
    <svg width="30" height="26" viewBox="0 0 30 26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 2h26v16H9l-6 6v-6H2z" />
    </svg>
  );
}

// Три столбика для пункта «Анализ»
function AnalysisIcon() {
  return (
    <svg width="30" height="26" viewBox="0 0 30 26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M4 14v10M15 4v20M26 10v14" />
    </svg>
  );
}

// Мишень (кольца и точка) для пункта «Развитие»
function GrowthIcon() {
  return (
    <svg width="30" height="26" viewBox="0 0 30 26" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="15" cy="13" r="12" />
      <circle cx="15" cy="13" r="7.5" />
      <circle cx="15" cy="13" r="3" fill="currentColor" />
    </svg>
  );
}

// Три пункта для левой части экрана: иконка, заголовок и подпись.
// Вынесены в массив, чтобы не копировать разметку три раза, а выводить через map
const features = [
  {
    Icon: PracticeIcon,
    title: "Практика",
    text: "Отвечай на вопросы, приближённые к реальным собеседованиям",
  },
  {
    Icon: AnalysisIcon,
    title: "Анализ",
    text: "Узнавай сильные стороны и ошибки в своих ответах",
  },
  {
    Icon: GrowthIcon,
    title: "Развитие",
    text: "Получай рекомендации и улучшай свои навыки",
  },
];

// Классы для полей ввода и подписей. Вынесены в константы, потому что одинаковы
// для всех трёх полей. Рамка светлая, подсказка курсивом, как в макете
const inputClass =
  "h-12 rounded-lg border-[1.5px] border-[#E6E6E6] bg-transparent px-4 text-base md:text-base text-white placeholder:italic placeholder:text-[#BDBDBD] focus-visible:border-[#D2FF52] focus-visible:ring-[#D2FF52]/50";

const labelClass = "text-lg font-semibold text-white";

function RegisterPage() {
  // Значения полей формы
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Текст ошибки под формой (пустая строка = ошибки нет)
  const [error, setError] = useState("");
  // Нужен, чтобы блокировать кнопку, пока идёт запрос
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  // Вызывается при нажатии на кнопку «Зарегистрироваться»
  const handleSubmit = async (e) => {
    // Отключаем стандартную перезагрузку страницы при отправке формы
    e.preventDefault();
    // Сбрасываем старую ошибку перед новой проверкой
    setError("");

    // Проверка на пустоту. trim() убирает пробелы, чтобы нельзя было ввести одни пробелы в ФИО
    if (!fullName.trim() || !email || !password) {
      setError("Заполните все поля");
      return;
    }

    // Минимальная длина пароля, как в макете
    if (password.length < 8) {
      setError("Пароль должен быть не менее 8 символов");
      return;
    }

    // Включаем состояние загрузки (кнопка блокируется)
    setIsLoading(true);

    // --- ВРЕМЕННО: МОК РЕГИСТРАЦИИ --- потом заменить
    try {
      // Вызываем мок регистрации (позже здесь будет registerRequest из api/auth.js)
      await fakeRegisterRequest(fullName, email);
      // После успешной регистрации отправляем пользователя на страницу входа
      navigate("/login");
    } catch (err) {
      // Если запрос упал, показываем текст ошибки (или стандартный)
      setError(err.message || "Произошла ошибка при регистрации");
    } finally {
      // В любом случае (успех или ошибка) выключаем загрузку
      setIsLoading(false);
    }
  };

  return (
    // Корневой контейнер: две колонки на всю высоту экрана
    <div className="flex min-h-screen font-sans select-none bg-[#1B1D1B]">
      {/* ЛЕВАЯ ЧАСТЬ (54% ширины): градиент от почти белого справа вверху к лаймовому слева внизу.
          На телефонах скрыта (hidden md:flex) */}
      <div className="hidden md:flex w-[54%] flex-col bg-gradient-to-bl from-[#FAFFE6] via-[#E2FF7D] to-[#C8FA46] p-12 text-black">
        {/* Надпись-логотип в левом верхнем углу */}
        <p className="text-sm uppercase tracking-wide">
          <span className="font-extrabold">ИИ-ТРЕНАЖЁР</span>{" "}
          <span className="font-medium">СОБЕСЕДОВАНИЙ</span>
        </p>

        {/* Стрелка под логотипом: тонкая линия с «галочкой» на конце */}
        <div className="mt-12 text-black">
          <svg width="110" height="16" viewBox="0 0 110 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 8H108M101 1l7 7-7 7" />
          </svg>
        </div>

        {/* Главный заголовок, слово «здесь» выделено жирным курсивом */}
        <h1 className="mt-10 max-w-xl text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
          Твоё следующее интервью начинается{" "}
          <span className="font-extrabold italic">здесь</span>.
        </h1>

        {/* Список преимуществ: каждый пункт берётся из массива features */}
        <ul className="mt-16 space-y-8">
          {features.map(({ Icon, title, text }) => (
            // key нужен React, чтобы отличать элементы списка друг от друга
            <li key={title} className="flex items-start gap-5">
              <div className="mt-0.5 shrink-0">
                <Icon />
              </div>
              <div>
                <p className="text-lg font-medium leading-tight">{title}</p>
                <p className="mt-1 text-xs text-black/80">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ПРАВАЯ ЧАСТЬ (46% ширины): тёмная область с формой регистрации */}
      <div className="relative flex w-full flex-col items-center justify-center bg-[#1B1D1B] p-10 text-white md:w-[46%] md:p-14">
        {/* Иконка чата с символами <> в правом верхнем углу (взята с экрана входа) */}
        <div className="absolute right-10 top-10 text-[#C6FF4D]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M10 8L7 11L10 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 14L17 11L14 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="w-full max-w-[440px]">
          <h2 className="mb-8 text-3xl font-bold tracking-tight">
            Создать аккаунт
          </h2>

          {/* Форма: при отправке вызывается handleSubmit */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Поле ФИО. htmlFor у Label связан с id у Input: клик по подписи ставит курсор в поле */}
            <div className="space-y-2.5">
              <Label htmlFor="fullName" className={labelClass}>
                ФИО
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Иванов Иван Иванович"
                // value + onChange: поле «управляется» состоянием React
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Поле Email. type="email" включает базовую проверку формата в браузере */}
            <div className="space-y-2.5">
              <Label htmlFor="email" className={labelClass}>
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Поле пароля. type="password" скрывает символы точками */}
            <div className="space-y-2.5">
              <Label htmlFor="password" className={labelClass}>
                Пароль
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Не менее 8 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Блок ошибки: показывается только если error не пустая строка */}
            {error && (
              <p className="text-base font-medium text-red-500">{error}</p>
            )}

            {/* Кнопка отправки. Пока идёт загрузка, она заблокирована и меняет текст */}
            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full rounded-md bg-[#D2FF52] text-base font-medium text-black transition-colors hover:bg-[#bce646]"
            >
              {isLoading ? "Загрузка..." : "Зарегистрироваться"}
            </Button>
          </form>

          {/* Нижний блок: вопрос и кнопка для тех, у кого уже есть аккаунт */}
          <p className="mb-3 mt-4 text-center text-base text-white">
            Уже есть аккаунт?
          </p>
          {/* Link ведёт на страницу входа, Button внутри нужен только для внешнего вида */}
          <Link to="/login" className="block w-full">
            <Button
              variant="outline"
              className="h-12 w-full rounded-md border border-[#E6E6E6] bg-[#111311] text-base font-bold text-[#D2FF52] transition-colors hover:bg-black hover:text-[#D2FF52]"
            >
              Войти
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Экспорт по умолчанию, чтобы страницу можно было подключить в App.jsx
export default RegisterPage;

// --- ЛОКАЛЬНЫЙ МОК РЕГИСТРАЦИИ (временно) --- потом заменить
// Имитирует бэкенд: email test@itmo.ru считается занятым, остальные проходят.
// TODO: удалить, когда Влад добавит registerRequest в api/auth.js
const fakeRegisterRequest = async (fullName, email) => {
  // Пауза, чтобы было видно состояние «Загрузка...»
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (email === "test@itmo.ru") {
    throw new Error("Пользователь с таким email уже существует");
  }
  return { user: { id: 2, email, fullName } };
};