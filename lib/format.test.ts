import { describe, expect, it } from "vitest";
import { formatDate, formatTime } from "./format";

describe("formatDate / formatTime", () => {
  it("writes Georgian month names and a 24-hour clock", () => {
    const d = new Date(2026, 9, 26, 7, 5);
    expect(formatDate(d)).toBe("26 ოქტომბერი, 2026");
    expect(formatTime(d)).toBe("07:05");
  });
});
