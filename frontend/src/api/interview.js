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

// Вердикт по итоговому баллу (модель 8.5): MATCH ≥ 7.5, PARTIAL 5.0–7.4, BELOW < 5.0
export function getLevelVerdict(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value < 5) return "BELOW";
  if (value >= 7.5) return "MATCH";
  return "PARTIAL";
}

// Текст и цвет вердикта для экрана результатов
export function getVerdictInfo(levelVerdict) {
  if (levelVerdict === "MATCH") {
    return { code: "MATCH", text: "Соответствует уровню", color: "#D2FF52" };
  }
  if (levelVerdict === "PARTIAL") {
    return { code: "PARTIAL", text: "Частично соответствует", color: "#F5C542" };
  }
  return { code: "BELOW", text: "Ниже уровня", color: "#F87171" };
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

function createApiError(message, code) {
  const error = new Error(message);
  if (code) error.code = code;
  return error;
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

// Уникальные строки из списков (для тем и рекомендаций в обратной связи)
function uniqueTexts(lists, limit = 3) {
  const seen = new Set();
  const result = [];

  for (const list of lists) {
    for (const item of list || []) {
      const text = String(item).trim();
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(text);
      if (result.length >= limit) return result;
    }
  }

  return result;
}

function roundScore(value) {
  return Math.round(value * 10) / 10;
}

// Итоговый балл: среднее оценок данных ответов, один знак после запятой
function calcTotalScore(questions) {
  const answered = (questions || []).filter((question) => question.answer && question.answer.analysisStatus !== "FAILED");
  if (!answered.length) return 0;
  const sum = answered.reduce((total, question) => total + (Number(question.answer.score) || 0), 0);
  return roundScore(sum / answered.length);
}

// Список разборов для экрана результатов, включая неотвеченные вопросы
function buildAnswersFromQuestions(questions) {
  return (questions || []).map((question) => {
    const answer = question.answer;

    if (!answer) {
      return {
        questionId: question.id,
        position: question.position,
        questionText: question.text,
        answerText: null,
        score: null,
        criteria: null,
        strengths: [],
        weaknesses: [],
        recommendation: null,
        analysisStatus: null,
      };
    }

    const criteria = answer.criteria || {};
    return {
      questionId: question.id,
      position: question.position,
      questionText: question.text,
      answerText: answer.answerText,
      score: answer.score,
      criteria: {
        accuracy: criteria.accuracy ?? 0,
        completeness: criteria.completeness ?? 0,
        readability: criteria.readability ?? criteria.clarity ?? 0,
      },
      strengths: answer.strengths || [],
      weaknesses: answer.weaknesses || [],
      recommendation: answer.recommendation || null,
      analysisStatus: answer.analysisStatus || "DONE",
    };
  });
}

// Итоговая обратная связь по сохранённым ответам (мок вместо LLM)
function buildMockFeedback(interview) {
  const answers = (interview.questions || []).map((question) => question.answer).filter(Boolean);
  const totalScore = interview.totalScore ?? calcTotalScore(interview.questions);
  const levelName = getLevelName(interview.levelCode);
  const levelVerdict = getLevelVerdict(totalScore);

  const strongTopics = uniqueTexts(answers.map((answer) => answer.strengths));
  const weakTopics = uniqueTexts(answers.map((answer) => answer.weaknesses));
  const recommendations = uniqueTexts(answers.map((answer) => (answer.recommendation ? [answer.recommendation] : [])));

  if (interview.finishedEarly) {
    const unanswered = (interview.questions || []).filter((question) => !question.answer).length;
    if (unanswered > 0 && recommendations.length < 3) {
      recommendations.push("Стоит пройти интервью полностью, чтобы оценка была точнее.");
    }
  }

  let summary;
  if (!answers.length) {
    summary = `Интервью по направлению «${interview.direction}» на уровне ${levelName} завершено без ответов, поэтому оценить подготовку пока нельзя.`;
  } else if (levelVerdict === "MATCH") {
    summary = `По итогам интервью по направлению «${interview.direction}» на уровне ${levelName} ответы выглядят уверенно. Итоговый балл ${totalScore} из 10 соответствует выбранному уровню.`;
  } else if (levelVerdict === "PARTIAL") {
    summary = `По направлению «${interview.direction}» есть понимание основ, но ответы не всегда достаточно полные. Итоговый балл ${totalScore} из 10 частично соответствует уровню ${levelName}.`;
  } else {
    summary = `По ряду тем ответам не хватает точности и глубины. Итоговый балл ${totalScore} из 10 пока ниже уровня ${levelName}.`;
  }

  if (interview.finishedEarly) {
    summary += " Интервью завершено досрочно, оценка рассчитана только по данным ответам.";
  }

  return {
    status: "DONE",
    summary,
    strongTopics,
    weakTopics,
    recommendations,
    levelVerdict,
  };
}

// Приводим ответ API к единому виду { interview, answers, feedback }
function normalizeResults(data) {
  if (data?.interview) {
    const interview = data.interview;
    return {
      interview,
      answers: data.answers || buildAnswersFromQuestions(interview.questions),
      feedback: data.feedback ?? interview.feedback ?? null,
    };
  }

  const items = data.items || data.answers || [];
  const questions = items.map((item, index) => {
    const hasAnswer = item.answerText != null || item.score != null;
    const criteria = item.criteria || {};
    return {
      id: item.questionId || String(item.position ?? index + 1),
      position: item.position ?? index + 1,
      text: item.questionText || item.text,
      answer: hasAnswer
        ? {
            answerText: item.answerText,
            score: item.score,
            criteria: {
              accuracy: criteria.accuracy ?? 0,
              completeness: criteria.completeness ?? 0,
              readability: criteria.readability ?? criteria.clarity ?? 0,
            },
            strengths: item.strengths || [],
            weaknesses: item.weaknesses || [],
            recommendation: item.recommendation || null,
            analysisStatus: item.analysisStatus || "DONE",
          }
        : null,
    };
  });

  const levelCode =
    data.levelCode || findLevelCode(data.levelName || "") || (data.levelName || "").toLowerCase() || null;

  return {
    interview: {
      id: data.id,
      direction: data.directionName || data.direction,
      levelCode,
      status: data.status || "COMPLETED",
      finishedEarly: !!data.finishedEarly,
      totalScore: data.totalScore,
      createdAt: data.createdAt || data.completedAt || null,
      startedAt: data.startedAt || null,
      completedAt: data.completedAt || null,
      questions,
    },
    answers: buildAnswersFromQuestions(questions),
    feedback: data.feedback ?? null,
  };
}

// Краткая карточка интервью для списка истории
function toInterviewListItem(interview) {
  const questions = interview.questions || [];
  const answeredCount =
    interview.answeredCount ?? questions.filter((question) => question.answer).length;
  const levelCode =
    interview.levelCode || findLevelCode(interview.levelName || "") || (interview.levelName || "").toLowerCase() || null;

  return {
    id: interview.id,
    direction: interview.directionName || interview.direction,
    levelCode,
    status: interview.status,
    finishedEarly: !!interview.finishedEarly,
    totalScore: interview.totalScore ?? null,
    createdAt: interview.createdAt || null,
    completedAt: interview.completedAt || null,
    answeredCount,
  };
}

function interviewSortTime(item) {
  return new Date(item.completedAt || item.createdAt || 0).getTime();
}

// Приводим ответ списка API к виду { interviews }
function normalizeInterviewList(data) {
  const raw = Array.isArray(data) ? data : data?.interviews || data?.items || [];
  return raw.map(toInterviewListItem).sort((a, b) => interviewSortTime(b) - interviewSortTime(a));
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

// Результаты завершённого интервью → { interview, answers, feedback }
// Реальный путь по черновику docs/api.md: GET /interviews/:id/results
export const getInterviewResultsRequest = async (interviewId) => {
  if (USE_MOCK) {
    await delay(500);
    const store = loadMockStore();
    const interview = store[interviewId];
    if (!interview) throw createApiError("Интервью не найдено");

    // Незавершённое интервью отдаём как есть: страница сама вернёт на чат
    if (interview.status !== "COMPLETED") {
      return {
        interview,
        answers: buildAnswersFromQuestions(interview.questions),
        feedback: null,
      };
    }

    if (interview.totalScore == null) {
      interview.totalScore = calcTotalScore(interview.questions);
    }

    if (!interview.feedback) {
      interview.feedback = buildMockFeedback(interview);
      saveMockStore(store);
    }

    return {
      interview,
      answers: buildAnswersFromQuestions(interview.questions),
      feedback: interview.feedback,
    };
  }

  try {
    const response = await api.get(`/interviews/${interviewId}/results`);
    return normalizeResults(response.data);
  } catch (error) {
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;
    if (status === 409 || code === "INTERVIEW_NOT_COMPLETED") {
      throw createApiError(error.response?.data?.error?.message || "Интервью ещё не завершено", "INTERVIEW_NOT_COMPLETED");
    }
    throw error;
  }
};

// Список интервью для истории → { interviews }
// Реальный путь по черновику docs/api.md: GET /interviews
export const getInterviewsRequest = async () => {
  if (USE_MOCK) {
    await delay(500);
    const store = loadMockStore();
    const interviews = Object.values(store)
      .map(toInterviewListItem)
      .sort((a, b) => interviewSortTime(b) - interviewSortTime(a));
    return { interviews };
  }

  const response = await api.get("/interviews");
  return { interviews: normalizeInterviewList(response.data) };
};