# Personal Jira MCP

Jira Cloud REST API v3をMCPツールとして公開する、個人利用向けのTypeScriptサーバーです。

## 提供ツール

- `list_projects`: プロジェクト一覧
- `search_issues`: JQLによる課題検索
- `get_issue`: 課題詳細取得
- `get_create_metadata`: 利用可能な課題タイプ取得
- `create_issue`: 課題作成
- `update_issue`: 課題更新
- `add_comment`: コメント追加

読み取りツールと書き込みツールはMCP annotationで区別しています。説明とコメントはJira REST API v3が要求するADFへ変換します。

## セットアップ

前提はNode.js 20以降です。

```powershell
npm install
Copy-Item .env.example .env
```

`.env`を編集します。

```dotenv
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_DEFAULT_PROJECT_KEY=PROJECT
HOST=127.0.0.1
PORT=8787
MCP_ACCESS_TOKEN=
```

APIトークンはAtlassianアカウントのセキュリティ設定から作成してください。`.env`はGit管理対象外です。

## 起動と確認

```powershell
npm run dev
```

MCP endpointは `http://127.0.0.1:8787/mcp`、health checkは `http://127.0.0.1:8787/` です。

MCP Inspectorで確認できます。

```powershell
npx @modelcontextprotocol/inspector@latest
```

## テスト

```powershell
npm run typecheck
npm test
npm run build
```

## Docker

```powershell
docker build -t personal-jira-mcp .
docker run --rm --env-file .env -p 8787:8787 personal-jira-mcp
```

Docker利用時は `.env` の `HOST=0.0.0.0` と、十分に長い `MCP_ACCESS_TOKEN` を設定してください。

## セキュリティ上の注意

- Jira APIトークンやメールアドレスをソースコードへ記載しないでください。
- `HOST=0.0.0.0` などで外部公開する場合、サーバーは `MCP_ACCESS_TOKEN` が未設定だと起動を拒否します。
- この個人利用版のBearer保護は、ChatGPTの正式なOAuth接続を代替するものではありません。
- ChatGPTへ直接公開する段階では、MCP OAuth 2.1対応とJira OAuth 2.0（3LO）への移行を推奨します。
- 書き込み操作はChatGPT側でも内容を確認してから承認してください。

## ChatGPT接続について

ChatGPTから接続するには、HTTPSで到達できる `/mcp` URLが必要です。ただし、Jira APIトークンを保持した無認証サーバーをインターネットへ公開してはいけません。本リポジトリはまずローカルMCPクライアントとInspectorで動作確認し、ChatGPT公開前にOAuth対応を追加する前提です。
