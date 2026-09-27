import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_LINKS } from "./nav-links";
import { PROCESS_HERO_IMAGE, PROCESS_STEPS } from "./process";

const LANDING_DIR = path.join(process.cwd(), "public/images/landing");

describe("process page", () => {
  it("has its photos", () => {
    for (const { key } of [PROCESS_HERO_IMAGE, ...PROCESS_STEPS.map((step) => step.image)]) {
      expect(existsSync(path.join(LANDING_DIR, key)), key).toBe(true);
    }
  });

  it("never offers a drop-off: pairs come in by Pickup or Mail-In only", () => {
    const copy = PROCESS_STEPS.map((step) => `${step.title} ${step.description}`).join(" ");
    expect(copy).not.toMatch(/drop[\s-]?off|our store/i);
    expect(copy).toMatch(/pickup/i);
    expect(copy).toMatch(/mail in/i);
  });

  it("is linked from the nav", () => {
    expect(NAV_LINKS.find((link) => link.label === "Process")?.href).toBe("/process");
  });
});
