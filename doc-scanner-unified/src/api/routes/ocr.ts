import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { processBuffer } from "../../core/processor";

const app = new Hono();

const querySchema = z.object({
  lang: z.enum(["jpn", "eng", "jpn+eng"]).default("jpn+eng"),
});

/**
 * POST /ocr
 * multipart: file=<image>
 * query:     lang=jpn+eng
 */
app.post("/", zValidator("query", querySchema), async (c) => {
  let formData: FormData;
  try { formData = await c.req.formData(); }
  catch { return c.json({ error: "multipart/form-data の解析に失敗しました。" }, 400); }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return c.json({ error: "file フィールドが必要です。" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return c.json({ error: "空のファイルです。" }, 400);

  const { lang } = c.req.valid("query");
  const result = await processBuffer(buffer, {
    filename: file.name,
    lang,
    skipScan: true,
    skipOcr:  false,
  });

  if (!result.ocr) {
    return c.json({ error: result.errors.join(", ") || "OCR 失敗" }, 500);
  }

  return c.json(result.ocr);
});

export default app;
