import { Hono } from "hono";
import { processBuffer } from "../../core/processor";

const app = new Hono();

/**
 * POST /scan
 * multipart: file=<image>
 * response:  補正済み画像バイナリ（元フォーマット）
 *            輪郭未検出時は JSON { fallback:true, image:base64, mimeType }
 */
app.post("/", async (c) => {
  let formData: FormData;
  try { formData = await c.req.formData(); }
  catch { return c.json({ error: "multipart/form-data の解析に失敗しました。" }, 400); }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return c.json({ error: "file フィールドが必要です。" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return c.json({ error: "空のファイルです。" }, 400);

  const result = await processBuffer(buffer, {
    filename: file.name,
    lang:     "jpn+eng",
    skipScan: false,
    skipOcr:  true,
  });

  const scan = result.scan;
  if (!scan) {
    return c.json({ error: "スキャン処理に失敗しました。" }, 500);
  }

  if (!scan.scanned) {
    return c.json({
      error:    scan.message,
      fallback: true,
      image:    scan.buffer.toString("base64"),
      mimeType: scan.mimeType,
    }, 200);
  }

  return new Response(scan.buffer, {
    status: 200,
    headers: {
      "Content-Type":   scan.mimeType,
      "X-Scan-Status":  "success",
    },
  });
});

export default app;
