import React, { createContext, useState, ReactNode, useContext } from "react";

type Quiz = {
  question: string;
  options: string[];
  answer: number;
  chosenAnswer?: number | null;
};

interface QuizContextType {
  topic: string;
  setTopic: React.Dispatch<React.SetStateAction<string>>;
  quizzes: Quiz[];
  setQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>>;
  selectAnswer: (quizIndex: number, optionIndex: number) => void;
}

export const QuizContext = createContext<QuizContextType | undefined>(undefined);

export const QuizProvider = ({ children }: { children: ReactNode }) => {
  const [topic, setTopic] = useState<string>("");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  // ✅ helper to update chosenAnswer
  const selectAnswer = (quizIndex: number, optionIndex: number) => {
    setQuizzes((prev) =>
      prev.map((quiz, i) =>
        i === quizIndex ? { ...quiz, chosenAnswer: optionIndex } : quiz
      )
    );
  };

  return (
    <QuizContext.Provider value={{ topic, setTopic, quizzes, setQuizzes, selectAnswer }}>
      {children}
    </QuizContext.Provider>
  );
};

export const useQuizzes = ()=>{
    const context = useContext(QuizContext);
    if (!context) {
    throw new Error("useQuizzes must be used within a quizprovider");
  }
  return context;
}



// pages/api/generate-questions.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenAI } from "@google/genai";

const apiKey = "AIzaSyAE_VkqCfci8CablRpvsd5CokNmuqV_bbQ";
if (!apiKey) {
  console.warn("GENAI_API_KEY not found in environment");
}

const ai = new GoogleGenAI({ apiKey });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { topic, count = 5 } = req.body as { topic?: string; count?: number };
  if (!topic || typeof topic !== "string") return res.status(400).json({ error: "Missing topic" });

  const prompt = `
You are a helpful assistant. Generate exactly ${count} multiple-choice questions (MCQs) about the topic "${topic}".

Return ONLY a **valid JSON array** (no explanatory text). The JSON must look like:
[
  {
    "question": "Question text?",
    "options": ["optA","optB","optC","optD"],
    "answer": 0
  },
  ...
]

Requirements:
- Exactly ${count} objects.
- Each "options" must be an array of 4 strings.
- "answer" must be an integer index 0..3 (correct option).
- No additional fields or text outside the JSON array.
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      // generationConfig: { temperature: 0.2, maxOutputTokens: 800 } // optional
    });

    const rawText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return res.status(502).json({ error: "No content from Gemini" });

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      // fallback: extract first JSON array substring
      const maybe = rawText.match(/\[[\s\S]*\]/);
      if (maybe) {
        try {
          parsed = JSON.parse(maybe[0]);
        } catch (e2) {
          console.error("Failed to parse extracted JSON", e2);
          return res.status(502).json({ error: "Failed to parse JSON from Gemini output" });
        }
      } else {
        console.error("Gemini returned non-JSON:", rawText);
        return res.status(502).json({ error: "Gemini returned non-JSON output" });
      }
    }

    if (!Array.isArray(parsed)) return res.status(502).json({ error: "Parsed response is not an array" });

    const quizzes = (parsed as any[]).slice(0, count).map((q) => ({
      question: String(q.question ?? "Untitled question"),
      options: Array.isArray(q.options) ? q.options.slice(0, 4).map(String) : ["", "", "", ""],
      answer: typeof q.answer === "number" ? q.answer : 0,
    }));

    return res.status(200).json({ quizzes });
  } catch (err: any) {
    console.error("generate-questions error:", err);
    return res.status(500).json({ error: err?.message ?? "unknown error" });
  }
}
