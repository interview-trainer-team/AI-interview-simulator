import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { createInterviewRequest, getDirectionsRequest, findLevelCode } from "@/api/interview";

const inputClass =
  "h-12 rounded-lg border-[#2E322E] bg-[#222522] px-4 text-sm text-white placeholder:text-gray-500 focus-visible:border-[#D2FF52] focus-visible:ring-[#D2FF52]/40";

const selectClass =
  "h-12 w-full rounded-lg border border-[#2E322E] bg-[#222522] px-4 text-sm text-white focus:border-[#D2FF52] focus:outline-none focus:ring-2 focus:ring-[#D2FF52]/40";

function Field({ id, label, hint, error, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold text-[#D2FF52]">
        {label}
      </Label>
      <p className="text-[11px] text-gray-400">{hint}</p>
      {children}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 7h17M12 1l6 6-6 6" />
    </svg>
  );
}

function InterviewSetupPage() {
  const [directions, setDirections] = useState([]);
  const [directionCode, setDirectionCode] = useState("");
  const [level, setLevel] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDirections, setIsLoadingDirections] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    getDirectionsRequest()
      .then((data) => {
        setDirections(data.directions || []);
      })
      .catch(() => {
        setError("Не удалось загрузить список направлений");
      })
      .finally(() => setIsLoadingDirections(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const errors = {};
    if (!directionCode) errors.directionCode = "Выбери IT-направление";

    const levelCode = findLevelCode(level);
    if (!level.trim()) errors.level = "Укажи уровень подготовки";
    else if (!levelCode) errors.level = "Доступны уровни Junior и Middle";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    try {
      const data = await createInterviewRequest({
        directionCode,
        levelCode,
      });
      navigate(`/interview/${data.id}`);
    } catch (err) {
      if (err.details?.fields) {
        setFieldErrors(err.details.fields);
      } else {
        setError(err.message || "Не удалось создать интервью");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[790px]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D2FF52]">
        Перед началом собеседования
      </p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">Настройка интервью</h1>
      <p className="mt-3 text-sm text-gray-400">
        Заполни данные, чтобы ИИ подобрал вопросы для твоего уровня подготовки.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="mt-8 rounded-2xl border border-[#2E322E] bg-[#1F221F] p-5 md:p-6">
          <h2 className="text-base font-semibold">Данные для интервью</h2>
          <p className="mt-3 text-xs text-gray-400">
            Укажи направление и уровень — эти данные помогут сформировать подходящие технические вопросы.
          </p>

          <div className="mt-8 space-y-9">
            <Field
              id="directionCode"
              label="IT-направление"
              hint="Выбери направление собеседования"
              error={fieldErrors.directionCode}
            >
              <select
                id="directionCode"
                value={directionCode}
                onChange={(e) => setDirectionCode(e.target.value)}
                className={selectClass}
                disabled={isLoadingDirections}
              >
                <option value="">
                  {isLoadingDirections ? "Загружаем..." : "Выбери направление"}
                </option>
                {directions.map((dir) => (
                  <option key={dir.code} value={dir.code}>
                    {dir.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              id="level"
              label="Уровень подготовки"
              hint="Укажи свой текущий уровень знаний и опыта."
              error={fieldErrors.level}
            >
              <input
                id="level"
                type="text"
                placeholder="Например, Junior или Middle"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        {error && <p className="mt-4 text-sm font-medium text-red-500">{error}</p>}

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <p className="pt-1 text-[11px] text-gray-400 sm:pl-2">
            Интервью состоит из 5 вопросов. После каждого ответа ИИ даст оценку и рекомендации.
          </p>
          <Button
            type="submit"
            disabled={isLoading || isLoadingDirections}
            className="h-12 w-full shrink-0 gap-4 rounded-lg bg-[#D2FF52] px-6 text-sm font-semibold text-black hover:bg-[#bce646] sm:w-auto"
          >
            {isLoading ? "Создаём..." : "Начать интервью"}
            <ArrowIcon />
          </Button>
        </div>
      </form>
    </div>
  );
}

export default InterviewSetupPage;
