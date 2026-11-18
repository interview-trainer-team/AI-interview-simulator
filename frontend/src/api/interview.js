import api from "./axios";

export const QUESTIONS_PER_INTERVIEW = 5;

export const LEVELS = [
  { code: "junior", name: "Junior" },
  { code: "middle", name: "Middle" },
];

export function getLevelName(code) {
  return LEVELS.find((level) => level.code === code)?.name || code;
}

export function findLevelCode(text) {
  const value = text.trim().toLowerCase();
  if (["junior", "джун", "джуниор"].includes(value)) return "junior";
  if (["middle", "мидл", "миддл"].includes(value)) return "middle";
  return null;
}

export function getLevelVerdict(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value < 5) return "BELOW";
  if (value >= 7.5) return "MATCH";
  return "PARTIAL";
}

export function getVerdictInfo(levelVerdict) {
  if (levelVerdict === "MATCH") {
    return { code: "MATCH", text: "Соответствует уровню", color: "#D2FF52" };
  }
  if (levelVerdict === "PARTIAL") {
    return { code: "PARTIAL", text: "Частично соответствует", color: "#F5C542" };
  }
  return { code: "BELOW", text: "Ниже уровня", color: "#F87171" };
}

function createApiError(message, code) {
  const error = new Error(message);
  if (code) error.code = code;
  return error;
}

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

function toInterviewListItem(interview) {
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
    answeredCount: interview.answeredCount ?? 0,
  };
}

function interviewSortTime(item) {
  return new Date(item.completedAt || item.createdAt || 0).getTime();
}

function normalizeInterviewList(data) {
  const raw = Array.isArray(data) ? data : data?.interviews || data?.items || [];
  return raw.map(toInterviewListItem).sort((a, b) => interviewSortTime(b) - interviewSortTime(a));
}

export const getDirectionsRequest = async () => {
  const response = await api.get("/directions");
  return response.data;
};

export const createInterviewRequest = async ({ directionCode, levelCode }) => {
  const response = await api.post("/interviews", { directionCode, levelCode });
  return response.data;
};

export const getInterviewRequest = async (interviewId) => {
  const response = await api.get(`/interviews/${interviewId}`);
  return { interview: response.data };
};

export const submitAnswerRequest = async (interviewId, questionId, answerText) => {
  const response = await api.post(`/interviews/${interviewId}/answers`, {
    questionId,
    answerText,
  });
  return {
    answer: response.data.answer || response.data,
    interview: response.data.interview || response.data,
  };
};

export const finishInterviewRequest = async (interviewId) => {
  const response = await api.post(`/interviews/${interviewId}/complete`);
  return { interview: response.data };
};

export const getInterviewResultsRequest = async (interviewId) => {
  try {
    const response = await api.get(`/interviews/${interviewId}/results`);
    return normalizeResults(response.data);
  } catch (error) {
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;
    if (status === 409 || code === "INTERVIEW_NOT_COMPLETED") {
      throw createApiError(
        error.response?.data?.error?.message || "Интервью ещё не завершено",
        "INTERVIEW_NOT_COMPLETED"
      );
    }
    throw error;
  }
};

export const getInterviewsRequest = async () => {
  const response = await api.get("/interviews");
  return { interviews: normalizeInterviewList(response.data) };
};
