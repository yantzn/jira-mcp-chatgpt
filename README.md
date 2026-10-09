# Personal Atlassian MCP

Jira CloudとConfluence CloudをMCPツールとして公開する個人利用向けサーバーです。Docker ComposeでAtlassian MCPとOpenAI Secure MCP Tunnelを起動し、ChatGPTからはトンネル経由、Gemini CLIからはローカルHTTP経由で利用します。

```text
ChatGPT ─ OpenAI Secure MCP Tunnel ─ tunnel-client ─ Atlassian MCP ─ Jira Cloud
                                               ↑                 └ Confluence Cloud
Gemini CLI ─ http://127.0.0.1:8787/mcp ────────┘
```

Atlassian MCPはインターネットへ公開しません。ホスト側のMCPポートは既定で`127.0.0.1`だけに公開します。

## 提供ツール

- `list_projects`: プロジェクト一覧
- `search_issues`: JQLによる課題検索
- `get_issue`: 課題詳細取得
- `get_create_metadata`: 利用可能な課題タイプ取得
- `create_issue`: 課題作成
- `update_issue`: 課題更新
- `add_comment`: コメント追加
- `list_confluence_spaces`: Confluenceスペース一覧
- `search_confluence_content`: CQLによるConfluence検索
- `get_confluence_page`: ページ本文と現在の版番号を取得
- `create_confluence_page`: プレーンテキストからページを作成
- `update_confluence_page`: 現在の版番号を指定してページを更新

## 前提

- Docker DesktopまたはDocker Engine
- Docker Compose v2
- Jira CloudとConfluence CloudへアクセスできるAtlassian APIトークン
- OpenAI PlatformのTunnel ID
- Tunnel用Runtime API key
- ChatGPTでカスタムMCPアプリを追加できる権限
- Gemini CLI（Geminiから利用する場合）

## 1. OpenAI Secure MCP Tunnelを作成

OpenAI PlatformのTunnel設定で次を行います。

1. 個人用Platform Organizationを選択します。
2. MCP Tunnelを作成します。
3. 使用するChatGPT workspaceを関連付けます。
4. `tunnel_id`を控えます。
5. Tunnel用Runtime API keyを発行します。

通常のOpenAI API keyとTunnel用Runtime API keyを混同しないでください。Tunnel実行にはTunnels Read + Use、Tunnel作成にはTunnels Read + Manage権限が必要です。

公式手順: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels

## 2. 設定ファイルを作成

```powershell
cd C:\work\jira-mcp
Copy-Item .env.example .env
Copy-Item .secrets.example .secrets -Recurse
```

`.env`を編集します。

```dotenv
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_DEFAULT_PROJECT_KEY=PROJECT
HOST=0.0.0.0
PORT=8787
MCP_BIND_ADDRESS=127.0.0.1
CONTROL_PLANE_TUNNEL_ID=tunnel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`.secrets/jira-api-token`にはAtlassian APIトークンだけを記載します。同じAtlassian CloudサイトのJiraとConfluenceで共用します。

```text
your-jira-api-token
```

`.secrets/control-plane-api-key`にはOpenAI Tunnel用Runtime API keyだけを記載します。

```text
sk-your-runtime-api-key
```

`.secrets/mcp-authorization-header`には`Bearer `を含む完全な認証ヘッダー値を記載します。

```text
Bearer 十分に長いランダム文字列
```

PowerShellでランダム文字列を生成する例:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

`.env`と`.secrets/`はGit管理対象外です。

## 3. Docker Composeで起動

```powershell
docker compose up --build -d
docker compose ps
```

両方のサービスがhealthyになることを確認します。

```powershell
docker compose logs -f jira-mcp tunnel-client
```

主な接続経路:

- Atlassian MCP内部URL: `http://jira-mcp:8787/mcp`
- Gemini CLI用URL: `http://127.0.0.1:8787/mcp`
- Tunnelの管理画面は外部公開しません

Atlassian MCPと`tunnel-client`は内部Dockerネットワークで通信します。`tunnel-client`だけがOpenAI APIへの外向きHTTPS通信を持ちます。

## 4. ChatGPTへ接続

1. ChatGPTのPluginsを開きます。
2. `Add custom MCP server`を選択します。
3. Connectionで`Tunnel`を選択します。
4. `.env`に設定したTunnelを選択します。
5. 認証方式はTunnelの設定に合わせます。この構成ではAtlassian MCPの固定Bearerは`tunnel-client`が内部で付与します。
6. リスク警告を確認して作成・インストールします。
7. Workチャットで作成したAtlassianアプリを選択します。

使用例:

```text
PROJプロジェクトの未完了課題を一覧表示してください。
```

```text
次の内容でBugを作成してください。
要約: ログイン画面でAPIエラーが表示されない
説明: 500応答時にユーザー向けメッセージを表示する
優先度: High
```

```text
Confluenceから「運用手順」を含むページを検索してください。
```

```text
ConfluenceのENGスペースに「障害対応手順」というページを作成してください。
本文: 一次対応の担当者は当番表を確認してください。
```

ページを更新するときは、先に`get_confluence_page`で現在の`version.number`を取得し、その値を`currentVersion`として指定します。古い版番号のまま更新した場合は競合として失敗し、ページを上書きしません。

## 5. Gemini CLIへ接続

認証ヘッダーを秘密ファイルから読み込み、Gemini CLIへ登録します。

```powershell
$atlassianMcpAuth = (Get-Content -Raw .secrets\mcp-authorization-header).Trim()
gemini mcp add `
  --scope user `
  --transport http `
  --header "Authorization: $atlassianMcpAuth" `
  --description "個人用Jira・Confluence Cloud連携" `
  atlassian `
  http://127.0.0.1:8787/mcp
Remove-Variable atlassianMcpAuth
```

登録を確認します。

```powershell
gemini mcp list
```

Gemini CLIでの使用例:

```text
JiraのPROJプロジェクトから、自分が担当する未完了課題を検索してください。
```

```text
Confluenceで直近1か月に更新された設計ページを検索してください。
```

書き込み確認を維持するため、`--trust`は指定しないことを推奨します。

## 停止・再起動

```powershell
docker compose down
docker compose up -d
```

`tunnel-client`が停止している間、ChatGPTからはAtlassian MCPを利用できません。Gemini CLIは`jira-mcp`コンテナが起動していれば利用できます。

## 更新

```powershell
docker compose pull tunnel-client
docker compose build --no-cache jira-mcp
docker compose up -d
```

`tunnel-client`は安全性と再現性のため、`compose.yaml`で公式イメージの特定バージョンへ固定しています。更新時はOpenAI公式リリースを確認してタグを変更してください。

## セキュリティ

- Atlassian APIトークン、Runtime API key、MCP認証ヘッダーをコミットしないでください。
- APIトークンの所有者には、操作対象のJiraプロジェクトとConfluenceスペースだけを付与してください。
- MCPポートは`127.0.0.1`のみに公開してください。
- `MCP_BIND_ADDRESS=0.0.0.0`へ変更しないでください。
- 自宅LAN内の別PCから利用する場合も、ファイアウォールと接続元IP制限を追加してください。
- Tunnel用Runtime API keyには必要最小限のTunnels Read + Use権限だけを付与してください。
- 書き込みツールの承認を無効化しないでください。
- `.secrets/mcp-authorization-header`の値を定期的にローテーションしてください。
- `docker compose config`は環境変数を展開する場合があります。出力を共有しないでください。

## トラブルシューティング

```powershell
docker compose ps
docker compose logs --tail 200 jira-mcp
docker compose logs --tail 200 tunnel-client
```

確認ポイント:

- `jira-mcp`がhealthyか
- `tunnel-client`がhealthyか
- Tunnel IDが正しいか
- Runtime API keyにTunnels Read + Useがあるか
- TunnelとChatGPT workspaceが関連付いているか
- PCから`api.openai.com:443`へ接続できるか
- `.secrets/mcp-authorization-header`が`Bearer `で始まっているか
