function RegisterPage() {
  return <h1>Cтраница регистрации</h1>;
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

// Иконки
function PracticeIcon() {
  return (
    <svg width="30" height="26" viewBox="0 0 30 26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 2h26v16H9l-6 6v-6H2z" />
    </svg>
  );
}

function AnalysisIcon() {
  return (
    <svg width="30" height="26" viewBox="0 0 30 26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M4 14v10M15 4v20M26 10v14" />
    </svg>
  );
}

function GrowthIcon() {
  return (
    <svg width="30" height="26" viewBox="0 0 30 26" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="15" cy="13" r="12" />
      <circle cx="15" cy="13" r="7.5" />
      <circle cx="15" cy="13" r="3" fill="currentColor" />
    </svg>
  );
}

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

const inputClass =
  "h-12 rounded-lg border-[1.5px] border-[#E6E6E6] bg-transparent px-4 text-base text-white placeholder:italic placeholder:text-[#BDBDBD] focus-visible:border-[#D2FF52] focus-visible:ring-[#D2FF52]/50";

const labelClass = "text-lg font-semibold text-white";

// FR-5.1.4: 8–30 символов, заглавная, строчная, цифра
function validatePassword(password) {
  if (password.length < 8 || password.length > 30) {
    return "Пароль должен быть от 8 до 30 символов";
  }
  if (!/[A-Z]/.test(password)) {
    return "Должна быть хотя бы одна заглавная латинская буква";
  }
  if (!/[a-z]/.test(password)) {
    return "Должна быть хотя бы одна строчная латинская буква";
  }
  if (!/[0-9]/.test(password)) {
    return "Должна быть хотя бы одна цифра";
  }
  return "";
}

function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (!fullName.trim() || !email || !password) {
      setError("Заполните все поля");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setFieldErrors({ password: passwordError });
      return;
    }

    setIsLoading(true);

    try {
      // TODO: заменить на registerRequest(fullName, email, password)
      await fakeRegisterRequest(fullName, email, password);
      navigate("/login");
    } catch (err) {
      // Ошибки полей из API (error.details.fields)
      if (err.details?.fields) {
        setFieldErrors(err.details.fields);
      } else {
        setError(err.message || "Произошла ошибка при регистрации");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen font-sans select-none bg-[#1B1D1B]">
      {/* Левая часть — только на md+ */}
      <div className="hidden md:flex w-[54%] flex-col bg-gradient-to-bl from-[#FAFFE6] via-[#E2FF7D] to-[#C8FA46] p-12 text-black">
        <p className="text-sm uppercase tracking-wide">
          <span className="font-extrabold">ИИ-ТРЕНАЖЁР</span>{" "}
          <span className="font-medium">СОБЕСЕДОВАНИЙ</span>
        </p>

        <div className="mt-12 text-black">
          <svg width="110" height="16" viewBox="0 0 110 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 8H108M101 1l7 7-7 7" />
          </svg>
        </div>

        <h1 className="mt-10 max-w-xl text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
          Твоё следующее интервью начинается{" "}
          <span className="font-extrabold italic">здесь</span>.
        </h1>

        <ul className="mt-16 space-y-8">
          {features.map(({ Icon, title, text }) => (
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

      {/* Правая часть — форма */}
      <div className="relative flex w-full flex-col items-center justify-center bg-[#1B1D1B] p-10 text-white md:w-[46%] md:p-14">
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

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2.5">
              <Label htmlFor="fullName" className={labelClass}>
                ФИО
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Иванов Иван Иванович"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                aria-invalid={!!fieldErrors.fullName}
              />
              {fieldErrors.fullName && (
                <p className="text-sm text-red-500">{fieldErrors.fullName}</p>
              )}
            </div>

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
                aria-invalid={!!fieldErrors.email}
              />
              {fieldErrors.email && (
                <p className="text-sm text-red-500">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="password" className={labelClass}>
                Пароль
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="8–30 символов, заглавная, строчная, цифра"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                aria-invalid={!!fieldErrors.password}
              />
              {fieldErrors.password && (
                <p className="text-sm text-red-500">{fieldErrors.password}</p>
              )}
            </div>

            {error && (
              <p className="text-base font-medium text-red-500">{error}</p>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full rounded-md bg-[#D2FF52] text-base font-medium text-black transition-colors hover:bg-[#bce646]"
            >
              {isLoading ? "Загрузка..." : "Зарегистрироваться"}
            </Button>
          </form>

          <p className="mb-3 mt-4 text-center text-base text-white">
            Уже есть аккаунт?
          </p>
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

export default RegisterPage;

// Временный мок. Удалить, когда появится registerRequest
const fakeRegisterRequest = async (fullName, email) => {
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (email === "test@itmo.ru") {
    const error = new Error("Пользователь с таким email уже существует");
    error.details = {
      fields: { email: "Пользователь с таким email уже существует" },
    };
    throw error;
  }

  return {
    user: {
      id: crypto.randomUUID(),
      email,
      fullName,
      createdAt: new Date().toISOString(),
    },
  };
};