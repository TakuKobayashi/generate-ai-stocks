/**
 * api/server.ts
 * Hono サーバーエントリポイント — `npm run serve`
 */

import { serve }      from "@hono/node-server";
import { Hono }       from "hono";
import { cors }       from "hono/cors";
import { logger }     from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { timing }     from "hono/timing";

import ocrRoute     from "./routes/ocr";
import scanRoute    from "./routes/scan";
import processRoute from "./routes/process";

const app = new Hono();

app.use("*", logger());
app.use("*", timing());
app.use("*", prettyJSON());
app.use("*", cors({
  origin:         "*",
  allowMethods:   ["GET", "POST", "OPTIONS"],
  allowHeaders:   ["Content-Type", "Authorization"],
}));

app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() })
);

app.get("/", (c) =>
  c.json({
    name: "doc-scanner-api",
    endpoints: {
      "GET  /health":  "ヘルスチェック",
      "POST /ocr":     "OCR テキスト抽出 (?lang=jpn+eng)",
      "POST /scan":    "ドキュメントスキャン補正",
      "POST /process": "スキャン + OCR 一括 (?lang&skipScan&skipOcr)",
    },
  })
);

app.route("/ocr",     ocrRoute);
app.route("/scan",    scanRoute);
app.route("/process", processRoute);

app.notFound((c) => c.json({ error: `Not Found: ${c.req.path}` }, 404));
app.onError((err, c) => {
  console.error("[ERROR]", err);
  return c.json({ error: "Internal Server Error", message: err.message }, 500);
});

const PORT = parseInt(process.env.PORT ?? "8080", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`✅ doc-scanner API running at http://localhost:${info.port}`);
});

export default app;
