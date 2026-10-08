import type { AppConfig } from "./config.js";
import { textToAdf } from "./adf.js";

export class JiraApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "JiraApiError";
  }
}

type JsonObject = Record<string, unknown>;

export class JiraClient {
  private readonly authorization: string;

  constructor(private readonly config: AppConfig) {
    this.authorization = `Basic ${Buffer.from(
      `${config.jiraEmail}:${config.jiraApiToken}`,
      "utf8",
    ).toString("base64")}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.jiraBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: this.authorization,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const data = body as { errorMessages?: string[]; errors?: Record<string, string> } | null;
      const message = data?.errorMessages?.[0]
        || (data?.errors ? Object.values(data.errors)[0] : undefined)
        || `Jira APIがHTTP ${response.status}を返しました`;
      throw new JiraApiError(response.status, this.errorCode(response.status), message);
    }
    return body as T;
  }

  private errorCode(status: number): string {
    if (status === 400) return "jira_invalid_request";
    if (status === 401) return "jira_authentication_failed";
    if (status === 403) return "jira_permission_denied";
    if (status === 404) return "jira_not_found";
    if (status === 429) return "jira_rate_limited";
    return status >= 500 ? "jira_unavailable" : "jira_request_failed";
  }

  async listProjects(maxResults = 50): Promise<unknown> {
    return this.request(`/rest/api/3/project/search?maxResults=${maxResults}`);
  }

  async searchIssues(jql: string, maxResults = 20): Promise<unknown> {
    return this.request("/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify({
        jql,
        maxResults,
        fields: ["summary", "status", "issuetype", "priority", "assignee", "updated"],
      }),
    });
  }

  async getIssue(issueKey: string): Promise<unknown> {
    return this.request(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary,description,status,issuetype,priority,assignee,reporter,labels,comment,created,updated`,
    );
  }

  async getCreateMetadata(projectKey: string): Promise<unknown> {
    return this.request(`/rest/api/3/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes`);
  }

  async createIssue(input: {
    projectKey?: string;
    issueType: string;
    summary: string;
    description?: string;
    labels?: string[];
    priority?: string;
  }): Promise<unknown> {
    const projectKey = input.projectKey || this.config.defaultProjectKey;
    if (!projectKey) {
      throw new JiraApiError(400, "project_key_required", "projectKeyを指定してください");
    }
    const fields: JsonObject = {
      project: { key: projectKey },
      issuetype: { name: input.issueType },
      summary: input.summary,
    };
    if (input.description !== undefined) fields.description = textToAdf(input.description);
    if (input.labels !== undefined) fields.labels = input.labels;
    if (input.priority !== undefined) fields.priority = { name: input.priority };
    return this.request("/rest/api/3/issue", {
      method: "POST",
      body: JSON.stringify({ fields }),
    });
  }

  async updateIssue(issueKey: string, input: {
    summary?: string;
    description?: string;
    labels?: string[];
    priority?: string;
  }): Promise<{ key: string; updated: true }> {
    const fields: JsonObject = {};
    if (input.summary !== undefined) fields.summary = input.summary;
    if (input.description !== undefined) fields.description = textToAdf(input.description);
    if (input.labels !== undefined) fields.labels = input.labels;
    if (input.priority !== undefined) fields.priority = { name: input.priority };
    await this.request(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
      method: "PUT",
      body: JSON.stringify({ fields }),
    });
    return { key: issueKey, updated: true };
  }

  async addComment(issueKey: string, comment: string): Promise<unknown> {
    return this.request(`/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`, {
      method: "POST",
      body: JSON.stringify({ body: textToAdf(comment) }),
    });
  }
}
