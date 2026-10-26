import { describe, expect, it } from "vitest";
import { escapeLike } from "./search";

describe("escapeLike", () => {
  it("neutralises LIKE wildcards and the escape character", () => {
    expect(escapeLike("100%_win")).toBe("100\\%\\_win");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    expect(escapeLike("ტესტერი")).toBe("ტესტერი");
  });
});
