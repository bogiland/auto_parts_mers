import { describe, expect, it } from "vitest";

import { matchesQuery } from "./catalog-listing";
import { scrubQuery } from "./search-misses";

const part = { name: "Воздушный фильтр", brand: "Mercedes-Benz", sku: "DEMO-0001", oem: "A654-094-00-04", donor: "Mercedes-Benz E-класс W212" };

describe("поиск по номеру детали", () => {
  it.each(["A654-094-00-04", "a654 094 00 04", "A6540940004", "a6540940004", "A654.094.00.04", "654094"])("находит «%s»", (query) => {
    expect(matchesQuery(part, query)).toBe(true);
  });
  it("не находит чужой номер", () => {
    expect(matchesQuery(part, "A2128200339")).toBe(false);
  });
  it("слова ищутся и по машине-донору", () => {
    expect(matchesQuery(part, "фильтр w212")).toBe(true);
  });
});

describe("журнал пустых поисков без персональных данных", () => {
  it("номер детали остаётся", () => expect(scrubQuery("A2128200339")).toBe("A2128200339"));
  it("телефон с кодом страны заменяется", () => expect(scrubQuery("фара +373 68 123 456")).toBe("фара [телефон]"));
  it("местный номер заменяется", () => expect(scrubQuery("68123456 стартер")).toBe("[телефон] стартер"));
  it("почта заменяется", () => expect(scrubQuery("ivan@example.com фара")).toBe("[почта] фара"));
});
