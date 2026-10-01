/** The design's brand panel: the wordmark and tagline beside a restored pair. Decorative. */
export function BrandCard() {
  return (
    <div className="ov-brand" aria-hidden="true">
      <div className="ov-brand-text">
        <span className="ov-brand-name">ATUNṢE</span>
        <span className="ov-brand-tag">
          Restore more
          <br />
          than sneakers.
          <br />
          Restore the feeling.
        </span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a small decorative crop, not worth next/image's loader */}
      <img src="/images/admin/brand-sneaker.jpg" alt="" className="ov-brand-photo" />
    </div>
  );
}
