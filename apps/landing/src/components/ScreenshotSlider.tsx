"use client";

import { useRef, useState, useEffect } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";

const SLIDES = [
  { src: "/screenshot-1.png", alt: "Agent Office — Office Floor" },
  { src: "/screenshot-2.png", alt: "Agent Office — Agents" },
  { src: "/screenshot-3.png", alt: "Agent Office — Run History" },
  { src: "/screenshot-4.png", alt: "Agent Office — Memory" },
];

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-[rgba(0,0,0,0.88)] backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-bg-2 border border-line-2 text-txt-2 hover:border-acc hover:text-acc transition-colors flex items-center justify-center"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-[92vw] max-h-[90vh] rounded-xl border border-[rgba(255,245,235,0.1)] shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </div>
  );
}

export default function ScreenshotSlider() {
  const swiperRef = useRef<SwiperType | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const navBtn = "absolute top-[calc(50%-36px)] z-10 w-8 h-8 rounded-full bg-bg-2 border border-line-2 text-txt-3 hover:border-acc hover:text-acc transition-colors flex items-center justify-center";

  return (
    <div className="w-full relative">
      <Swiper
        onSwiper={(s) => { swiperRef.current = s; }}
        effect="coverflow"
        grabCursor
        centeredSlides
        slidesPerView="auto"
        coverflowEffect={{ rotate: 28, stretch: 0, depth: 120, modifier: 1, slideShadows: true }}
        pagination={{ clickable: true }}
        loop
        loopAdditionalSlides={SLIDES.length}
        modules={[EffectCoverflow, Pagination]}
        style={{
          paddingBottom: "48px",
          "--swiper-pagination-color": "var(--acc)",
          "--swiper-pagination-bullet-inactive-color": "var(--line-2)",
          "--swiper-pagination-bullet-inactive-opacity": "1",
          "--swiper-pagination-bullet-size": "6px",
        } as React.CSSProperties}
      >
        {SLIDES.map(({ src, alt }) => (
          <SwiperSlide key={src} style={{ width: "72%", maxWidth: "960px" }}>
            <img
              src={src}
              alt={alt}
              className="w-full h-auto block rounded-xl border border-[rgba(255,245,235,0.08)] shadow-[0_24px_60px_rgba(0,0,0,0.55),0_4px_16px_rgba(0,0,0,0.25)] cursor-zoom-in"
              draggable={false}
              onClick={() => setLightbox({ src, alt })}
            />
          </SwiperSlide>
        ))}
      </Swiper>

      <button type="button" aria-label="Previous slide" onClick={() => swiperRef.current?.slidePrev()} className={`${navBtn} left-4`}>
        <ChevronLeft />
      </button>
      <button type="button" aria-label="Next slide" onClick={() => swiperRef.current?.slideNext()} className={`${navBtn} right-4`}>
        <ChevronRight />
      </button>

      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </div>
  );
}
