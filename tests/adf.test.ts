import { describe, expect, it } from "vitest";
import { textToAdf } from "../src/adf.js";

describe("textToAdf", () => {
  it("複数行テキストをADF段落へ変換する", () => {
    expect(textToAdf("1行目\n\n3行目")).toEqual({
      type: "doc",
      version: 1,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "1行目" }] },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "3行目" }] },
      ],
    });
  });
});
