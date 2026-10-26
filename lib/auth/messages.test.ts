import { describe, expect, it } from "vitest";
import { authMessage, validateNickname } from "./messages";

describe("validateNickname", () => {
  it("enforces the 2..16 length after trimming", () => {
    expect(validateNickname("a")).not.toBeNull();
    expect(validateNickname("  ბა  ")).toBeNull();
    expect(validateNickname("x".repeat(17))).not.toBeNull();
    expect(validateNickname("x".repeat(16))).toBeNull();
  });
});

describe("authMessage", () => {
  it("translates the common errors", () => {
    expect(authMessage("Invalid login credentials")).toContain("არასწორია");
    expect(authMessage("User already registered")).toContain("უკვე");
    expect(authMessage('Email address "a@b.c" is invalid')).toContain("არასწორია");
    expect(authMessage("something odd")).toContain("something odd");
  });
});
