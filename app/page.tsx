"use client";

import React, { useContext, useState } from "react";
import { QuizProvider, QuizContext } from "./utils/aiService";
import Quiz from "./components/Quiz"; // 👈 we'll create this next

export default function Home() {
  return (
    <QuizProvider>
      <MainScreen />
    </QuizProvider>
  );
}

const MainScreen = () => {
  const context = useContext(QuizContext);
  const [input, setInput] = useState("");

  if (!context) return null;

  const { topic, setTopic } = context;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      setTopic(input.trim());
      setInput("");
    }
  };

  // ✅ If topic is selected, show the Quiz component instead of form
  if (topic.length>0) {
    return <Quiz />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-md rounded-lg p-6 w-full max-w-sm"
      >
        <h1 className="text-xl font-semibold mb-4 text-center text-gray-800">
          Enter a Quiz Topic
        </h1>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g., Science, History, Sports"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200 mb-4"
        />

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
        >
          Start Quiz
        </button>
      </form>
    </div>
  );
};
