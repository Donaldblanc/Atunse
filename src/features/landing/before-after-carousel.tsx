"use client";

import { useRef } from "react";
import type { GalleryImage } from "./gallery";
import { getGalleryImageUrl } from "./gallery";

// Each source photo has "After" baked into its top half and "Before" into
// its bottom half (see gallery.ts / docs/TODO.md — the pixel-accurate crop
// into separate files is still a TODO). background-size: cover +
// background-position: top/bottom crops each half without distorting it.
export function BeforeAfterCarousel({ images }: { images: GalleryImage[] }) {
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
          const url = getGalleryImageUrl(image.key);
          return (
            <div className="landing-ba-card" key={image.key}>
              <div className="landing-ba-half before" style={{ backgroundImage: `url(${url})` }}>
                <div className="landing-ba-pill">BEFORE</div>
              </div>
              <div className="landing-ba-half after" style={{ backgroundImage: `url(${url})` }}>
                <div className="landing-ba-pill">AFTER</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
