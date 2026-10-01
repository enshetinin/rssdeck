import { describe, expect, it } from "vitest";

import { adjacentIndex, isTypingTarget, shortcutFor } from "@/features/shortcuts/shortcuts";

const press = (
  key: string,
  modifiers: Partial<Record<"ctrlKey" | "metaKey" | "altKey", boolean>> = {},
) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
  ...modifiers,
});

describe("shortcutFor", () => {
  it.each([
    ["j", "next-entry"],
    ["k", "previous-entry"],
    ["s", "toggle-star"],
    ["m", "toggle-read"],
    ["o", "open-original"],
    ["?", "show-help"],
  ])("maps %s to %s", (key, action) => {
    expect(shortcutFor(press(key))).toBe(action);
  });

  it("ignores unknown keys, uppercase and modifier combinations", () => {
    expect(shortcutFor(press("x"))).toBeNull();
    expect(shortcutFor(press("J"))).toBeNull();
    expect(shortcutFor(press("s", { metaKey: true }))).toBeNull();
    expect(shortcutFor(press("s", { ctrlKey: true }))).toBeNull();
    expect(shortcutFor(press("j", { altKey: true }))).toBeNull();
    expect(shortcutFor({ ...press("j"), isComposing: true })).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it.each(["INPUT", "TEXTAREA", "SELECT"])("treats %s as typing", (tagName) => {
    expect(isTypingTarget({ tagName })).toBe(true);
  });

  it("treats contenteditable as typing", () => {
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  it("does not treat links, buttons or the page as typing", () => {
    expect(isTypingTarget({ tagName: "A" })).toBe(false);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("adjacentIndex", () => {
  it("starts at the first entry when none is open", () => {
    expect(adjacentIndex(3, -1, 1)).toBe(0);
    expect(adjacentIndex(3, -1, -1)).toBeNull();
  });

  it("moves within the list and stops at the ends", () => {
    expect(adjacentIndex(3, 0, 1)).toBe(1);
    expect(adjacentIndex(3, 2, 1)).toBeNull();
    expect(adjacentIndex(3, 0, -1)).toBeNull();
  });

  it("does nothing on an empty list", () => {
    expect(adjacentIndex(0, -1, 1)).toBeNull();
  });
});
