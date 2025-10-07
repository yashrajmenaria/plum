// app/api/generate-questions/route.ts
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

type Q = { question: string; options: string[]; answer: number };

const apiKey = "AIzaSyAE_VkqCfci8CablRpvsd5CokNmuqV_bbQ";
if (!apiKey) {
  console.warn("GENAI_API_KEY not set - add it to .env.local");
}

const ai = new GoogleGenAI({ apiKey });

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const count = Number(body.count) || 5;

    if (!topic) {
      return NextResponse.json({ error: "Missing topic" }, { status: 400 });
    }

    const prompt = `
You are a helpful assistant. Generate exactly ${count} multiple-choice questions (MCQs) about the topic "${topic}".

Return ONLY a valid JSON array (no explanatory text). The JSON must look like:
[
  {
    "question": "Question text?",
    "options": ["optA","optB","optC","optD"],
    "answer": 0
  },
  ...
]

Requirements:
- Provide exactly ${count} objects.
- Each "options" must be an array of 4 strings.
- "answer" must be an integer index 0..3 (the correct option).
- Do NOT include any additional fields or text outside the JSON array.
`.trim();

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
    if (!rawText) {
      console.error("No content from Gemini:", response);
      return NextResponse.json({ error: "No content from Gemini" }, { status: 502 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      // fallback: extract first JSON array substring
      const maybe = rawText.match(/\[[\s\S]*\]/);
      if (maybe) {
        try {
          parsed = JSON.parse(maybe[0]);
        } catch (e2) {
          console.error("Failed parsing extracted JSON:", e2, "raw:", rawText);
          return NextResponse.json({ error: "Failed to parse JSON from Gemini output" }, { status: 502 });
        }
      } else {
        console.error("Gemini returned non-JSON:", rawText);
        return NextResponse.json({ error: "Gemini returned non-JSON output" }, { status: 502 });
      }
    }

    if (!Array.isArray(parsed)) {
      console.error("Parsed response is not an array:", parsed);
      return NextResponse.json({ error: "Parsed response is not an array" }, { status: 502 });
    }

    const quizzes: Q[] = (parsed as any[])
      .slice(0, count)
      .map((q: any) => ({
        question: String(q?.question ?? "").trim() || "Untitled question",
        options: Array.isArray(q?.options) ? q.options.slice(0, 4).map(String) : ["", "", "", ""],
        answer: typeof q?.answer === "number" && q.answer >= 0 && q.answer < 4 ? q.answer : 0,
      }));

    return NextResponse.json({ quizzes }, { status: 200 });
  } catch (err: any) {
    console.error("generate-questions error:", err);
    return NextResponse.json({ error: err?.message ?? "unknown error" }, { status: 500 });
  }
}
