import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getInterviewsRequest,
  getLevelName,
  getLevelVerdict,
  getVerdictInfo,
  QUESTIONS_PER_INTERVIEW,
} from "@/api/interview";

// ---------- ИКОНКИ ----------

function ArrowIcon() {
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
      aria-hidden="true"
    >
      <path d="M1 7h17M12 1l6 6-6 6" />
    </svg>
  );
}

// ---------- ВСПОМОГАТЕЛЬНОЕ ----------

// Дата в формате «10 ноября 2026»
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

function isCompleted(interview) {
  return interview.status === "COMPLETED";
}

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "completed", label: "Завершённые" },
  { id: "active", label: "В процессе" },
];

function matchesFilter(interview, filter) {
  if (filter === "completed") return isCompleted(interview);
  if (filter === "active") return !isCompleted(interview);
  return true;
}

function getStatusBadge(interview) {
  if (isCompleted(interview) && interview.finishedEarly) {
    return { text: "Завершено досрочно", className: "border-[#5A4A1E] bg-[#2A2618] text-[#F5C542]" };
  }
  if (isCompleted(interview)) {
    return { text: "Завершено", className: "border-[#3A4A1E] bg-[#222A18] text-[#D2FF52]" };
  }
  return { text: "В процессе", className: "border-[#2E322E] bg-[#262A26] text-gray-300" };
}

// ---------- КОМПОНЕНТЫ ----------

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-2xl border border-[#2E322E] bg-[#1F221F] px-4 py-4 md:px-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}

function InterviewCard({ interview }) {
  const completed = isCompleted(interview);
  const badge = getStatusBadge(interview);
  const to = completed ? `/interview/${interview.id}/results` : `/interview/${interview.id}`;
  const date = formatDate(interview.completedAt || interview.createdAt);
  const scoreColor = completed ? getVerdictInfo(getLevelVerdict(interview.totalScore)).color : undefined;

  return (
    <Link
      to={to}
      className="flex flex-col gap-3 rounded-2xl border border-[#2E322E] bg-[#1F221F] px-4 py-4 transition-colors hover:border-[#D2FF52]/40 md:flex-row md:items-center md:justify-between md:px-5"
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-white md:text-base">
          {interview.direction} · {getLevelName(interview.levelCode)}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {date && <p className="text-xs text-gray-400">{date}</p>}
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badge.className}`}>
            {badge.text}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 md:justify-end">
        {completed ? (
          <p className="text-sm font-bold tabular-nums" style={{ color: scoreColor }}>
            {formatScore(interview.totalScore)}/10
          </p>
        ) : (
          <div className="text-right">
            <p className="text-sm text-gray-300">
              {interview.answeredCount ?? 0} из {QUESTIONS_PER_INTERVIEW} вопросов
            </p>
            <p className="mt-1 text-xs font-semibold text-[#D2FF52]">Продолжить</p>
          </div>
        )}
        <span className="text-[#D2FF52]">
          <ArrowIcon />
        </span>
      </div>
    </Link>
  );
}

// ---------- СТРАНИЦА ----------

function HistoryPage() {
  const [interviews, setInterviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  // Загружаем список интервью пользователя
  useEffect(() => {
    setIsLoading(true);
    setError("");

    getInterviewsRequest()
      .then((data) => setInterviews(data.interviews || []))
      .catch((err) => setError(err.message || "Не удалось загрузить историю"))
      .finally(() => setIsLoading(false));
  }, []);

  const completed = useMemo(() => interviews.filter(isCompleted), [interviews]);

  // Сводка: средний и лучший балл считаем только по завершённым интервью
  const stats = useMemo(() => {
    const scored = completed.filter((item) => item.totalScore != null);
    const average =
      scored.length > 0
        ? Math.round((scored.reduce((sum, item) => sum + Number(item.totalScore), 0) / scored.length) * 10) / 10
        : null;
    const best = scored.length > 0 ? Math.max(...scored.map((item) => Number(item.totalScore))) : null;

    return {
      total: interviews.length,
      average,
      best,
    };
  }, [interviews, completed]);

  const visible = interviews.filter((item) => matchesFilter(item, filter));

  const filterCounts = {
    all: interviews.length,
    completed: completed.length,
    active: interviews.length - completed.length,
  };

  if (isLoading) {
    return <p className="text-sm text-gray-400">Загружаем историю...</p>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-red-500">{error}</p>
        <Button asChild className="bg-[#D2FF52] text-black hover:bg-[#bce646]">
          <Link to="/interview/setup">Настроить интервью</Link>
        </Button>
      </div>
    );
  }

  const bestColor = stats.best != null ? getVerdictInfo(getLevelVerdict(stats.best)).color : undefined;
  const averageColor = stats.average != null ? getVerdictInfo(getLevelVerdict(stats.average)).color : undefined;

  return (
    <div className="mx-auto max-w-[960px]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D2FF52]">Тренировочные собеседования</p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">История интервью</h1>
      <p className="mt-3 text-sm text-gray-400">
        Все твои тренировочные собеседования: можно открыть результаты или продолжить незавершённое интервью.
      </p>

      {/* Сводные показатели по всем интервью */}
      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <StatCard label="Всего интервью" value={stats.total} />
        <StatCard
          label="Средний балл"
          value={stats.average != null ? `${formatScore(stats.average)}/10` : "—"}
          color={averageColor}
        />
        <StatCard
          label="Лучший результат"
          value={stats.best != null ? `${formatScore(stats.best)}/10` : "—"}
          color={bestColor}
        />
      </section>

      {/* Фильтры списка */}
      <div role="tablist" aria-label="Фильтр интервью" className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(item.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-[#D2FF52] text-black"
                  : "border border-[#2E322E] bg-[#1F221F] text-gray-300 hover:border-[#D2FF52]/40"
              }`}
            >
              {item.label}
              <span className={`ml-2 text-xs ${active ? "text-black/70" : "text-gray-500"}`}>
                {filterCounts[item.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Список интервью или пустое состояние */}
      {interviews.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[#2E322E] bg-[#1F221F] px-5 py-10 text-center">
          <p className="text-base font-semibold">Пока нет интервью</p>
          <p className="mt-2 text-sm text-gray-400">Пройди первое собеседование, и оно появится в истории.</p>
          <Button asChild className="mt-6 h-12 rounded-lg bg-[#D2FF52] px-6 text-sm font-semibold text-black hover:bg-[#bce646]">
            <Link to="/interview/setup">Настроить интервью</Link>
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">В этом разделе пока нет интервью.</p>
      ) : (
        <section className="mt-6 space-y-3">
          {visible.map((interview) => (
            <InterviewCard key={interview.id} interview={interview} />
          ))}
        </section>
      )}
    </div>
  );
}

export default HistoryPage;