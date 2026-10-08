export type AdfDocument = {
  type: "doc";
  version: 1;
  content: Array<{
    type: "paragraph";
    content?: Array<{ type: "text"; text: string }>;
  }>;
};

export function textToAdf(text: string): AdfDocument {
  return {
    type: "doc",
    version: 1,
    content: text.replace(/\r\n/g, "\n").split("\n").map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text" as const, text: line }] } : {}),
    })),
  };
}
