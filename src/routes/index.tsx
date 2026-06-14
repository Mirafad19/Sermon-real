import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  FileAudio,
  FileText,
  Info,
  Mic,
  Presentation,
  Radio,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SermonSlides, type SermonSlide } from "@/components/sermon-slides";
import { Textarea } from "@/components/ui/textarea";
import { createSermonSlides, summarizeSermon, transcribeSermonAudio } from "@/lib/sermon.functions";

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
  resultIndex: number;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const waveHeights = ["h-4", "h-7", "h-10", "h-6", "h-12", "h-8", "h-5"];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sermon Scribe | Record & Summarize Sermons" },
      {
        name: "description",
        content:
          "Record, transcribe, and summarize sermons in minutes for Love Assembly Area (RCCG).",
      },
      { property: "og:title", content: "Sermon Scribe" },
      {
        property: "og:description",
        content: "A fast, focused sermon recording and notes desk for Love Assembly Area.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const summarize = useServerFn(summarizeSermon);
  const createSlides = useServerFn(createSermonSlides);
  const transcribeAudio = useServerFn(transcribeSermonAudio);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const shouldListenRef = useRef(false);

  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [summary, setSummary] = useState("");
  const [title, setTitle] = useState("");
  const [preacher, setPreacher] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [error, setError] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isCreatingSlides, setIsCreatingSlides] = useState(false);
  const [isTranscribingUpload, setIsTranscribingUpload] = useState(false);
  const [uploadedAudioName, setUploadedAudioName] = useState("");
  const [slides, setSlides] = useState<SermonSlide[]>([]);
  const [showSlides, setShowSlides] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCompressionHelp, setShowCompressionHelp] = useState(false);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const startRecording = async () => {
    setError("");
    setSummary("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      setSeconds(0);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl("");

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setAudioUrl(URL.createObjectURL(blob));
      };
      recorder.start(1000);
      recorderRef.current = recorder;

      const browserWindow = window as typeof window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };
      const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
      if (!Recognition) {
        recorder.stop();
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Live transcription needs Chrome or Edge on this device.");
      }

      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-NG";
      recognition.onresult = (event) => {
        let finalText = "";
        let liveText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (!result) continue;
          if (result.isFinal) finalText += `${result[0].transcript.trim()} `;
          else liveText += result[0].transcript;
        }
        if (finalText)
          setTranscript((current) => `${current}${current ? " " : ""}${finalText}`.trim());
        setInterim(liveText);
      };
      recognition.onerror = (event) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
          setError(`Transcription paused: ${event.error}. The audio recording is still safe.`);
        }
      };
      recognition.onend = () => {
        if (shouldListenRef.current) {
          try {
            recognition.start();
          } catch {
            /* already restarting */
          }
        }
      };
      shouldListenRef.current = true;
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not access the microphone.");
    }
  };

  const stopRecording = () => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setInterim("");
    setIsRecording(false);
  };

  const uploadAudio = async (file: File) => {
    const maxBytes = 24 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(
        "That recording is over 24 MB. Serverless container channels restrict uploads to 24 MB maximum. Please click 'Compress tips' below to easily shrink your full sermon under 24 MB!"
      );
      setShowCompressionHelp(true);
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    const fallbackTypes: Record<string, string> = {
      mp3: "audio/mpeg",
      wav: "audio/wav",
      m4a: "audio/mp4",
      mp4: "audio/mp4",
      webm: "audio/webm",
      ogg: "audio/ogg",
    };
    const mediaType = file.type || (extension ? fallbackTypes[extension] : undefined);
    if (!mediaType?.startsWith("audio/")) {
      setError("Please choose an MP3, WAV, M4A, OGG, or WebM audio recording.");
      return;
    }

    setError("");
    setIsTranscribingUpload(true);
    setUploadedAudioName(file.name);
    try {
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("We could not read that audio file."));
        reader.onload = () => {
          const value = typeof reader.result === "string" ? reader.result : "";
          const encoded = value.split(",")[1];
          if (!encoded) reject(new Error("We could not read that audio file."));
          else resolve(encoded);
        };
        reader.readAsDataURL(file);
      });
      const result = await transcribeAudio({
        data: { audioBase64, mediaType, filename: file.name },
      });
      setTranscript(result.transcript);
      setInterim("");
      setSummary("");
      setSlides([]);
    } catch (caught) {
      setUploadedAudioName("");
      setError(caught instanceof Error ? caught.message : "We could not transcribe the audio.");
    } finally {
      setIsTranscribingUpload(false);
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  };

  const generateSummary = async () => {
    if (transcript.trim().length < 80) {
      setError("Record or paste a little more of the sermon before creating notes.");
      return;
    }
    setError("");
    setIsSummarizing(true);
    try {
      const result = await summarize({ data: { transcript, title, preacher } });
      setSummary(result.summary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not create the summary.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const generateSlides = async () => {
    if (!summary) return;
    setError("");
    setIsCreatingSlides(true);
    try {
      const result = await createSlides({ data: { transcript, summary, title, preacher } });
      setSlides(result.slides);
      setShowSlides(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not create the slides.");
    } finally {
      setIsCreatingSlides(false);
    }
  };

  const downloadText = (text: string, name: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-full bg-sanctuary text-sanctuary-foreground shadow-sm">
              <BookOpen className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-display text-xl font-semibold leading-none">Sermon Scribe</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Love Assembly Area · RCCG
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="hidden gap-2 rounded-full bg-accent px-3 py-1.5 text-accent-foreground sm:flex"
          >
            <CheckCircle2 className="size-3.5" /> Recording saved on this device
          </Badge>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <section className="mb-7 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Sunday service workspace
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              From the pulpit to clear notes, while the message is still fresh.
            </h1>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground lg:text-right">
            Connect the pastor’s audio cable, choose it as your computer’s microphone, then press
            record. Sermon Scribe handles the rest.
          </p>
        </section>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-3xl bg-sanctuary text-sanctuary-foreground shadow-xl">
              <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Radio className="size-4" /> Audio desk
                  </span>
                  {isRecording ? (
                    <span className="flex items-center gap-2 rounded-full bg-live px-3 py-1 text-xs font-bold text-live-foreground">
                      <span className="live-dot size-2 rounded-full bg-live-foreground" /> LIVE
                    </span>
                  ) : (
                    <span className="rounded-full border border-sanctuary-foreground/20 px-3 py-1 text-xs">
                      Ready
                    </span>
                  )}
                </div>

                <div className="my-10 text-center">
                  <p className="font-display text-6xl font-medium tabular-nums sm:text-7xl">
                    {elapsed}
                  </p>
                  <p className="mt-3 text-sm text-sanctuary-foreground/65">
                    {isRecording ? "Listening and transcribing" : "Waiting for the sermon"}
                  </p>
                  <div
                    className="mx-auto mt-7 flex h-14 max-w-sm items-center justify-center gap-1"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 29 }, (_, index) => (
                      <span
                        key={index}
                        className={`w-1 rounded-full bg-primary-foreground ${waveHeights[index % waveHeights.length]} ${isRecording ? "wave-bar opacity-85" : "opacity-20"}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {isRecording ? (
                    <Button variant="recorder" size="xl" className="flex-1" onClick={stopRecording}>
                      <Square className="fill-current" /> Stop & save
                    </Button>
                  ) : (
                    <Button
                      variant="recorder"
                      size="xl"
                      className="flex-1"
                      onClick={startRecording}
                    >
                      <Mic /> Start recording
                    </Button>
                  )}
                  {audioUrl && !isRecording && (
                    <Button variant="quiet" size="xl" asChild>
                      <a
                        href={audioUrl}
                        download={`sermon-${new Date().toISOString().slice(0, 10)}.webm`}
                      >
                        <Download /> Audio
                      </a>
                    </Button>
                  )}
                </div>
                <div className="mt-4 rounded-2xl border border-sanctuary-foreground/15 bg-background/5 p-4 animate-fade-in">
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/mp4,audio/webm,audio/ogg,.mp3,.wav,.m4a,.webm,.ogg"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAudio(file);
                    }}
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-sanctuary-foreground/10">
                        <FileAudio className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">Already recorded the sermon?</p>
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs text-sanctuary-foreground/60">
                            {uploadedAudioName || "Format: MP3, WAV, M4A, OGG, WebM · up to 24 MB"}
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowCompressionHelp(!showCompressionHelp)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary-foreground underline hover:opacity-85 transition-opacity"
                            title="Tips to compress long audio files"
                          >
                            <Info className="size-3" /> Compress tips
                          </button>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="quiet"
                      size="sm"
                      disabled={isRecording || isTranscribingUpload}
                      onClick={() => audioInputRef.current?.click()}
                    >
                      <Upload />
                      {isTranscribingUpload ? "Transcribing…" : "Upload audio"}
                    </Button>
                  </div>

                  {showCompressionHelp && (
                    <div className="mt-4 border-t border-sanctuary-foreground/10 pt-4 text-xs text-sanctuary-foreground/80 space-y-3 animate-fade-in">
                      <p className="font-semibold text-primary-foreground flex items-center gap-1.5">
                        💡 How to fit a 1+ hour sermon under 24 MB:
                      </p>
                      <ul className="list-disc list-inside space-y-2 pl-1 bg-background/10 rounded-xl p-3 border border-sanctuary-foreground/5 text-sanctuary-foreground/75">
                        <li>
                          <strong className="text-primary-foreground">Choose Mono, NOT Stereo:</strong> Sermons are voice-only. Converting stereo to mono instantly cuts your file size in half without any clarity loss!
                        </li>
                        <li>
                          <strong className="text-primary-foreground">Lower the Bitrate:</strong> Speech has low complexity. Encoding at <span className="font-mono bg-background/20 px-1 py-0.5 rounded text-white text-[10px]">32 kbps</span> or <span className="font-mono bg-background/20 px-1 py-0.5 rounded text-white text-[10px]">64 kbps</span> mono can make a 1-hour sermon as small as 14 MB (instead of 100+ MB) while sounding perfect to Gemini!
                        </li>
                        <li>
                          <strong className="text-primary-foreground">Use Space-Saving Formats:</strong> Convert your audio to <span className="font-mono bg-background/20 px-1.5 py-0.5 rounded text-white">MP3</span>, <span className="font-mono bg-background/20 px-1.5 py-0.5 rounded text-white">M4A</span>, or <span className="font-mono bg-background/20 px-1.5 py-0.5 rounded text-white">OGG/WebM</span>.
                        </li>
                        <li>
                          <span className="font-semibold text-primary-foreground">Recommended free tools:</span> drag and drop your file into{" "}
                          <a
                            href="https://123apps.com/audio-converter"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-primary-foreground font-semibold hover:opacity-85"
                          >
                            123apps Audio Converter
                          </a>{" "}
                          to compress online instantly, or use free software like{" "}
                          <a
                            href="https://www.audacityteam.org/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-primary-foreground font-semibold hover:opacity-85"
                          >
                            Audacity
                          </a> on your laptop.
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-sanctuary-foreground/10 bg-background/5 px-6 py-4 text-xs leading-5 text-sanctuary-foreground/70 sm:px-8">
                <strong className="text-sanctuary-foreground">Before service:</strong> In your
                laptop sound settings, select the cable from the pastor’s mixer as the input
                microphone.
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-full bg-secondary text-secondary-foreground">
                  <FileText className="size-4" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Service details</h2>
                  <p className="text-xs text-muted-foreground">
                    Optional, but helpful for the notes
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Sermon title"
                  aria-label="Sermon title"
                />
                <Input
                  value={preacher}
                  onChange={(event) => setPreacher(event.target.value)}
                  placeholder="Preacher’s name"
                  aria-label="Preacher's name"
                />
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-3xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-7">
              <div>
                <h2 className="text-2xl font-semibold">Live transcript</h2>
                <p className="text-sm text-muted-foreground">
                  You can correct any words before creating notes.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!transcript}
                  onClick={() => downloadText(transcript, "sermon-transcript.txt")}
                >
                  <Download /> Export
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!transcript || isRecording}
                  onClick={() => {
                    setTranscript("");
                    setSummary("");
                  }}
                >
                  <Trash2 /> Clear
                </Button>
              </div>
            </div>
            <div className="p-5 sm:p-7">
              <Textarea
                value={`${transcript}${interim ? `${transcript ? " " : ""}${interim}` : ""}`}
                onChange={(event) => {
                  setTranscript(event.target.value);
                  setInterim("");
                }}
                placeholder="Your sermon transcript will appear here as the pastor speaks… You can also paste an existing transcript."
                className="min-h-[360px] resize-y border-0 bg-muted/55 p-5 text-base leading-8 shadow-none focus-visible:ring-1 sm:min-h-[430px]"
              />
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {transcript.trim()
                    ? `${transcript.trim().split(/\s+/).length.toLocaleString()} words captured`
                    : "No words captured yet"}
                </span>
                {isRecording && <span className="font-semibold text-live">Transcribing live…</span>}
              </div>
              <Button
                className="mt-6 h-14 w-full rounded-2xl text-base"
                onClick={generateSummary}
                disabled={isSummarizing || transcript.trim().length < 80}
              >
                <FileText /> {isSummarizing ? "Creating sermon notes…" : "Create sermon summary"}
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                AI-powered notes
              </p>
              <h2 className="mt-1 text-2xl font-semibold">Sermon summary</h2>
            </div>
            {summary && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={slides.length ? () => setShowSlides(true) : generateSlides}
                  disabled={isCreatingSlides}
                >
                  <Presentation />
                  {isCreatingSlides
                    ? "Designing slides…"
                    : slides.length
                      ? "Open slides"
                      : "Make slides"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(summary);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1800);
                  }}
                >
                  <Copy /> {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadText(summary, "sermon-summary.txt")}
                >
                  <Download /> Export
                </Button>
              </div>
            )}
          </div>
          <div className="min-h-64 p-5 sm:p-8">
            {summary ? (
              <div className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">
                {summary}
              </div>
            ) : (
              <div className="grid min-h-52 place-items-center text-center">
                <div>
                  <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-secondary text-secondary-foreground">
                    <Presentation className="size-5" />
                  </div>
                  <h3 className="text-xl font-semibold">The finished notes will appear here</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    You’ll receive a faithful summary, key message points, scriptures mentioned,
                    memorable quotes, and practical action steps.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
      {showSlides && slides.length > 0 && (
        <SermonSlides
          slides={slides}
          sermonTitle={title || "Sunday Sermon"}
          preacher={preacher}
          onClose={() => setShowSlides(false)}
        />
      )}
    </main>
  );
}
