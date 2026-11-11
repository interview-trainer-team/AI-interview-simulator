import api from "./axios";

// Пока бэкенд не готов, работаем на моках (как в api/auth.js)
const USE_MOCK = true;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Количество вопросов в интервью (модель данных 8.5)
export const QUESTIONS_PER_INTERVIEW = 5;

// Уровни из справочника levels
export const LEVELS = [
  { code: "junior", name: "Junior" },
  { code: "middle", name: "Middle" },
];

// Название уровня по коду: "junior" → "Junior"
export function getLevelName(code) {
  return LEVELS.find((level) => level.code === code)?.name || code;
}

// Ищем код уровня по введённому тексту: «junior», «Junior», «джун» и т.п.
export function findLevelCode(text) {
  const value = text.trim().toLowerCase();
  if (["junior", "джун", "джуниор"].includes(value)) return "junior";
  if (["middle", "мидл", "миддл"].includes(value)) return "middle";
  return null;
}

// ---------- МОК-ХРАНИЛИЩЕ ----------
// Храним моковые интервью в localStorage, чтобы они переживали перезагрузку страницы

const STORAGE_KEY = "mockInterviews";

function loadMockStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveMockStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function createApiError(message) {
  return new Error(message);
}

// Моковая база вопросов
const MOCK_QUESTIONS = [
  "Что такое замыкание (closure) в JavaScript и в каких ситуациях его можно использовать?",
  "Чем отличаются let, const и var?",
  "Что такое DOM и как с ним работать из JavaScript?",
  "Для чего нужны ключи (key) при отрисовке списков в React?",
  "Что такое Promise и чем async/await отличается от then?",
];

// Простая имитация оценки ИИ: чем подробнее ответ, тем выше балл
function mockAnalyzeAnswer(answerText) {
  const score = Math.min(10, 3 + Math.floor(answerText.trim().length / 40));
  return {
    score,
    criteria: { accuracy: score, completeness: Math.max(0, score - 1), readability: Math.min(10, score + 1) },
    strengths: score >= 6 ? ["Понимание основной идеи"] : [],
    weaknesses: score < 8 ? ["Не хватает примера из практики"] : [],
    recommendation:
      score >= 8
        ? "Отличный ответ. Можно добавить пример из реального проекта."
        : "Ответ верный по сути, но стоит раскрыть тему подробнее и привести пример кода.",
  };
}

// ---------- ЗАПРОСЫ ----------
// Форматы запросов и ответов предварительные: уточнить по docs/api.md

// Создание интервью → { interview }
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
      // 5 вопросов интервью в заданном порядке (interview_questions)
      questions: MOCK_QUESTIONS.map((text, index) => ({
        id: crypto.randomUUID(),
        position: index + 1,
        text,
        answer: null,
      })),
    };
    const store = loadMockStore();
    store[interview.id] = interview;
    saveMockStore(store);
    return { interview };
  }

  const response = await api.post("/interviews", { direction, levelCode, topics });
  return response.data;
};

// Интервью с вопросами и уже данными ответами → { interview }
export const getInterviewRequest = async (interviewId) => {
  if (USE_MOCK) {
    await delay(500);
    const store = loadMockStore();
    const interview = store[interviewId];
    if (!interview) throw createApiError("Интервью не найдено");

    // CREATED → IN_PROGRESS, когда пользователь получил первый вопрос
    if (interview.status === "CREATED") {
      interview.status = "IN_PROGRESS";
      interview.startedAt = new Date().toISOString();
      saveMockStore(store);
    }
    return { interview };
  }

  const response = await api.get(`/interviews/${interviewId}`);
  return response.data;
};

// Отправка ответа на вопрос → { answer, interview }
export const submitAnswerRequest = async (interviewId, questionId, answerText) => {
  if (USE_MOCK) {
    await delay(1500); // имитация анализа ответа ИИ
    const store = loadMockStore();
    const interview = store[interviewId];
    if (!interview) throw createApiError("Интервью не найдено");

    const question = interview.questions.find((q) => q.id === questionId);
    if (!question) throw createApiError("Вопрос не найден");
    if (question.answer) throw createApiError("На этот вопрос уже дан ответ");

    const answer = {
      id: crypto.randomUUID(),
      answerText,
      analysisStatus: "DONE",
      ...mockAnalyzeAnswer(answerText),
      createdAt: new Date().toISOString(),
      analyzedAt: new Date().toISOString(),
    };
    question.answer = answer;

    // Все 5 ответов получены → интервью завершено
    const answered = interview.questions.filter((q) => q.answer);
    if (answered.length === interview.questions.length) {
      interview.status = "COMPLETED";
      interview.completedAt = new Date().toISOString();
      const sum = answered.reduce((total, q) => total + q.answer.score, 0);
      interview.totalScore = Math.round((sum / answered.length) * 10) / 10;
    }

    saveMockStore(store);
    return { answer, interview };
  }

  const response = await api.post(`/interviews/${interviewId}/answers`, { questionId, answerText });
  return response.data;
};

// Досрочное завершение интервью (UC-008) → { interview }
export const finishInterviewRequest = async (interviewId) => {
  if (USE_MOCK) {
    await delay(600);
    const store = loadMockStore();
    const interview = store[interviewId];
    if (!interview) throw createApiError("Интервью не найдено");

    const answered = interview.questions.filter((q) => q.answer);
    interview.status = "COMPLETED";
    interview.finishedEarly = true;
    interview.completedAt = new Date().toISOString();
    interview.totalScore = answered.length
      ? Math.round((answered.reduce((t, q) => t + q.answer.score, 0) / answered.length) * 10) / 10
      : 0;

    saveMockStore(store);
    return { interview };
  }

  const response = await api.post(`/interviews/${interviewId}/finish`);
  return response.data;
};