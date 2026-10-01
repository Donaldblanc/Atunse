"use client";

import { ImageBrokenIcon, SneakerIcon } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState } from "react";
import type { PairPhoto } from "./pair-photo";

/**
 * A pair's photo as a thumbnail, in one of three looks:
 * - the photo itself;
 * - no photo uploaded: the plain sneaker placeholder (normal, nothing to do);
 * - a photo that exists but can't be shown (no view link could be made, or
 *   the image failed to load: a missing file, an expired link): a broken-
 *   image mark in the warning tone, named for screen readers and on hover,
 *   so it reads as "look into this", never as "no photo".
 */
export function PairThumb({ photo, className, iconSize }: { photo: PairPhoto; className: string; iconSize: number }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // An image that failed before hydration never fires onError for React, so check once mounted.
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (photo.kind === "none") {
    return (
      <span className={className} aria-hidden="true">
        <SneakerIcon size={iconSize} />
      </span>
    );
  }
  if (photo.url === null || failed) {
    return (
      <span className={className} data-state="broken" role="img" aria-label="Photo couldn't be loaded" title="Photo couldn't be loaded">
        <ImageBrokenIcon size={iconSize} aria-hidden="true" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- a short-lived storage link, not a static asset next/image can optimize
  return <img ref={ref} src={photo.url} alt="" className={className} onError={() => setFailed(true)} />;
}
