import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { loginRequest } from "@/api/auth";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Заполните все поля");
      return;
    }

    if (password.length < 8) {
      setError("Пароль должен быть не менее 8 символов");
      return;
    }

    setIsLoading(true);

    try {
      const data = await loginRequest(email, password);
      login(data.user, data.token);
    } catch (err) {
      setError(err.message || "Произошла ошибка при входе");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen font-sans select-none bg-[#0D0D0D]">
      <div className="hidden md:flex w-1/2 bg-gradient-to-br from-[#FAFFE6] via-[#EEFFB3] via-[#E2FF7D] to-[#C8FA46] text-black p-16 flex-col justify-center items-start relative">
        <div className="absolute top-16 left-16">
          <p className="text-lg uppercase tracking-wider font-sans">
            <span className="font-extrabold">ИИ-ТРЕНАЖЁР</span>{" "}
            <span className="font-medium">СОБЕСЕДОВАНИЙ</span>
          </p>
        </div>

        <div className="w-full max-w-xl">
          <div className="mb-10 text-black">
            <svg
              width="180"
              height="24"
              viewBox="0 0 180 24"
              fill="none"
              xmlns="http://w3.org"
            >
              <path
                d="M0 12H176M176 12L164 2M176 12L164 22"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight mb-10 tracking-tight font-sans">
            Продолжай <span className="font-extrabold italic">расти.</span>
            <br />
            Готовься увереннее.
          </h1>

          <p className="text-lg lg:text-xl xl:text-2xl font-normal leading-relaxed max-w-lg text-black/85 font-sans">
            Возвращайся к тренировкам, разбирай предыдущие ответы и отслеживай
            результаты подготовки.
          </p>
        </div>
      </div>

      <div className="w-full md:w-1/2 text-white p-16 flex flex-col justify-center items-center relative font-sans">
        <div className="absolute top-8 right-16 text-[#C6FF4D] opacity-80 cursor-pointer hover:opacity-100 transition-opacity">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://w3.org"
          >
            <path
              d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 8L7 11L10 14"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 14L17 11L14 8"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="w-full max-w-[460px] space-y-2">
          <h2 className="text-4xl lg:text-5xl font-bold leading-tight mb-2 tracking-tight font-sans">
            С возвращением!
          </h2>
          <p className="text-gray-400 text-lg mb-12 font-sans">
            Войди, чтобы продолжить подготовку
          </p>

          <form className="space-y-8" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <Label
                htmlFor="email"
                className="text-gray-300 text-base font-medium font-sans"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 bg-transparent border-gray-800 text-white text-lg placeholder:text-gray-600 rounded-md focus-visible:ring-[#D2FF52] focus-visible:border-[#D2FF52] font-sans px-4"
              />
            </div>

            <div className="space-y-3">
              <Label
                htmlFor="password"
                className="text-gray-300 text-base font-medium font-sans"
              >
                Пароль
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Не менее 8 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-14 bg-transparent border-gray-800 text-white text-lg placeholder:text-gray-600 rounded-md focus-visible:ring-[#D2FF52] focus-visible:border-[#D2FF52] font-sans px-4"
              />
            </div>

            {error && (
              <p className="text-red-500 text-base font-medium font-sans">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-[#D2FF52] text-black hover:bg-[#bce646] font-bold text-lg rounded-md transition-colors font-sans mt-2"
            >
              {isLoading ? "Загрузка..." : "Войти"}
            </Button>
          </form>

          <div className="mt-12 text-center flex flex-col items-center">
            <p className="text-gray-500 text-base mb-4 font-sans">
              Уже есть аккаунт?
            </p>
            <Link to="/register" className="w-full">
              <Button
                variant="outline"
                className="w-full h-14 bg-transparent border border-gray-800 text-[#D2FF52] hover:bg-white/5 hover:text-[#D2FF52] font-semibold text-lg rounded-md transition-colors font-sans"
              >
                Зарегистрироваться
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
