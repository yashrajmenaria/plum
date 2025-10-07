"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import { QuizContext } from "../utils/aiService";

const Quiz: React.FC = () => {
  // ---------- hooks (always called in the same order) ----------
  const context = useContext(QuizContext);

  const [index, setIndex] = useState<number>(0);
  const [finished, setFinished] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState<boolean>(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  // ---------------------------------------------------------------

  // if context missing, return early (this is safe because the hooks above always run)
  if (!context) return null;

  const { topic, quizzes, setQuizzes, selectAnswer, setTopic, fetchQuestions, getFeedback } = context as any;

  // Reset pagination when quizzes or topic change
  useEffect(() => {
    setIndex(0);
    setFinished(false);
    setAiFeedback(null);
    setFeedbackError(null);
  }, [quizzes, topic]);

  // Fetch questions when topic is set and quizzes empty
  useEffect(() => {
    const loadQuestions = async () => {
      if (!topic) return;
      if (quizzes && quizzes.length > 0) return;

      setLoading(true);
      setFetchError(null);

      try {
        // If you exposed fetchQuestions in context (recommended), use it. If not, call your API directly here.
        if (typeof fetchQuestions === "function") {
          await fetchQuestions(topic);
        } else {
          // fallback: direct fetch to /api/generate-questions
          const res = await fetch("/api/generate-questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, count: 5 }),
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt || `Failed to fetch: ${res.status}`);
          }
          const data = await res.json();
          const normalized = (data.quizzes ?? []).map((q: any) => ({
            question: String(q.question ?? "Untitled question"),
            options: Array.isArray(q.options) ? q.options.slice(0, 4).map(String) : ["", "", "", ""],
            answer: typeof q.answer === "number" ? q.answer : 0,
            chosenAnswer: null,
          }));
          setQuizzes(normalized);
        }
      } catch (err: any) {
        console.error("Error fetching questions:", err);
        setFetchError(err?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
    // intentionally depend on topic only; quizzes handled inside
  }, [topic]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived values (no hooks)
  const total = quizzes?.length ?? 0;
  const answeredCount = (quizzes ?? []).filter((q: any) => q.chosenAnswer != null).length;
  const correctCount = (quizzes ?? []).filter((q: any) => q.chosenAnswer === q.answer).length;

  // navigation handlers (no hooks)
  const goPrev = () => {
    setFinished(false);
    setIndex((i) => Math.max(0, i - 1));
  };

  const requestFeedback = async () => {
    setFeedbackLoading(true);
    setFeedbackError(null);
    setAiFeedback(null);
    try {
      if (typeof getFeedback === "function") {
        const result = await getFeedback();
        setAiFeedback(result.feedback ?? String(result));
      } else {
        // fallback direct call
        const res = await fetch("/api/generate-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, quizzes }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `Feedback fetch failed: ${res.status}`);
        }
        const data = await res.json();
        setAiFeedback(data.feedback ?? "No feedback available.");
      }
    } catch (err: any) {
      console.error("Feedback error:", err);
      setFeedbackError(err?.message ?? "Unable to generate feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  };

  const goNext = async () => {
    if (index === total - 1) {
      setFinished(true);
      await requestFeedback();
    } else {
      setIndex((i) => Math.min(total - 1, i + 1));
    }
  };

  const handleSelect = (optionIndex: number) => {
    selectAnswer(index, optionIndex);
  };

  const handleRestart = () => {
    setQuizzes([]);
    setTopic("");
    setAiFeedback(null);
    setFeedbackError(null);
  };

  // tabs
  const tabs = useMemo(() => Array.from({ length: total }, (_, i) => i), [total]);

  // ---------- rendering: safe because hooks are already declared above ----------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">Loading questions for "{topic}"…</div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Failed to load questions</h2>
          <p className="text-sm text-red-600 mb-4">{fetchError}</p>
          <button
            onClick={() => setQuizzes([])}
            className="px-4 py-2 rounded-md bg-blue-600 text-white"
          >
            Retry
          </button>
          <button onClick={() => setTopic("")} className="px-4 py-2 rounded-md ml-2 bg-gray-200">
            Change Topic
          </button>
        </div>
      </div>
    );
  }

  if (!quizzes || quizzes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No questions loaded</h2>
          <p className="text-sm text-gray-600">Please set a topic to fetch questions.</p>
        </div>
      </div>
    );
  }

  const current = quizzes[index];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-blue-700">Topic: {topic}</h1>
          <div className="mt-2 text-sm text-gray-600">
            Progress: {index + 1} / {total} • Answered: {answeredCount}
          </div>
        </header>

        <nav className="flex gap-2 flex-wrap mb-4">
          {tabs.map((t) => {
            const q = quizzes[t];
            const isActive = t === index;
            const isAnswered = q.chosenAnswer != null;
            return (
              <button
                key={t}
                onClick={() => {
                  setFinished(false);
                  setIndex(t);
                }}
                className={`px-3 py-1 rounded-md text-sm border ${
                  isActive
                    ? "bg-blue-600 text-white border-blue-600"
                    : isAnswered
                    ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
                title={`Question ${t + 1}`}
              >
                {t + 1}
              </button>
            );
          })}
        </nav>

        {!finished ? (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="font-semibold text-lg mb-4">
              {index + 1}. {current.question}
            </h2>

            <div className="space-y-3">
              {current.options.map((opt: string, i: number) => {
                const isChosen = current.chosenAnswer === i;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(i)}
                    className={`w-full text-left px-4 py-2 rounded-md border flex items-center justify-between
                      ${isChosen ? "bg-blue-500 text-white border-blue-500" : "bg-gray-100 hover:bg-gray-200 border-gray-300"}`}
                  >
                    <span>{opt}</span>
                    {isChosen && <span className="text-xs font-medium">Selected</span>}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={goPrev}
                disabled={index === 0}
                className={`px-4 py-2 rounded-md border ${index === 0 ? "opacity-50 cursor-not-allowed" : "bg-white hover:bg-gray-50"}`}
              >
                Prev
              </button>

              <div className="text-sm text-gray-600">
                Answered {answeredCount} / {total} • Correct so far: {correctCount}
              </div>

              <button onClick={goNext} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">
                {index === total - 1 ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <h2 className="text-xl font-semibold mb-2">Quiz Complete</h2>
            <p className="text-sm text-gray-600 mb-4">You answered {answeredCount} out of {total} questions.</p>

            <div className="mb-4">
              <div className="text-3xl font-bold">{correctCount} / {total}</div>
              <div className="text-sm text-gray-500">Correct answers</div>
            </div>

            <div className="space-x-3 mb-4">
              <button onClick={() => { setFinished(false); setIndex(0); }} className="px-4 py-2 rounded-md border bg-white hover:bg-gray-50">
                Review Answers
              </button>

              <button onClick={handleRestart} className="px-4 py-2 rounded-md bg-red-500 text-white hover:bg-red-600">
                Restart Quiz
              </button>
            </div>

            <div className="mt-4 text-left">
              <h3 className="font-semibold mb-2">AI Feedback</h3>
              {feedbackLoading ? (
                <div className="text-sm text-gray-600">Generating feedback…</div>
              ) : feedbackError ? (
                <div className="text-sm text-red-600">Failed to get feedback: {feedbackError}</div>
              ) : aiFeedback ? (
                <div className="prose max-w-none text-sm text-gray-800 whitespace-pre-wrap">{aiFeedback}</div>
              ) : (
                <div className="text-sm text-gray-600">No feedback yet.</div>
              )}
            </div>

            <div className="mt-6 text-left">
              {quizzes.map((q: any, qi: number) => {
                const user = q.chosenAnswer;
                const correct = q.answer;
                const isCorrect = user === correct;
                return (
                  <div key={qi} className="p-3 mb-2 rounded border">
                    <div className="font-medium">{qi + 1}. {q.question}</div>
                    <div className="text-sm mt-1">Your answer: {user == null ? <em>Not answered</em> : q.options[user]}</div>
                    <div className="text-sm">Correct answer: {q.options[correct]}</div>
                    <div className={`text-xs mt-1 ${isCorrect ? "text-green-700" : "text-red-700"}`}>{isCorrect ? "Correct" : "Incorrect"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Quiz;
