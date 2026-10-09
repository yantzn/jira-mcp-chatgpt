import { describe, expect, it } from "vitest";
import { textToConfluenceStorage } from "../src/confluence-storage.js";

describe("textToConfluenceStorage", () => {
  it("プレーンテキストを安全なConfluence storage形式へ変換する", () => {
    expect(textToConfluenceStorage("1行目 <確認>\n\n2行目 & 続き")).toBe(
      "<p>1行目 &lt;確認&gt;</p><p><br /></p><p>2行目 &amp; 続き</p>",
    );
  });
});
