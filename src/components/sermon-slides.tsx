import { ChevronLeft, ChevronRight, Expand, MonitorUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export interface SermonSlide {
  eyebrow: string;
  title: string;
  body: string;
  scripture?: string;
}

interface SermonSlidesProps {
  slides: SermonSlide[];
  sermonTitle: string;
  preacher: string;
  onClose: () => void;
}

export function SermonSlides({ slides, sermonTitle, preacher, onClose }: SermonSlidesProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const activeSlide = slides[activeIndex];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(slides.length - 1, index + 1));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
      }
      if (event.key === "Escape" && !document.fullscreenElement) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, slides.length]);

  if (!activeSlide) return null;

  const enterFullscreen = async () => {
    if (stageRef.current?.requestFullscreen) await stageRef.current.requestFullscreen();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-semibold">
            {sermonTitle || "Sermon slides"}
          </p>
          <p className="text-xs text-muted-foreground">
            {slides.length} slides{preacher ? ` · ${preacher}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={enterFullscreen}>
            <MonitorUp /> <span className="hidden sm:inline">Present</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close slides">
            <X />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="order-2 flex gap-3 overflow-x-auto border-t border-border bg-card p-3 lg:order-1 lg:w-60 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-t-0">
          {slides.map((slide, index) => (
            <Button
              key={`${slide.title}-${index}`}
              variant="ghost"
              onClick={() => setActiveIndex(index)}
              className={`h-auto w-48 shrink-0 justify-start rounded-xl p-2 text-left lg:w-full ${activeIndex === index ? "bg-secondary" : ""}`}
            >
              <span className="mr-2 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
              <span className="truncate text-xs font-semibold">{slide.title}</span>
            </Button>
          ))}
        </aside>

        <main className="order-1 grid min-h-0 flex-1 place-items-center overflow-hidden bg-muted p-3 sm:p-6 lg:order-2 lg:p-10">
          <div
            ref={stageRef}
            className="sermon-stage relative aspect-video w-full max-w-6xl overflow-hidden bg-sanctuary text-sanctuary-foreground shadow-2xl"
          >
            <div className="absolute inset-0 opacity-40" aria-hidden="true">
              <div className="absolute -right-[10%] -top-[30%] size-[70%] rounded-full border border-sanctuary-foreground/15" />
              <div className="absolute -right-[2%] -top-[18%] size-[48%] rounded-full border border-sanctuary-foreground/10" />
              <div className="absolute bottom-0 left-[8%] h-px w-[84%] bg-primary" />
            </div>
            <div className="relative flex h-full flex-col justify-between p-[6%]">
              <div className="flex items-center justify-between gap-6">
                <p className="slide-kicker text-primary">{activeSlide.eyebrow}</p>
                <p className="slide-chrome text-sanctuary-foreground/60">
                  LOVE ASSEMBLY AREA · RCCG
                </p>
              </div>
              <div className="max-w-[82%]">
                <h2 className="slide-title font-display font-medium text-balance">
                  {activeSlide.title}
                </h2>
                <p className="slide-body mt-[3%] max-w-[85%] text-sanctuary-foreground/80">
                  {activeSlide.body}
                </p>
                {activeSlide.scripture && (
                  <p className="slide-caption mt-[3%] font-semibold text-primary">
                    {activeSlide.scripture}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between text-sanctuary-foreground/55">
                <p className="slide-chrome">SERMON SCRIBE</p>
                <p className="slide-chrome tabular-nums">
                  {String(activeIndex + 1).padStart(2, "0")} /{" "}
                  {String(slides.length).padStart(2, "0")}
                </p>
              </div>

              <div className="absolute bottom-[5%] left-1/2 flex -translate-x-1/2 gap-2 opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100">
                <Button
                  variant="quiet"
                  size="icon"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
                  aria-label="Previous slide"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="quiet"
                  size="icon"
                  onClick={enterFullscreen}
                  aria-label="Full screen"
                >
                  <Expand />
                </Button>
                <Button
                  variant="quiet"
                  size="icon"
                  disabled={activeIndex === slides.length - 1}
                  onClick={() => setActiveIndex((index) => Math.min(slides.length - 1, index + 1))}
                  aria-label="Next slide"
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
