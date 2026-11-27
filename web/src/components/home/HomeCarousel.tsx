"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const holdMs = 5000;
const transitionMs = 2000;

export function HomeCarousel({ children, label, autoplay = false }: { children: ReactNode[]; label: string; autoplay?: boolean }) {
  const [slide, setSlide] = useState({ index: 0, previous: -1, direction: 1 });
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const count = children.length;

  useEffect(() => {
    if (!autoplay || paused || hovered || focused || count < 2) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;

    const timer = window.setTimeout(() => {
      if (motion.matches) return;
      setSlide(({ index }) => ({ index: (index + 1) % count, previous: index, direction: 1 }));
    }, holdMs + (slide.previous < 0 ? 0 : transitionMs));
    return () => window.clearTimeout(timer);
  }, [autoplay, count, focused, hovered, paused, slide]);

  function move(offset: number) {
    setSlide(({ index }) => {
      const next = (index + offset + count) % count;
      return next === index ? { index, previous: -1, direction: 1 } : { index: next, previous: index, direction: Math.sign(offset) };
    });
  }

  if (!count) return null;
  if (count === 1) return children[0];

  return (
    <div aria-label={label} aria-roledescription="карусель" role="region" className="group min-w-0"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="relative">
        <div className="home-carousel-track grid min-w-0 grid-cols-1 overflow-hidden rounded-ui"
          data-backward={slide.direction < 0}
          onTouchStart={(event) => { const touch = event.touches[0]; touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null; }}
          onTouchCancel={() => { touchStart.current = null; }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            touchStart.current = null;
            const touch = event.changedTouches[0];
            if (!start || !touch) return;
            const dx = touch.clientX - start.x;
            if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(touch.clientY - start.y)) move(dx < 0 ? 1 : -1);
          }}>
          {children.map((child, index) => (
            <div aria-hidden={index !== slide.index} className="home-carousel-slide min-w-0" inert={index !== slide.index} key={index}
              data-state={index === slide.index ? (slide.previous < 0 ? "current" : "enter") : index === slide.previous ? "exit" : "hidden"}>
              {child}
            </div>
          ))}
        </div>
        <button aria-label="Предыдущий слайд" className="absolute -left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-card xl:grid" onClick={() => move(-1)} type="button"><ChevronLeft size={20} /></button>
        <button aria-label="Следующий слайд" className="absolute -right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-card xl:grid" onClick={() => move(1)} type="button"><ChevronRight size={20} /></button>
      </div>
      <div className="mt-1 flex items-center justify-center">
        {children.map((_, index) => <button aria-label={`Слайд ${index + 1}`} aria-pressed={index === slide.index} className="grid h-11 w-11 place-items-center rounded-full" key={index} onClick={() => move(index - slide.index)} type="button"><span className={`h-2 w-2 rounded-full ${index === slide.index ? "bg-accent" : "bg-line"}`} /></button>)}
        {autoplay && <button aria-label={paused ? "Продолжить показ баннеров" : "Остановить показ баннеров"} className="grid h-11 w-11 place-items-center rounded-ui text-ink-2 hover:text-accent motion-reduce:hidden" onClick={() => setPaused(!paused)} type="button">{paused ? <Play size={14} /> : <Pause size={14} />}</button>}
      </div>
    </div>
  );
}
