import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const originalEnv = { ...process.env };
let temporaryDirectory = "";

beforeEach(() => {
  process.env = {
    ...originalEnv,
    JIRA_BASE_URL: "https://example.atlassian.net",
    JIRA_EMAIL: "user@example.com",
    JIRA_DEFAULT_PROJECT_KEY: "TEST",
  };
  delete process.env.JIRA_API_TOKEN;
  delete process.env.MCP_ACCESS_TOKEN;
  temporaryDirectory = mkdtempSync(join(tmpdir(), "jira-mcp-config-"));
});

afterEach(() => {
  process.env = { ...originalEnv };
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("Docker secretsファイルから認証情報を読み込む", () => {
    const jiraTokenFile = join(temporaryDirectory, "jira-token");
    const mcpHeaderFile = join(temporaryDirectory, "mcp-header");
    writeFileSync(jiraTokenFile, "jira-secret\n");
    writeFileSync(mcpHeaderFile, "Bearer mcp-secret\n");
    process.env.JIRA_API_TOKEN_FILE = jiraTokenFile;
    process.env.MCP_AUTHORIZATION_HEADER_FILE = mcpHeaderFile;

    const config = loadConfig();

    expect(config.jiraApiToken).toBe("jira-secret");
    expect(config.mcpAuthorizationHeader).toBe("Bearer mcp-secret");
  });

  it("空の秘密ファイルを拒否する", () => {
    const jiraTokenFile = join(temporaryDirectory, "jira-token");
    writeFileSync(jiraTokenFile, "\n");
    process.env.JIRA_API_TOKEN_FILE = jiraTokenFile;

    expect(() => loadConfig()).toThrow("JIRA_API_TOKENのファイルが空です");
  });
});
