import { describe, expect, it } from "vitest";

import { chisinauHour, isAfterHours, replyPromise } from "./working-hours";

describe("часы ответа оператора", () => {
  it("23:00 по Кишинёву — нерабочее время, ответ с 8:00", () => {
    // Ноябрь: Кишинёв в UTC+2, значит 21:00 UTC — это 23:00 по местному.
    const late = new Date("2026-11-26T21:00:00Z");
    expect(chisinauHour(late)).toBe(23);
    expect(isAfterHours(late)).toBe(true);
    expect(replyPromise(isAfterHours(late))).toContain("Ответим с 8:00");
  });
  it("границы: 7:59 и 20:00 — ночь, 8:00 и 19:59 — день", () => {
    expect(isAfterHours(new Date("2026-11-26T05:59:00Z"))).toBe(true);
    expect(isAfterHours(new Date("2026-11-26T06:00:00Z"))).toBe(false);
    expect(isAfterHours(new Date("2026-11-26T17:59:00Z"))).toBe(false);
    expect(isAfterHours(new Date("2026-11-26T18:00:00Z"))).toBe(true);
  });
  it("летом учитывается переход на UTC+3", () => {
    expect(chisinauHour(new Date("2026-07-01T20:00:00Z"))).toBe(23);
  });
});
