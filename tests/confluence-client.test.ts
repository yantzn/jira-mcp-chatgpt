import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config.js";
import { ConfluenceApiError, ConfluenceClient } from "../src/confluence-client.js";

const config: AppConfig = {
  jiraBaseUrl: "https://example.atlassian.net",
  jiraEmail: "user@example.com",
  jiraApiToken: "secret-token",
  host: "127.0.0.1",
  port: 8787,
};

afterEach(() => vi.unstubAllGlobals());

describe("ConfluenceClient", () => {
  it("ページをstorage形式の本文付きで作成する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: "123", title: "設計" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await new ConfluenceClient(config).createPage({
      spaceId: "42",
      parentId: "100",
      title: "設計",
      content: "安全な <本文>",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.atlassian.net/wiki/api/v2/pages");
    expect(init.headers).toMatchObject({ Authorization: expect.stringMatching(/^Basic /) });
    expect(JSON.parse(String(init.body))).toEqual({
      spaceId: "42",
      parentId: "100",
      status: "current",
      title: "設計",
      body: { representation: "storage", value: "<p>安全な &lt;本文&gt;</p>" },
    });
  });

  it("指定した現在版の次の版としてページを更新する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: "123", version: { number: 8 } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await new ConfluenceClient(config).updatePage({
      pageId: "123",
      title: "更新後",
      content: "本文",
      currentVersion: 7,
      versionMessage: "MCPから更新",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      id: "123",
      version: { number: 8, message: "MCPから更新" },
    });
  });

  it("競合を安全なエラーコードへ変換する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: "Version must be incremented" }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    )));

    await expect(new ConfluenceClient(config).getPage("123")).rejects.toMatchObject<ConfluenceApiError>({
      code: "confluence_conflict",
      status: 409,
    });
  });
});
