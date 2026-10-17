import { BRAND_LOGOS, getBrandLogoUrl } from "./brand-logos";

// Scrolling logo row. No client-side JS needed: the loop is a pure CSS
// animation, and the black/white variant swap is driven by the
// [data-theme] attribute ThemeToggle already sets on #landing-root.
export function BrandMarquee() {
  const doubled = [...BRAND_LOGOS, ...BRAND_LOGOS];

  return (
    <div className="landing-trust-marquee">
      {/* The second copy only makes the loop seamless: hidden from screen readers so each brand is read once. */}
      <div className="landing-trust-marquee-track">
        {doubled.map((logo, i) => (
          <span className="landing-trust-wordmark" key={`${logo.slug}-${i}`} aria-hidden={i >= BRAND_LOGOS.length || undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element -- theme-swapped via CSS, not next/image */}
            <img className="logo-black" src={getBrandLogoUrl(logo.slug, "black")} alt={logo.name} />
            {/* eslint-disable-next-line @next/next/no-img-element -- theme-swapped via CSS, not next/image */}
            <img className="logo-white" src={getBrandLogoUrl(logo.slug, "white")} alt={logo.name} />
          </span>
        ))}
      </div>
    </div>
  );
}
