import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ConfluenceApiError, ConfluenceClient } from "./confluence-client.js";
import { JiraApiError, JiraClient } from "./jira-client.js";

const result = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

const failure = (error: unknown) => {
  if (error instanceof JiraApiError || error instanceof ConfluenceApiError) {
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: JSON.stringify({ error_code: error.code, message: error.message }),
      }],
    };
  }
  return {
    isError: true,
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        error_code: "atlassian_mcp_internal_error",
        message: "Atlassian操作を完了できませんでした",
      }),
    }],
  };
};

const run = async (operation: () => Promise<unknown>) => {
  try {
    return result(await operation());
  } catch (error) {
    return failure(error);
  }
};

export function createAtlassianMcpServer(
  jiraClient: JiraClient,
  confluenceClient: ConfluenceClient,
): McpServer {
  const server = new McpServer(
    { name: "personal-atlassian-mcp", version: "0.2.0" },
    {
      instructions:
        "Jira CloudとConfluence Cloudを検索・参照・作成・更新するサーバーです。書き込み前に対象と変更内容を確認してください。識別子や版番号を推測せず、必要なら先に読み取りツールで確認してください。",
    },
  );

  server.registerTool("list_projects", {
    title: "Jiraプロジェクト一覧",
    description: "利用可能なJiraプロジェクトを確認するときに使用します。",
    inputSchema: { maxResults: z.number().int().min(1).max(100).default(50) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, ({ maxResults }) => run(() => jiraClient.listProjects(maxResults)));

  server.registerTool("search_issues", {
    title: "Jira課題検索",
    description: "JQLを使ってJira課題を検索するときに使用します。",
    inputSchema: {
      jql: z.string().min(1).max(4000),
      maxResults: z.number().int().min(1).max(100).default(20),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, ({ jql, maxResults }) => run(() => jiraClient.searchIssues(jql, maxResults)));

  server.registerTool("get_issue", {
    title: "Jira課題取得",
    description: "課題キーを指定してJira課題の詳細を確認するときに使用します。",
    inputSchema: { issueKey: z.string().min(2).max(100) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, ({ issueKey }) => run(() => jiraClient.getIssue(issueKey)));

  server.registerTool("get_create_metadata", {
    title: "Jira課題作成情報取得",
    description: "プロジェクトで利用可能な課題タイプを、課題作成前に確認するときに使用します。",
    inputSchema: { projectKey: z.string().min(1).max(100) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, ({ projectKey }) => run(() => jiraClient.getCreateMetadata(projectKey)));

  server.registerTool("create_issue", {
    title: "Jira課題作成",
    description: "確認済みの内容で新しいJira課題を1件作成するときに使用します。",
    inputSchema: {
      projectKey: z.string().min(1).max(100).optional(),
      issueType: z.string().min(1).max(100),
      summary: z.string().min(1).max(255),
      description: z.string().max(30000).optional(),
      labels: z.array(z.string().min(1).max(255)).max(20).optional(),
      priority: z.string().min(1).max(100).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, (input) => run(() => jiraClient.createIssue(input)));

  server.registerTool("update_issue", {
    title: "Jira課題更新",
    description: "既存Jira課題の要約、説明、ラベル、優先度を更新するときに使用します。",
    inputSchema: {
      issueKey: z.string().min(2).max(100),
      summary: z.string().min(1).max(255).optional(),
      description: z.string().max(30000).optional(),
      labels: z.array(z.string().min(1).max(255)).max(20).optional(),
      priority: z.string().min(1).max(100).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, ({ issueKey, ...input }) => run(() => jiraClient.updateIssue(issueKey, input)));

  server.registerTool("add_comment", {
    title: "Jiraコメント追加",
    description: "既存Jira課題へコメントを追加するときに使用します。",
    inputSchema: {
      issueKey: z.string().min(2).max(100),
      comment: z.string().min(1).max(30000),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, ({ issueKey, comment }) => run(() => jiraClient.addComment(issueKey, comment)));

  server.registerTool("list_confluence_spaces", {
    title: "Confluenceスペース一覧",
    description: "利用可能なConfluenceスペースとspaceIdを確認するときに使用します。",
    inputSchema: { limit: z.number().int().min(1).max(250).default(25) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, ({ limit }) => run(() => confluenceClient.listSpaces(limit)));

  server.registerTool("search_confluence_content", {
    title: "Confluenceコンテンツ検索",
    description: "CQLを使ってConfluenceのページなどを検索するときに使用します。",
    inputSchema: {
      cql: z.string().min(1).max(4000),
      limit: z.number().int().min(1).max(100).default(20),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, ({ cql, limit }) => run(() => confluenceClient.searchContent(cql, limit)));

  server.registerTool("get_confluence_page", {
    title: "Confluenceページ取得",
    description: "ページIDを指定し、本文と現在の版番号を確認するときに使用します。",
    inputSchema: { pageId: z.string().min(1).max(100) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, ({ pageId }) => run(() => confluenceClient.getPage(pageId)));

  server.registerTool("create_confluence_page", {
    title: "Confluenceページ作成",
    description: "確認済みの内容でConfluenceページを1件作成するときに使用します。本文はプレーンテキストで指定します。",
    inputSchema: {
      spaceId: z.string().min(1).max(100),
      title: z.string().min(1).max(255),
      content: z.string().min(1).max(100000),
      parentId: z.string().min(1).max(100).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, (input) => run(() => confluenceClient.createPage(input)));

  server.registerTool("update_confluence_page", {
    title: "Confluenceページ更新",
    description: "既存ページを更新します。事前取得した現在の版番号をcurrentVersionへ指定してください。本文はプレーンテキストで指定します。",
    inputSchema: {
      pageId: z.string().min(1).max(100),
      title: z.string().min(1).max(255),
      content: z.string().min(1).max(100000),
      currentVersion: z.number().int().min(1),
      versionMessage: z.string().max(255).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, (input) => run(() => confluenceClient.updatePage(input)));

  return server;
}
