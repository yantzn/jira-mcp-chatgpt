import type { AppConfig } from "./config.js";
import { textToConfluenceStorage } from "./confluence-storage.js";

export class ConfluenceApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ConfluenceApiError";
  }
}

export class ConfluenceClient {
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
      const data = body as { message?: string } | null;
      throw new ConfluenceApiError(
        response.status,
        this.errorCode(response.status),
        data?.message || `Confluence APIがHTTP ${response.status}を返しました`,
      );
    }
    return body as T;
  }

  private errorCode(status: number): string {
    if (status === 400) return "confluence_invalid_request";
    if (status === 401) return "confluence_authentication_failed";
    if (status === 403) return "confluence_permission_denied";
    if (status === 404) return "confluence_not_found";
    if (status === 409) return "confluence_conflict";
    if (status === 429) return "confluence_rate_limited";
    return status >= 500 ? "confluence_unavailable" : "confluence_request_failed";
  }

  async listSpaces(limit = 25): Promise<unknown> {
    return this.request(`/wiki/api/v2/spaces?status=current&limit=${limit}`);
  }

  async searchContent(cql: string, limit = 20): Promise<unknown> {
    return this.request(
      `/wiki/rest/api/search?cql=${encodeURIComponent(cql)}&limit=${limit}`,
    );
  }

  async getPage(pageId: string): Promise<unknown> {
    return this.request(
      `/wiki/api/v2/pages/${encodeURIComponent(pageId)}?body-format=storage`,
    );
  }

  async createPage(input: {
    spaceId: string;
    title: string;
    content: string;
    parentId?: string;
  }): Promise<unknown> {
    return this.request("/wiki/api/v2/pages", {
      method: "POST",
      body: JSON.stringify({
        spaceId: input.spaceId,
        status: "current",
        title: input.title,
        ...(input.parentId ? { parentId: input.parentId } : {}),
        body: {
          representation: "storage",
          value: textToConfluenceStorage(input.content),
        },
      }),
    });
  }

  async updatePage(input: {
    pageId: string;
    title: string;
    content: string;
    currentVersion: number;
    versionMessage?: string;
  }): Promise<unknown> {
    return this.request(`/wiki/api/v2/pages/${encodeURIComponent(input.pageId)}`, {
      method: "PUT",
      body: JSON.stringify({
        id: input.pageId,
        status: "current",
        title: input.title,
        body: {
          representation: "storage",
          value: textToConfluenceStorage(input.content),
        },
        version: {
          number: input.currentVersion + 1,
          ...(input.versionMessage ? { message: input.versionMessage } : {}),
        },
      }),
    });
  }
}
