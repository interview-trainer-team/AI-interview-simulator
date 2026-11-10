import api from "./axios";

// Пока бэкенд не готов, работаем на моках (как в api/auth.js)
const USE_MOCK = true;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Уровни из справочника levels (модель данных 8.5)
export const LEVELS = [
  { code: "junior", name: "Junior" },
  { code: "middle", name: "Middle" },
];

// Ищем код уровня по введённому тексту: «junior», «Junior», «джун» и т.п.
export function findLevelCode(text) {
  const value = text.trim().toLowerCase();
  if (["junior", "джун", "джуниор"].includes(value)) return "junior";
  if (["middle", "мидл", "миддл"].includes(value)) return "middle";
  return null;
}

// Моковое хранилище интервью, живёт до перезагрузки страницы
const mockInterviews = new Map();

// Создание интервью → { interview }
// Формат запроса предварительный: уточнить по docs/api.md, когда он появится
export const createInterviewRequest = async ({ direction, levelCode, topics }) => {
  if (USE_MOCK) {
    await delay(800);
    const interview = {
      id: crypto.randomUUID(),
      direction,
      levelCode,
      topics,
      status: "CREATED",
      finishedEarly: false,
      totalScore: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    };
    mockInterviews.set(interview.id, interview);
    return { interview };
  }

  const response = await api.post("/interviews", { direction, levelCode, topics });
  return response.data;
};