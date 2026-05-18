import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { processBuffer } from "../../core/processor";

const app = new Hono();

const querySchema = z.object({
  lang:     z.enum(["jpn", "eng", "jpn+eng"]).default("jpn+eng"),
  skipScan: z.string().transform((v) => v === "true" || v === "1").default("false"),
  skipOcr:  z.string().transform((v) => v === "true" || v === "1").default("false"),
});

/**
 * POST /process
 * multipart: file=<image>
 * query:     lang, skipScan, skipOcr
 *
 * response:
 *   {
 *     ocr:  { text, confidence, lang } | null,
 *     scan: { image:base64, mimeType, scanned } | null
 *   }
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

  const { lang, skipScan, skipOcr } = c.req.valid("query");

  const result = await processBuffer(buffer, {
    filename: file.name,
    lang,
    skipScan,
    skipOcr,
  });

  return c.json({
    ocr:    result.ocr  ?? null,
    scan:   result.scan
      ? {
          image:    result.scan.buffer.toString("base64"),
          mimeType: result.scan.mimeType,
          scanned:  result.scan.scanned,
          message:  result.scan.message,
        }
      : null,
    errors: result.errors,
  });
});

export default app;
