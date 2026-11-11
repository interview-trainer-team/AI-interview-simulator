import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getInterviewResultsRequest,
  getLevelName,
  getLevelVerdict,
  getVerdictInfo,
  QUESTIONS_PER_INTERVIEW,
} from "@/api/interview";

// ---------- ИКОНКИ ----------

function ChevronIcon({ open }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
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

const CRITERIA = [
  { key: "accuracy", label: "Точность" },
  { key: "completeness", label: "Полнота" },
  { key: "readability", label: "Читаемость" },
];

function getCriterionValue(criteria, key) {
  if (!criteria) return 0;
  if (key === "readability") return criteria.readability ?? criteria.clarity ?? 0;
  return criteria[key] ?? 0;
}

// ---------- КОМПОНЕНТЫ ----------

// Кольцо итогового балла: X.X / 10
function ScoreCircle({ score, color }) {
  const size = 180;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(Number(score) || 0, 0), 10) / 10;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative mx-auto size-[150px] md:size-[180px]">
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2E322E" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-4xl font-bold leading-none tracking-tight md:text-5xl">{formatScore(score)}</p>
        <p className="mt-1 text-sm text-gray-400">/10</p>
      </div>
    </div>
  );
}

// Полоска оценки по одному критерию (0–10)
function CriterionBar({ label, value }) {
  const percent = Math.min(Math.max(Number(value) || 0, 0), 10) * 10;

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="tabular-nums text-gray-300">{value}/10</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#2E322E]">
        <div className="h-full rounded-full bg-[#D2FF52] transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function TopicList({ title, items, emptyText }) {
  return (
    <div className="rounded-xl border border-[#2E322E] bg-[#262A26] p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-gray-300">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-500">{emptyText}</p>
      )}
    </div>
  );
}

// Карточка одного вопроса: оценка, критерии, раскрывающийся разбор
function AnswerCard({ item, isOpen, onToggle }) {
  const unanswered = item.score == null && !item.answerText;
  const headingId = `answer-${item.position}-title`;
  const panelId = `answer-${item.position}-panel`;

  return (
    <article className="rounded-2xl border border-[#2E322E] bg-[#1F221F]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex w-full items-start gap-4 px-4 py-4 text-left md:px-5"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D2FF52]">Вопрос {item.position}</p>
          <h3 id={headingId} className="mt-1.5 text-sm font-medium leading-relaxed text-gray-100">
            {item.questionText}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-3 pt-0.5">
          {unanswered ? (
            <span className="text-xs text-gray-500">Без ответа</span>
          ) : (
            <span className="text-sm font-bold tabular-nums">{item.score}/10</span>
          )}
          <ChevronIcon open={isOpen} />
        </div>
      </button>

      {!unanswered && item.criteria && (
        <div className="space-y-3 px-4 pb-4 md:px-5">
          {CRITERIA.map((criterion) => (
            <CriterionBar
              key={criterion.key}
              label={criterion.label}
              value={getCriterionValue(item.criteria, criterion.key)}
            />
          ))}
        </div>
      )}

      {isOpen && (
        <div id={panelId} role="region" aria-labelledby={headingId} className="space-y-4 border-t border-[#2E322E] px-4 py-4 md:px-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Твой ответ</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
              {item.answerText || "Ответ не дан"}
            </p>
          </div>

          {!unanswered && (
            <>
              {item.strengths?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Сильные стороны</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-gray-300">
                    {item.strengths.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                </div>
              )}

              {item.weaknesses?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Слабые стороны</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-gray-300">
                    {item.weaknesses.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                </div>
              )}

              {item.recommendation && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Рекомендация</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-300">{item.recommendation}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

// ---------- СТРАНИЦА ----------

function ResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [openPosition, setOpenPosition] = useState(null);

  // Загружаем результаты; если интервью ещё идёт — возвращаем в чат
  useEffect(() => {
    setIsLoading(true);
    setError("");

    getInterviewResultsRequest(id)
      .then((data) => {
        if (data.interview.status !== "COMPLETED") {
          navigate(`/interview/${id}`, { replace: true });
          return;
        }
        setInterview(data.interview);
        setAnswers(data.answers || []);
        setFeedback(data.feedback);
      })
      .catch((err) => {
        if (err.code === "INTERVIEW_NOT_COMPLETED") {
          navigate(`/interview/${id}`, { replace: true });
          return;
        }
        setError(err.message || "Не удалось загрузить результаты");
      })
      .finally(() => setIsLoading(false));
  }, [id, navigate]);

  if (isLoading) {
    return <p className="text-sm text-gray-400">Загружаем результаты...</p>;
  }

  if (!interview) {
    return (
      <div className="space-y-4">
        <p className="text-red-500">{error || "Результаты не найдены"}</p>
        <Button asChild className="bg-[#D2FF52] text-black hover:bg-[#bce646]">
          <Link to="/interview/setup">Настроить интервью</Link>
        </Button>
      </div>
    );
  }

  const verdictInfo = getVerdictInfo(feedback?.levelVerdict || getLevelVerdict(interview.totalScore));
  const answeredCount = answers.filter((item) => item.answerText != null || item.score != null).length;
  const recommendations = Array.isArray(feedback?.recommendations)
    ? feedback.recommendations
    : feedback?.recommendations
    ? [feedback.recommendations]
    : [];

  return (
    <div className="mx-auto max-w-[960px]">
      {/* Шапка: заголовок, направление, уровень и дата */}
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D2FF52]">Результаты интервью</p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
        {interview.direction} · {getLevelName(interview.levelCode)}
      </h1>
      <p className="mt-2 text-sm text-gray-400">{formatDate(interview.completedAt || interview.createdAt)}</p>

      {/* Итоговый балл и вердикт */}
      <section className="mt-8 rounded-2xl border border-[#2E322E] bg-[#1F221F] px-5 py-8 text-center md:px-8">
        <ScoreCircle score={interview.totalScore} color={verdictInfo.color} />
        <p className="mt-5 text-lg font-semibold" style={{ color: verdictInfo.color }}>
          {verdictInfo.text}
        </p>
        {interview.finishedEarly && (
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-gray-400">
            Интервью завершено досрочно. Оценка рассчитана по {answeredCount} из {QUESTIONS_PER_INTERVIEW} ответов.
            Неотвеченные вопросы отмечены как «Без ответа».
          </p>
        )}
      </section>

      {/* Разбор каждого ответа */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Разбор ответов</h2>
        <div className="mt-4 space-y-3">
          {answers.map((item) => (
            <AnswerCard
              key={item.questionId || item.position}
              item={item}
              isOpen={openPosition === item.position}
              onToggle={() => setOpenPosition((prev) => (prev === item.position ? null : item.position))}
            />
          ))}
        </div>
      </section>

      {/* Итоговая обратная связь ИИ */}
      <section className="mt-8 rounded-2xl border border-[#2E322E] bg-[#1F221F] p-5 md:p-6">
        <h2 className="text-lg font-semibold">Обратная связь ИИ</h2>

        {feedback?.status === "FAILED" || !feedback ? (
          <p className="mt-4 text-sm text-gray-400">
            Итоговые рекомендации пока не сформированы. Оценки по вопросам уже доступны в разборе ответов.
          </p>
        ) : (
          <>
            {feedback.summary && <p className="mt-4 text-sm leading-relaxed text-gray-300">{feedback.summary}</p>}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <TopicList
                title="Сильные стороны"
                items={feedback.strongTopics || []}
                emptyText="Пока нет отмеченных сильных сторон."
              />
              <TopicList
                title="Что улучшить"
                items={feedback.weakTopics || []}
                emptyText="Замечаний по ответам нет."
              />
            </div>

            {recommendations.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold">Рекомендации</h3>
                <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-gray-300">
                  {recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild className="h-12 rounded-lg bg-[#D2FF52] px-6 text-sm font-semibold text-black hover:bg-[#bce646] sm:min-w-[220px]">
          <Link to="/interview/setup">Настроить интервью</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-12 rounded-lg border-[#2E322E] bg-transparent px-6 text-sm font-semibold text-white hover:bg-[#262A26] sm:min-w-[220px]"
        >
          <Link to="/history">История интервью</Link>
        </Button>
      </div>
    </div>
  );
}

export default ResultsPage;