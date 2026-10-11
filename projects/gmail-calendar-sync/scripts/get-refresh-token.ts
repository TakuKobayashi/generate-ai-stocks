/**
 * ローカル PC で 1 回だけ実行し、Google のリフレッシュトークンを取得するヘルパー。
 *
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npm run get-token
 *
 * - OAuth クライアントは「デスクトップ アプリ」タイプで作成してください (ループバック リダイレクトが許可される)
 * - スコープ: gmail.modify (読み取り + ラベル付け) と calendar.events (予定の作成・更新)
 * - 表示された URL をブラウザで開いて許可すると、http://127.0.0.1:<port>/callback に戻ってきます
 */
import "dotenv/config";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
];

async function main(): Promise<void> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を環境変数 (または .env) に設定してください。");
    process.exit(1);
  }
  const port = Number(process.env.OAUTH_PORT ?? 0); // 0 = 空いているポートを自動選択

  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const actualPort = (server.address() as AddressInfo).port;
  const redirectUri = `http://127.0.0.1:${actualPort}/callback`;
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline", // リフレッシュトークンを得るために必須
    prompt: "consent", // 2 回目以降もリフレッシュトークンを再発行させる
    scope: SCOPES,
  });

  console.log("\n以下の URL をブラウザで開き、Google アカウントでアクセスを許可してください:\n");
  console.log(authUrl + "\n");
  console.log(`(コールバック待ち受け: ${redirectUri})`);

  const code = await new Promise<string>((resolve, reject) => {
    server.on("request", (req, res) => {
      const url = new URL(req.url ?? "/", redirectUri);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const err = url.searchParams.get("error");
      const c = url.searchParams.get("code");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      if (err || !c) {
        res.end(`<p>認可に失敗しました: ${err ?? "code がありません"}</p>`);
        reject(new Error(err ?? "no code"));
      } else {
        res.end("<p>認可が完了しました。このタブを閉じてターミナルに戻ってください。</p>");
        resolve(c);
      }
    });
  });
  server.close();

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      "リフレッシュトークンが返されませんでした。https://myaccount.google.com/permissions でアプリのアクセス権を削除してから再実行してください。",
    );
    process.exit(1);
  }
  console.log("\n✅ 取得できました。GitHub の Secrets に GOOGLE_REFRESH_TOKEN として登録してください:\n");
  console.log(tokens.refresh_token + "\n");
  console.log(`付与されたスコープ: ${tokens.scope}`);
  console.log(
    "⚠️ OAuth 同意画面が「テスト」状態の場合、このトークンは 7 日で失効します。README の注意事項を参照してください。",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
