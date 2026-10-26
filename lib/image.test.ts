import { describe, expect, it } from "vitest";
import { centerSquare } from "./image";

describe("centerSquare", () => {
  it("crops the longer side evenly", () => {
    expect(centerSquare(1000, 600)).toEqual({ sx: 200, sy: 0, side: 600 });
    expect(centerSquare(600, 1000)).toEqual({ sx: 0, sy: 200, side: 600 });
    expect(centerSquare(500, 500)).toEqual({ sx: 0, sy: 0, side: 500 });
  });
});
