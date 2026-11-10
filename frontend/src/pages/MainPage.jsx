import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getInterviewsRequest,
  getLevelName,
  getLevelVerdict,
  getVerdictInfo,
  QUESTIONS_PER_INTERVIEW,
} from "@/api/interview";

// ---------- ИКОНКИ ----------

function ArrowIcon({ className = "" }) {
  return (
    <svg
      width="18"
      height="12"
      viewBox="0 0 20 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M1 7h17M12 1l6 6-6 6" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 6h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H12l-4 3v-3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

// ---------- ВСПОМОГАТЕЛЬНОЕ ----------

function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatScore(score) {
  return Number(score ?? 0).toFixed(1);
}

function getTodayParts() {
  const now = new Date();
  return {
    day: now.getDate(),
    month: now.toLocaleDateString("ru-RU", { month: "long" }),
    weekday: now.toLocaleDateString("ru-RU", { weekday: "long" }),
  };
}

// ---------- КОМПОНЕНТЫ ----------

function TodayDate() {
  const { day, month, weekday } = getTodayParts();

  return (
    <div className="flex shrink-0 items-center gap-3 sm:pt-6">
      <p className="text-5xl font-bold leading-none tracking-tight md:text-6xl">{day}</p>
      <div className="text-sm leading-tight">
        <p className="font-medium text-white">{month}</p>
        <p className="mt-0.5 text-gray-400">{weekday}</p>
      </div>
    </div>
  );
}

function NewInterviewCard() {
  return (
    <section className="rounded-2xl border border-[#2E322E] bg-[#1F221F] p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#D2FF52] text-black">
          <ChatIcon />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Новое интервью</h2>
          <p className="mt-1 text-sm text-gray-400">
            Настрой направление и уровень подготовки, чтобы начать тренировку.
          </p>
        </div>
      </div>

      {/* Два шага в одну линию, на узком экране друг под другом */}
      <div className="mt-5 flex flex-col gap-4 rounded-xl bg-[#181B18] px-4 py-4 md:flex-row md:items-center md:gap-6 md:px-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#2A3520] text-xs font-semibold text-[#D2FF52]">
            1
          </span>
          <div>
            <p className="text-sm font-semibold">Выбери IT-направление и уровень</p>
            <p className="mt-1 text-xs text-gray-400">Например: Frontend-разработка · Junior</p>
          </div>
        </div>

        <span className="hidden shrink-0 text-gray-500 md:block" aria-hidden="true">
          <ArrowIcon />
        </span>

        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#2A3520] text-xs font-semibold text-[#D2FF52]">
            2
          </span>
          <div>
            <p className="text-sm font-semibold">Ответь на 5 вопросов</p>
            <p className="mt-1 text-xs text-gray-400">Получи оценку и рекомендации ИИ</p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Выбор параметров будет на следующем шаге — перед началом собеседования.
      </p>

      <Button
        asChild
        className="mt-4 h-12 gap-3 rounded-lg bg-[#D2FF52] px-6 text-sm font-semibold text-black hover:bg-[#bce646]"
      >
        <Link to="/interview/setup">
          Настроить интервью
          <ArrowIcon />
        </Link>
      </Button>
    </section>
  );
}

// Карточка незавершённого интервью (появляется только если такое есть)
function ContinueCard({ interview }) {
  return (
    <Link
      to={`/interview/${interview.id}`}
      className="mt-4 flex flex-col gap-2 rounded-2xl border border-[#2E322E] bg-[#1F221F] px-5 py-4 transition-colors hover:border-[#D2FF52]/40 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D2FF52]">Продолжить интервью</p>
        <p className="mt-1.5 text-sm font-semibold">
          {interview.direction} · {getLevelName(interview.levelCode)}
        </p>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-300">
        <span>
          {interview.answeredCount ?? 0} из {QUESTIONS_PER_INTERVIEW} вопросов
        </span>
        <span className="text-[#D2FF52]">
          <ArrowIcon />
        </span>
      </div>
    </Link>
  );
}

function HistoryBlock({ interviews, isLoading, error }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">История интервью</h2>
      <p className="mt-1 text-sm text-gray-400">Твои предыдущие тренировки и результаты.</p>

      {isLoading ? (
        <div className="mt-4 rounded-2xl border border-[#2E322E] bg-[#1F221F] px-5 py-10">
          <p className="text-center text-sm text-gray-400">Загружаем историю...</p>
        </div>
      ) : error ? (
        <div className="mt-4 rounded-2xl border border-[#2E322E] bg-[#1F221F] px-5 py-10">
          <p className="text-center text-sm text-red-500">{error}</p>
        </div>
      ) : interviews.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-[#2E322E] bg-[#1F221F] px-5 py-10 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-full border border-[#2E322E] text-[#D2FF52]">
            <ClockIcon />
          </span>
          <p className="mt-4 text-sm font-semibold">Здесь пока нет завершённых интервью</p>
          <p className="mt-2 text-xs text-gray-400">Пройди первую тренировку — и результаты появятся здесь.</p>
          <Link
            to="/history"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#D2FF52] transition-colors hover:text-[#bce646]"
          >
            Посмотреть историю
            <ArrowIcon />
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {interviews.map((interview) => {
            const scoreColor = getVerdictInfo(getLevelVerdict(interview.totalScore)).color;
            return (
              <li key={interview.id}>
                <Link
                  to={`/interview/${interview.id}/results`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-[#2E322E] bg-[#1F221F] px-4 py-4 transition-colors hover:border-[#D2FF52]/40 md:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {interview.direction} · {getLevelName(interview.levelCode)}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">{formatDate(interview.completedAt || interview.createdAt)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums" style={{ color: scoreColor }}>
                    {formatScore(interview.totalScore)}/10
                  </p>
                </Link>
              </li>
            );
          })}
          <li className="pt-1">
            <Link
              to="/history"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#D2FF52] transition-colors hover:text-[#bce646]"
            >
              Все интервью
              <ArrowIcon />
            </Link>
          </li>
        </ul>
      )}
    </section>
  );
}

// ---------- СТРАНИЦА ----------

function MainPage() {
  const [interviews, setInterviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Шапка и карточка старта рисуются сразу; список нужен только для продолжения и истории
  useEffect(() => {
    getInterviewsRequest()
      .then((data) => setInterviews(data.interviews || []))
      .catch((err) => setError(err.message || "Не удалось загрузить историю"))
      .finally(() => setIsLoading(false));
  }, []);

  const unfinished = interviews.find((item) => item.status !== "COMPLETED") || null;
  const recentCompleted = interviews.filter((item) => item.status === "COMPLETED").slice(0, 3);

  return (
    <div className="mx-auto max-w-[960px]">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D2FF52]">
            Твоя подготовка начинается здесь
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Готов к следующему
            <br />
            собеседованию?
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-400">
            Тренируйся отвечать на технические вопросы и получай рекомендации от искусственного интеллекта.
          </p>
        </div>
        <TodayDate />
      </div>

      <div className="mt-8">
        <NewInterviewCard />
        {unfinished && <ContinueCard interview={unfinished} />}
      </div>

      <div className="mt-8">
        <HistoryBlock interviews={recentCompleted} isLoading={isLoading} error={error} />
      </div>
    </div>
  );
}

export default MainPage;