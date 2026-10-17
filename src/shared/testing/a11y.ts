// Static accessibility checks on server-rendered markup. The unit suite has no
// DOM implementation (no jsdom), so axe-core can't run here; the 2026-09-28
// axe audit ran in a real browser (docs/TODO.md, Accessibility). These catch
// the regressions that are visible in the HTML itself.
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

export function markup(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

/** Problems found in a component's initial markup (empty when clean). */
export function a11yProblems(element: ReactElement): string[] {
  const html = markup(element);
  const problems: string[] = [];

  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const attrs = match[1] ?? "";
    const text = (match[2] ?? "").replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "").trim();
    if (!/aria-label="[^"]+"/.test(attrs) && !/aria-labelledby=/.test(attrs) && !text) {
      problems.push(`button without an accessible name: <button${attrs}>`);
    }
  }
  for (const match of html.matchAll(/<img\b([^>]*)>/g)) {
    if (!/\balt=/.test(match[1] ?? "")) problems.push(`img without alt: <img${match[1]}>`);
  }
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!);
  for (const id of new Set(ids.filter((v, i) => ids.indexOf(v) !== i))) problems.push(`duplicate id: ${id}`);
  for (const match of html.matchAll(/aria-controls="([^"]+)"/g)) {
    if (!ids.includes(match[1]!)) problems.push(`aria-controls points at a missing id: ${match[1]}`);
  }
  return problems;
}
