import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SermonInput = z.object({
  transcript: z.string().trim().min(80).max(120_000),
  title: z.string().trim().max(120).optional(),
  preacher: z.string().trim().max(100).optional(),
});

const SlideInput = SermonInput.extend({
  summary: z.string().trim().min(80).max(40_000),
});

const AudioInput = z.object({
  audioBase64: z.string().min(1).max(28_000_000),
  mediaType: z
    .string()
    .regex(/^audio\/[a-z0-9.+-]+$/i)
    .max(100),
  filename: z.string().trim().min(1).max(180),
});

const SermonSlide = z.object({
  eyebrow: z.string().trim().max(40),
  title: z.string().trim().max(90),
  body: z.string().trim().max(260),
  scripture: z.string().trim().max(100).optional().default(""),
});

const SermonDeck = z.object({
  slides: z.array(SermonSlide).min(5).max(8),
});

export const transcribeSermonAudio = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AudioInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const { transcribeAudioSermonServer } = await import("./gemini.server");
      const transcript = await transcribeAudioSermonServer(data);
      return { transcript };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Audio transcription failed.";
      if (message.includes("402"))
        throw new Error("AI credits are exhausted. Please add credits and try again.");
      if (message.includes("429"))
        throw new Error("The AI service is busy. Please wait a moment and try again.");
      if (message.includes("not configured") || message.includes("configured yet")) throw error;
      throw new Error(
        `We could not transcribe that recording: ${message}. Try an MP3, WAV, M4A, or WebM file under 20 MB.`,
      );
    }
  });

export const summarizeSermon = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SermonInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const { summarizeSermonServer } = await import("./gemini.server");
      const summary = await summarizeSermonServer(data);
      return { summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Summary generation failed.";
      if (message.includes("402"))
        throw new Error("AI credits are exhausted. Please add credits and try again.");
      if (message.includes("429"))
        throw new Error("The AI service is busy. Please wait a moment and try again.");
      throw new Error(`We could not create the summary: ${message}. Your transcript is safe—please try again.`);
    }
  });

export const createSermonSlides = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SlideInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const { createSermonSlidesServer } = await import("./gemini.server");
      const parsedSlides = await createSermonSlidesServer(data);
      return SermonDeck.parse(parsedSlides);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Slide generation failed.";
      if (message.includes("402"))
        throw new Error("AI credits are exhausted. Please add credits and try again.");
      if (message.includes("429"))
        throw new Error("The AI service is busy. Please wait a moment and try again.");
      throw new Error(
        `We could not create the slides: ${message}. Your sermon notes are safe—please try again.`,
      );
    }
  });
