import { afterEach, describe, expect, it, vi } from "vitest";
import { JiraApiError, JiraClient } from "../src/jira-client.js";
import type { AppConfig } from "../src/config.js";

const config: AppConfig = {
  jiraBaseUrl: "https://example.atlassian.net",
  jiraEmail: "user@example.com",
  jiraApiToken: "secret-token",
  defaultProjectKey: "TEST",
  host: "127.0.0.1",
  port: 8787,
};

afterEach(() => vi.unstubAllGlobals());

describe("JiraClient", () => {
  it("課題をADF形式の説明付きで作成する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: "10001", key: "TEST-1" }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const response = await new JiraClient(config).createIssue({
      issueType: "Task",
      summary: "MCPテスト",
      description: "説明です",
    });

    expect(response).toEqual({ id: "10001", key: "TEST-1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.atlassian.net/rest/api/3/issue");
    expect(init.headers).toMatchObject({
      Authorization: expect.stringMatching(/^Basic /),
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      fields: {
        project: { key: "TEST" },
        issuetype: { name: "Task" },
        summary: "MCPテスト",
        description: { type: "doc", version: 1 },
      },
    });
  });

  it("Jiraエラーを安全なコードへ変換する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ errorMessages: ["課題が見つかりません"] }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    )));

    await expect(new JiraClient(config).getIssue("TEST-404")).rejects.toMatchObject<JiraApiError>({
      code: "jira_not_found",
      status: 404,
      message: "課題が見つかりません",
    });
  });
});
