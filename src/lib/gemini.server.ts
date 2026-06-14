import { GoogleGenAI, Schema } from "@google/genai";

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured yet. Please add your GEMINI_API_KEY in the Settings > Secrets panel."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

export async function transcribeAudioSermonServer(data: {
  audioBase64: string;
  mediaType: string;
}): Promise<string> {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [
      {
        inlineData: {
          data: data.audioBase64,
          mimeType: data.mediaType,
        },
      },
      {
        text: "You are a precise church sermon transcription assistant. Transcribe the supplied audio faithfully. Preserve the preacher's wording, paragraph breaks, Bible references, and changes of thought. Do not summarize, add commentary, or invent inaudible words. Mark genuinely unclear phrases as [inaudible]. Return only the transcript.",
      },
    ],
  });

  const transcript = response.text?.trim();
  if (!transcript) {
    throw new Error("The audio did not contain a readable sermon transcript.");
  }
  return transcript;
}

export async function summarizeSermonServer(data: {
  title?: string;
  preacher?: string;
  transcript: string;
}): Promise<string> {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [
      {
        text: `Create sermon notes from the transcript below.

Title: ${data.title || "Untitled sermon"}
Preacher: ${data.preacher || "Not provided"}

Use exactly these sections:
SERMON IN ONE SENTENCE
SUMMARY (2-4 short paragraphs)
KEY POINTS (5-8 numbered points)
SCRIPTURES MENTIONED (only references clearly present; otherwise say None clearly identified)
MEMORABLE QUOTES (up to 3, only close paraphrases from the transcript)
REFLECTION & ACTION (3 practical bullets)

TRANSCRIPT:
${data.transcript}`,
      },
    ],
    config: {
      systemInstruction:
        "You are an accurate church sermon editor for Love Assembly Area (RCCG). Preserve the preacher's meaning and tone. Never invent scripture references; if a reference is uncertain, say so. Produce polished, concise notes in plain text with clear headings.",
    },
  });

  const summary = response.text;
  if (!summary) {
    throw new Error("Gemini returned an empty summary.");
  }
  return summary;
}

export async function createSermonSlidesServer(data: {
  title?: string;
  preacher?: string;
  summary: string;
}): Promise<any> {
  const ai = getGeminiClient();

  const responseSchema: Schema = {
    type: "OBJECT" as any,
    properties: {
      slides: {
        type: "ARRAY" as any,
        items: {
          type: "OBJECT" as any,
          properties: {
            eyebrow: { type: "STRING" as any },
            title: { type: "STRING" as any },
            body: { type: "STRING" as any },
            scripture: { type: "STRING" as any },
          },
          required: ["eyebrow", "title", "body", "scripture"],
        },
      },
    },
    required: ["slides"],
  };

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [
      {
        text: `Create a coherent 6-8 slide church presentation from these sermon notes.

Title: ${data.title || "Sunday Sermon"}
Preacher: ${data.preacher || ""}

The first slide must welcome the congregation with the sermon title. The middle slides should each communicate one memorable idea. The final slide must be a short reflection or call to action. Keep body copy under 35 words per slide. Only include scripture when it is clearly present in the notes.

SERMON SUMMARY:
${data.summary}`,
      },
    ],
    config: {
      systemInstruction:
        "You are a senior church presentation editor for Love Assembly Area (RCCG). Turn sermon notes into concise, reverent, projection-ready slides. Preserve the preacher's meaning. Never invent Bible references.",
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
  });

  const jsonStr = response.text;
  if (!jsonStr) {
    throw new Error("Gemini returned an empty response for slides.");
  }
  return JSON.parse(jsonStr);
}
