# Personal Jira MCP

Jira Cloud REST API v3をMCPツールとして公開する、個人利用向けのDocker専用サーバーです。ホスト側へNode.jsやnpmをインストールする必要はありません。

## 提供ツール

- `list_projects`: プロジェクト一覧
- `search_issues`: JQLによる課題検索
- `get_issue`: 課題詳細取得
- `get_create_metadata`: 利用可能な課題タイプ取得
- `create_issue`: 課題作成
- `update_issue`: 課題更新
- `add_comment`: コメント追加

読み取りツールと書き込みツールはMCP annotationで区別しています。説明とコメントはJira REST API v3が要求するADFへ変換します。

## 前提

- Docker DesktopまたはDocker Engine
- Docker Compose v2
- Jira CloudのAPIトークン

## セットアップ

```powershell
cd C:\work\jira-mcp
Copy-Item .env.example .env
```

`.env`を編集します。

```dotenv
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_DEFAULT_PROJECT_KEY=PROJECT
HOST=0.0.0.0
PORT=8787
MCP_ACCESS_TOKEN=十分に長いランダム文字列
```

APIトークンはAtlassianアカウントのセキュリティ設定から作成してください。`.env`はGit管理対象外です。

PowerShellでMCP用トークンを生成する例:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

## 起動

```powershell
docker compose up --build -d
```

状態とログを確認します。

```powershell
docker compose ps
docker compose logs -f jira-mcp
```

接続先:

- Health check: `http://localhost:8787/`
- MCP endpoint: `http://localhost:8787/mcp`
- MCP認証: `Authorization: Bearer <MCP_ACCESS_TOKEN>`

## 停止

```powershell
docker compose down
```

## 更新

```powershell
docker compose build --no-cache
docker compose up -d
```

Dockerイメージのビルド中に型検査、単体テスト、TypeScriptビルドが自動実行されます。いずれかが失敗するとイメージは作成されません。

## セキュリティ上の注意

- Jira APIトークン、メールアドレス、`MCP_ACCESS_TOKEN`をソースコードへ記載しないでください。
- `.env`をGitへ追加しないでください。
- サーバーはコンテナ内で外部向けアドレスを使うため、`MCP_ACCESS_TOKEN`が未設定だと起動を拒否します。
- Composeのポートはホストの `127.0.0.1` のみに公開され、初期状態では同一PC以外から接続できません。
- この個人利用版のBearer保護は、ChatGPTの正式なOAuth接続を代替するものではありません。
- ChatGPTへ直接公開する段階では、MCP OAuth 2.1対応とJira OAuth 2.0（3LO）への移行を推奨します。
- 書き込み操作は内容を確認してから承認してください。

## ChatGPT接続について

ChatGPTから接続するには、HTTPSで到達できる `/mcp` URLと、ChatGPTが利用できる認証方式が必要です。現在のDocker構成は同一PC上での安全な動作確認用です。ChatGPT公開前にOAuth対応とHTTPS公開構成を追加してください。
