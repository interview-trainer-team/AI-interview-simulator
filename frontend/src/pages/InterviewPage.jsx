import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getInterviewRequest,
  getCurrentQuestionRequest,
  submitAnswerRequest,
  finishInterviewRequest,
  getLevelName,
  QUESTIONS_PER_INTERVIEW,
} from "@/api/interview";

function BotIcon({ className = "" }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 10 8 12l2 2M14 14l2-2-2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="26" height="16" viewBox="0 0 26 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 8h23M17 1l7 7-7 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

function formatTime(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function ChatMessage({ author, text, time }) {
  const isAi = author === "ai";
  return (
    <div className={`flex gap-3 ${isAi ? "justify-start" : "justify-end"}`}>
      {isAi && <BotIcon className="mt-3 shrink-0 text-[#D2FF52]" />}
      <div
        className={`max-w-[85%] rounded-xl border px-4 py-3 md:max-w-[70%] ${
          isAi ? "border-[#2E322E] bg-[#262A26]" : "border-[#3A4A1E] bg-[#2C3522]"
        }`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D2FF52]">
          {isAi ? "ИИ-интервьюер" : "Твой ответ"}
        </p>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-200">{text}</p>
        {time && <p className="mt-1 text-right text-[10px] text-gray-500">{formatTime(time)}</p>}
      </div>
    </div>
  );
}

function TypingMessage() {
  return (
    <div className="flex gap-3">
      <BotIcon className="mt-3 shrink-0 text-[#D2FF52]" />
      <div className="rounded-xl border border-[#2E322E] bg-[#262A26] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D2FF52]">ИИ-интервьюер</p>
        <p className="mt-1.5 animate-pulse text-sm text-gray-400">Анализирую ответ...</p>
      </div>
    </div>
  );
}

function QuestionSteps({ answeredCount, currentPosition, isCompleted }) {
  const steps = Array.from({ length: QUESTIONS_PER_INTERVIEW }, (_, i) => i + 1);
  return (
    <ol className="mt-3 space-y-3">
      {steps.map((pos) => {
        const done = pos <= answeredCount;
        const current = !isCompleted && pos === currentPosition;
        return (
          <li key={pos} className="flex items-center gap-3 text-xs">
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                done
                  ? "border-[#D2FF52] text-[#D2FF52]"
                  : current
                  ? "border-[#D2FF52] bg-[#D2FF52]"
                  : "border-[#3A3E3A]"
              }`}
            >
              {done && <CheckIcon />}
            </span>
            <span className={current ? "font-semibold text-white" : "text-gray-400"}>
              Вопрос {pos}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function InterviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [messages, setMessages] = useState([]);
  const [answerText, setAnswerText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const chatEndRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError("");
      try {
        const data = await getInterviewRequest(id);
        if (cancelled) return;
        const iv = data.interview || data;
        if (iv.status === "COMPLETED") {
          navigate(`/interview/${id}/results`, { replace: true });
          return;
        }
        setInterview(iv);
        setMessages([
          {
            id: "greeting",
            author: "ai",
            text: `Привет! Давай начнём техническое собеседование по направлению «${iv.directionName || iv.direction}». Будет ${QUESTIONS_PER_INTERVIEW} вопросов, отвечай своими словами.`,
          },
        ]);

        const q = await getCurrentQuestionRequest(id);
        if (cancelled) return;
        setCurrentQuestion(q);
        setMessages((prev) => [
          ...prev,
          { id: `q-${q.questionId}`, author: "ai", text: `Вопрос ${q.position}. ${q.text}` },
        ]);
      } catch (err) {
        if (!cancelled) setError(err.message || "Не удалось загрузить интервью");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, isSending]);

  if (isLoading) {
    return <p className="text-sm text-gray-400">Загружаем интервью...</p>;
  }

  if (!interview) {
    return (
      <div className="space-y-4">
        <p className="text-red-500">{error || "Интервью не найдено"}</p>
        <Button onClick={() => navigate("/interview/setup")} className="bg-[#D2FF52] text-black hover:bg-[#bce646]">
          Настроить новое интервью
        </Button>
      </div>
    );
  }

  const answeredCount = interview.answeredCount ?? 0;
  const isCompleted = interview.status === "COMPLETED";
  const progressPercent = (answeredCount / QUESTIONS_PER_INTERVIEW) * 100;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!answerText.trim() || !currentQuestion || isSending) return;

    setError("");
    setIsSending(true);
    try {
      const data = await submitAnswerRequest(interview.id, currentQuestion.questionId, answerText.trim());
      setAnswerText("");

      setMessages((prev) => [
        ...prev,
        { id: `a-${currentQuestion.questionId}`, author: "user", text: answerText.trim() },
        {
          id: `f-${data.answerId}`,
          author: "ai",
          text: data.analysis
            ? `Оценка: ${data.analysis.score}/10. ${data.analysis.recommendation || ""}`
            : "Ответ сохранён, анализ выполняется...",
        },
      ]);

      setInterview((prev) => ({
        ...prev,
        status: data.interviewStatus,
        answeredCount: (prev.answeredCount ?? 0) + 1,
      }));

      if (data.interviewStatus === "COMPLETED") {
        setTimeout(() => navigate(`/interview/${interview.id}/results`), 1500);
        return;
      }

      if (data.nextPosition) {
        const next = await getCurrentQuestionRequest(id);
        setCurrentQuestion(next);
        setMessages((prev) => [
          ...prev,
          { id: `q-${next.questionId}`, author: "ai", text: `Вопрос ${next.position}. ${next.text}` },
        ]);
      }
    } catch (err) {
      setError(err.message || "Не удалось отправить ответ");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFinishEarly = async () => {
    if (!window.confirm("Завершить интервью досрочно? Оценка будет по уже данным ответам.")) return;
    try {
      await finishInterviewRequest(interview.id);
      navigate(`/interview/${interview.id}/results`);
    } catch (err) {
      setError(err.message || "Не удалось завершить интервью");
    }
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D2FF52]">
            Тренировочное собеседование
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
            {interview.directionName || interview.direction} · {getLevelName(interview.levelCode || interview.levelName)}
          </h1>
          <p className="mt-2 text-sm text-gray-400">Техническое интервью</p>
        </div>

        <div className="w-full rounded-xl border border-[#2E322E] bg-[#1F221F] p-4 lg:w-[300px]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Прогресс интервью</p>
          <p className="mt-2 text-sm text-gray-300">
            <span className="text-xl font-bold text-white">{answeredCount}</span> из {QUESTIONS_PER_INTERVIEW} вопросов
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#2E322E]">
            <div className="h-full rounded-full bg-[#D2FF52] transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_300px]">
        <section className="flex min-h-[520px] flex-col rounded-2xl border border-[#2E322E] bg-[#1F221F]">
          <div className="flex items-center justify-between border-b border-[#2E322E] px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BotIcon className="text-[#D2FF52]" />
              ИИ-интервьюер
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 md:px-5" style={{ maxHeight: "60vh" }}>
            <p className="text-center text-[10px] uppercase tracking-wider text-gray-500">Начало сессии</p>
            {messages.map((message) => (
              <ChatMessage key={message.id} {...message} />
            ))}
            {isSending && <TypingMessage />}
            {isCompleted && (
              <p className="text-center text-sm text-[#D2FF52]">Интервью завершено, открываем результаты...</p>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-[#2E322E] px-4 py-4 md:px-5">
            <label htmlFor="answer" className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Ваш ответ
            </label>
            <div className="mt-2 flex gap-3">
              <textarea
                id="answer"
                rows={2}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending || isCompleted}
                placeholder="Напишите ответ здесь..."
                className="min-h-12 flex-1 resize-none rounded-lg border border-[#2E322E] bg-[#222522] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-[#D2FF52] disabled:opacity-50"
              />
              <Button
                type="submit"
                disabled={!answerText.trim() || isSending || isCompleted}
                aria-label="Отправить ответ"
                className="h-auto w-16 shrink-0 rounded-lg bg-[#D2FF52] text-black hover:bg-[#bce646] md:w-24"
              >
                <ArrowIcon />
              </Button>
            </div>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </form>
        </section>

        <aside className="space-y-4 rounded-2xl border border-[#2E322E] bg-[#1F221F] p-5">
          <h2 className="text-sm font-semibold">О собеседовании</h2>

          <div className="border-t border-[#2E322E] pt-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Позиция</p>
            <p className="mt-1 text-sm font-semibold">{interview.directionName || interview.direction}</p>
            <p className="text-xs text-gray-400">Уровень: {getLevelName(interview.levelCode || interview.levelName)}</p>
          </div>

          <div className="border-t border-[#2E322E] pt-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Этапы интервью</p>
            <QuestionSteps
              answeredCount={answeredCount}
              currentPosition={currentQuestion?.position}
              isCompleted={isCompleted}
            />
          </div>

          <div className="border-t border-[#2E322E] pt-4">
            <p className="text-sm font-semibold">Подсказка</p>
            <div className="mt-3 rounded-lg border border-[#2E322E] bg-[#262A26] p-3 text-xs leading-relaxed text-gray-400">
              Отвечай своими словами, как на реальном собеседовании. Если не знаешь ответа, расскажи, как бы стал разбираться.
            </div>
          </div>

          {!isCompleted && (
            <button
              type="button"
              onClick={handleFinishEarly}
              className="w-full border-t border-[#2E322E] pt-4 text-left text-xs text-gray-500 transition-colors hover:text-red-400"
            >
              Завершить интервью досрочно
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

export default InterviewPage;
