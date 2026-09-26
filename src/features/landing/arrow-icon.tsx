// Shared right-chevron used on link-arrows and CTAs across the marketing
// surface. size/strokeWidth vary by usage (inline text link vs. button).
export function ArrowIcon({ size = 14, strokeWidth = 24 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
