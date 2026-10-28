import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("trusted Io job offer", () => {
  it("renders the offer row's ioLine for a sealed packet", () => {
    const source = readFileSync(join(process.cwd(), "aftersign/main.js"), "utf8");

    expect(source).toMatch(/data-aftersign-job-offer-io-line/);
    expect(source).toMatch(/ioOfferLine\.textContent\s*=\s*offerCopy\.ioLine/);
  });
});
