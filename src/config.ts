import "dotenv/config";

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} が設定されていません`);
  return value;
};

const normalizeBaseUrl = (value: string): string => {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("JIRA_BASE_URL は https URLである必要があります");
  }
  return url.toString().replace(/\/$/, "");
};

export type AppConfig = {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  defaultProjectKey?: string;
  host: string;
  port: number;
  mcpAccessToken?: string;
};

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT ?? "8787");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT は1〜65535の整数で指定してください");
  }
  return {
    jiraBaseUrl: normalizeBaseUrl(required("JIRA_BASE_URL")),
    jiraEmail: required("JIRA_EMAIL"),
    jiraApiToken: required("JIRA_API_TOKEN"),
    defaultProjectKey: process.env.JIRA_DEFAULT_PROJECT_KEY?.trim() || undefined,
    host: process.env.HOST?.trim() || "127.0.0.1",
    port,
    mcpAccessToken: process.env.MCP_ACCESS_TOKEN?.trim() || undefined,
  };
}
