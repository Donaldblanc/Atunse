"use client";

import { useRef } from "react";
import type { BeforeAfterImage } from "./gallery";
import { getGalleryImageUrl } from "./gallery";

export function BeforeAfterCarousel({ images }: { images: BeforeAfterImage[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  function step(dir: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[0] as HTMLElement | undefined;
    if (!card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap || "16");
    const width = card.getBoundingClientRect().width + gap;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: dir * width, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <>
      <div className="landing-ba-head">
        <div className="landing-ba-head-left">
          <div>
            <h2>Before / After</h2>
            <div className="landing-ba-head-sub">Real sneakers. Real results.</div>
          </div>
          <button className="landing-ba-nav" aria-label="Previous" onClick={() => step(-1)}>
            <svg width="14" height="14" viewBox="0 0 256 256" fill="none" aria-hidden="true">
              <path d="M164 48L92 128L164 208" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="landing-ba-nav" aria-label="Next" onClick={() => step(1)}>
            <svg width="14" height="14" viewBox="0 0 256 256" fill="none" aria-hidden="true">
              <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <a className="landing-ba-more" href="#gallery">
          View more
          <svg width="13" height="13" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
      <div className="landing-ba-track" ref={trackRef}>
        {images.map((image) => {
          const beforeUrl = getGalleryImageUrl(image.beforeKey);
          const afterUrl = getGalleryImageUrl(image.afterKey);
          return (
            <div className="landing-ba-card" key={image.afterKey}>
              <div className="landing-ba-photo">
                <div className="landing-ba-half before" style={{ backgroundImage: `url(${beforeUrl})` }}>
                  <div className="landing-ba-pill">Before</div>
                </div>
                <div className="landing-ba-half after" style={{ backgroundImage: `url(${afterUrl})` }}>
                  <div className="landing-ba-pill">After</div>
                </div>
                <div className="landing-ba-handle" aria-hidden="true">
                  <svg width="9" height="9" viewBox="0 0 256 256" fill="none">
                    <path d="M164 48L92 128L164 208" stroke="currentColor" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <svg width="9" height="9" viewBox="0 0 256 256" fill="none">
                    <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <div className="landing-ba-caption">{image.caption}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
