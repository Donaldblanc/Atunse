import Link from "next/link";
import "@/styles/landing-theme.css";
import { SiteNav } from "@/features/landing/site-nav";
import { SiteFooter } from "@/features/landing/site-footer";
import { MobileTabBar } from "@/features/landing/mobile-tabbar";

export const metadata = {
  title: "About — Atunṣe",
};

export default function AboutPage() {
  return (
    <div className="landing" id="landing-root">
      <SiteNav active="about" />

      <div className="landing-about-hero">
        <div>
          <p className="landing-eyebrow">ABOUT ATUNSE</p>
          <h1>
            More Than Sneakers.
            <span>A Higher Purpose.</span>
          </h1>
          <p className="landing-lede">
            I&rsquo;m DJ, born in Brooklyn and raised in Queens, New York. What started with one pair
            and a necessity turned into a lifelong passion, a craft, and eventually RestoredByDJ.
          </p>
          <Link className="landing-btn-primary" href="/coming-soon">
            Book a restoration
            <svg width="14" height="14" viewBox="0 0 256 256" fill="none" aria-hidden="true">
              <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="landing-about-tagline">
            <span className="rule" />
            SAME CULTURE.
            <br />
            BRIGHTER DAYS.
          </div>
        </div>
        <div className="landing-about-mark">
          <div className="landing-about-quote">
            <span className="landing-about-quote-rule" />
            <div>
              <p className="landing-about-quote-mark" aria-hidden="true">
                &ldquo;
              </p>
              <blockquote>Good things happen to well-kept pairs.</blockquote>
            </div>
          </div>
          <cite className="landing-about-quote-cite">&mdash; DJ</cite>
          <div className="landing-about-skyline">
            <svg width="220" height="80" viewBox="0 0 300 106.4" fill="none" aria-hidden="true">
              <path
                d="M0.0,100.7 L1.0,100.0 L8.8,100.0 L10.0,95.6 L12.5,93.6 L12.7,70.4 L13.2,68.7 L14.7,67.7 L28.1,67.7 L29.3,68.5 L29.8,69.2 L30.1,91.9 L31.8,93.6 L32.8,99.3 L34.0,100.2 L37.4,100.2 L37.9,99.3 L38.6,88.5 L42.1,86.3 L42.5,83.1 L43.8,80.9 L46.9,79.0 L47.9,73.1 L49.4,72.1 L51.8,71.9 L53.5,70.9 L55.5,49.9 L56.0,49.1 L59.2,47.7 L64.5,47.9 L67.0,48.9 L67.7,50.1 L69.2,70.9 L70.2,72.6 L70.4,80.4 L72.6,82.2 L73.1,83.4 L73.8,99.8 L74.8,100.2 L75.8,99.3 L76.0,90.0 L77.8,83.9 L81.4,80.7 L84.1,79.7 L87.5,80.2 L89.5,82.4 L91.9,83.9 L92.7,87.3 L94.1,90.0 L94.4,99.0 L94.6,99.8 L95.6,99.5 L96.6,85.8 L98.5,83.9 L102.4,83.6 L103.2,82.6 L103.7,77.5 L105.1,76.3 L107.3,76.3 L108.8,75.3 L114.2,75.3 L116.9,77.3 L118.3,77.5 L119.3,78.7 L119.8,83.4 L122.0,88.3 L122.5,96.6 L123.2,99.3 L124.0,98.3 L124.4,95.6 L124.7,86.3 L126.2,73.6 L127.6,41.1 L128.6,38.9 L130.1,31.3 L134.2,26.7 L135.2,15.6 L135.9,14.2 L136.2,1.0 L136.9,0.0 L138.1,1.2 L138.4,14.2 L139.6,26.9 L143.8,31.5 L146.0,41.1 L147.4,83.6 L148.2,85.3 L149.1,99.3 L149.6,99.8 L150.6,98.5 L152.3,90.7 L155.0,88.0 L156.5,88.0 L158.2,89.5 L161.1,99.5 L161.6,99.0 L163.1,55.5 L166.5,49.1 L168.2,48.9 L169.4,47.9 L171.4,48.9 L174.3,49.1 L176.0,51.6 L177.3,55.0 L178.0,81.9 L178.7,72.9 L179.2,42.5 L179.7,39.9 L180.4,38.4 L182.2,37.7 L189.2,37.4 L191.7,37.7 L193.4,38.9 L194.1,80.2 L194.4,85.6 L194.9,86.6 L200.5,86.6 L206.8,85.6 L213.0,83.6 L219.1,80.4 L223.2,77.3 L227.4,72.9 L228.1,68.2 L229.8,67.5 L232.0,67.5 L232.5,66.7 L232.8,62.1 L233.5,60.9 L234.2,60.9 L235.2,66.7 L235.9,67.7 L238.1,67.7 L239.1,68.5 L239.9,74.6 L243.0,80.4 L246.5,84.8 L250.9,89.0 L257.0,92.9 L260.9,94.4 L261.9,95.8 L262.1,98.5 L262.8,98.5 L263.1,96.6 L264.5,96.1 L278.2,98.3 L290.7,99.3 L298.8,99.3 L299.8,100.0"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path d="M194.4,91.7 L300.0,102.0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <path
                d="M228.9,67.7 L228.9,106.1 M238.6,67.7 L238.6,106.1 M233.7,60.9 L233.7,67.7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <div className="landing-about-skyline-label">NEW YORK</div>
            <div className="landing-about-skyline-caption">
              CLEANER PAIRS.
              <br />
              BRIGHTER DAYS.
            </div>
          </div>
        </div>
      </div>

      <div className="landing-about-story">
        <div>
          <p className="landing-eyebrow">MY STORY</p>
          <h2>
            From One Pair
            <br />
            to a Purpose.
          </h2>
          <p>
            I&rsquo;m DJ, born in Brooklyn and raised in Queens, New York. Growing up, getting a new
            pair of sneakers wasn&rsquo;t always an option. When my sneakers got dirty, worn, or
            damaged, I learned how to clean, repair, and restore them myself.
          </p>
          <p>
            What started in 2014 as a personal necessity quickly turned into a passion. I fell in
            love with the process &mdash; breathing new life into something that others might throw
            away. Over time, that passion became <strong>RestoredByDJ</strong>, a way to share my
            craft with a wider community and help people keep the pairs that mean something to them.
          </p>
          <p>
            Today, <strong>Atunṣe</strong> represents more than just sneaker restoration.
            It&rsquo;s about care, culture, and giving sneakers a second life.
          </p>
        </div>
        <div className="landing-timeline">
          <div className="landing-timeline-item">
            <span className="landing-timeline-dot" />
            <div className="landing-timeline-year">2014</div>
            <strong>It Started</strong>
            <p>I began cleaning and restoring my own sneakers out of necessity.</p>
          </div>
          <div className="landing-timeline-item">
            <span className="landing-timeline-dot" />
            <strong>Brooklyn &rarr; Queens</strong>
            <div className="landing-timeline-year" style={{ fontSize: 13, marginTop: -2 }}>
              My Roots
            </div>
            <p>New York shaped my work ethic, style, and love for sneaker culture.</p>
          </div>
          <div className="landing-timeline-item">
            <span className="landing-timeline-dot" />
            <div className="landing-timeline-year">2019</div>
            <strong>Growing the Craft</strong>
            <p>Started taking on pairs for friends, family, and my community.</p>
          </div>
          <div className="landing-timeline-item">
            <span className="landing-timeline-dot" />
            <strong>Today</strong>
            <div className="landing-timeline-year" style={{ fontSize: 13, marginTop: -2 }}>
              RestoredByDJ
            </div>
            <p>A trusted name in sneaker restoration, helping people bring back the feeling.</p>
          </div>
        </div>
      </div>

      <div className="landing-principles-head">
        <div>
          <p className="landing-eyebrow">MY PRINCIPLES</p>
          <h2>Guided by a Higher Standard.</h2>
        </div>
        <p>
          These principles drive everything I do, from how I care for your sneakers to how I show up
          for the community.
        </p>
      </div>
      <div className="landing-principles-grid">
        <div className="landing-principle-card">
          <span className="landing-principle-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 256 256" fill="none">
              <path d="M64 96L128 32L192 96L128 224Z" stroke="currentColor" strokeWidth="14" strokeLinejoin="round" />
              <path d="M64 96H192M96 96L128 224M160 96L128 224" stroke="currentColor" strokeWidth="14" strokeLinejoin="round" />
            </svg>
          </span>
          <strong>Quality First</strong>
          <p>Every pair gets the same attention to detail, no shortcuts.</p>
        </div>
        <div className="landing-principle-card">
          <span className="landing-principle-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 256 256" fill="none">
              <circle cx="92" cy="88" r="28" stroke="currentColor" strokeWidth="14" />
              <path d="M40 200c0-36 24-60 52-60s52 24 52 60" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
              <circle cx="176" cy="80" r="22" stroke="currentColor" strokeWidth="14" />
              <path d="M152 140c28 4 44 26 44 60" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
            </svg>
          </span>
          <strong>Respect the Culture</strong>
          <p>Sneakers are more than shoes &mdash; they&rsquo;re history, expression, and community.</p>
        </div>
        <div className="landing-principle-card">
          <span className="landing-principle-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 256 256" fill="none">
              <path
                d="M200 56c-88 0-144 48-144 128 0 8 0 16 8 16 80 0 128-56 128-144 0-8 0 0 8 0Z"
                stroke="currentColor"
                strokeWidth="14"
                strokeLinejoin="round"
              />
              <path d="M64 192L160 96" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
            </svg>
          </span>
          <strong>Restore, Don&rsquo;t Replace</strong>
          <p>Give sneakers a longer life and reduce waste.</p>
        </div>
        <div className="landing-principle-card">
          <span className="landing-principle-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 256 256" fill="none">
              <path
                d="M128 216S32 152 32 92a48 48 0 0 1 96-16 48 48 0 0 1 96 16c0 60-96 124-96 124Z"
                stroke="currentColor"
                strokeWidth="14"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <strong>People Always</strong>
          <p>Great service, honest communication, and happy customers.</p>
        </div>
      </div>

      <div className="landing-about-cta">
        <div>
          <p className="landing-eyebrow">LET&rsquo;S BRING THEM BACK</p>
          <h2>Your Sneakers Deserve a Second Chapter.</h2>
          <p>Book a restoration today and let&rsquo;s bring back the feeling.</p>
          <Link className="landing-btn-primary" href="/coming-soon">
            Book a restoration
            <svg width="14" height="14" viewBox="0 0 256 256" fill="none" aria-hidden="true">
              <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
        <div className="landing-about-cta-tagline">
          <span className="rule" />
          <div className="landing-about-cta-tagline-text">
            <div>
              SAME
              <br />
              CULTURE.
              <br />
              BRIGHTER
              <br />
              DAYS.
            </div>
            <div className="landing-about-cta-tagline-rule-bottom" />
          </div>
        </div>
      </div>

      <SiteFooter active="about" />
      <MobileTabBar />
    </div>
  );
}
