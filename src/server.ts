import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { ConfluenceClient } from "./confluence-client.js";
import { JiraClient } from "./jira-client.js";
import { createAtlassianMcpServer } from "./mcp-server.js";

const config = loadConfig();

if (config.host !== "127.0.0.1" && config.host !== "localhost" && !config.mcpAuthorizationHeader) {
  throw new Error("外部向けアドレスで起動する場合はMCP認証ヘッダーの設定が必要です");
}

const unauthorized = (res: ServerResponse) => {
  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "unauthorized" }));
};

const isAuthorized = (req: IncomingMessage): boolean => {
  if (!config.mcpAuthorizationHeader) return true;
  return req.headers.authorization === config.mcpAuthorizationHeader;
};

const httpServer = createServer(async (req, res) => {
  if (req.url === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "personal-atlassian-mcp" }));
    return;
  }
  if (req.url !== "/mcp") {
    res.writeHead(404).end("Not Found");
    return;
  }
  if (!isAuthorized(req)) {
    unauthorized(res);
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const mcpServer = createAtlassianMcpServer(
    new JiraClient(config),
    new ConfluenceClient(config),
  );
  res.on("close", () => {
    void transport.close();
    void mcpServer.close();
  });
  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
  } catch {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "mcp_request_failed" }));
    }
  }
});

httpServer.listen(config.port, config.host, () => {
  console.log(`Atlassian MCP server: http://${config.host}:${config.port}/mcp`);
});
