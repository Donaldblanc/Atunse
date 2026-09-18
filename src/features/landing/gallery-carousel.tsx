"use client";

import { useRef, useState } from "react";
import type { GalleryImage } from "./gallery";
import { getGalleryImageUrl } from "./gallery";

export function GalleryCarousel({ images }: { images: GalleryImage[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function scrollByCard(dir: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[0] as HTMLElement | undefined;
    if (!card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap || "18");
    const step = card.getBoundingClientRect().width + gap;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: dir * step, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function scrollToIndex(i: number) {
    const track = trackRef.current;
    const card = track?.children[i] as HTMLElement | undefined;
    if (!card) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", inline: "start", block: "nearest" });
    setActive(i);
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    const cards = [...track.children] as HTMLElement[];
    const trackRect = track.getBoundingClientRect();
    let closest = 0;
    let closestDist = Infinity;
    cards.forEach((card, i) => {
      const dist = Math.abs(card.getBoundingClientRect().left - trackRect.left);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setActive(closest);
  }

  return (
    <>
      <div className="landing-carousel-wrap">
        <button className="car-nav prev" aria-label="Previous" onClick={() => scrollByCard(-1)}>
          <svg width="18" height="18" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <path d="M164 48L92 128L164 208" stroke="currentColor" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="car-nav next" aria-label="Next" onClick={() => scrollByCard(1)}>
          <svg width="18" height="18" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="landing-carousel" ref={trackRef} onScroll={handleScroll}>
          {images.map((image, i) => (
            <div className="landing-card" key={image.key}>
              <div className="img-frame">
                {/* eslint-disable-next-line @next/next/no-img-element -- external/S3-resolved URL, not a static import next/image can optimize */}
                <img src={getGalleryImageUrl(image.key)} alt={image.alt} loading="lazy" />
              </div>
              <div className="landing-card-index">{String(i + 2).padStart(3, "0")}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="car-dots">
        {images.map((image, i) => (
          <button
            key={image.key}
            className="car-dot"
            data-active={i === active}
            aria-label={`Go to image ${i + 1}`}
            onClick={() => scrollToIndex(i)}
          />
        ))}
      </div>
    </>
  );
}
