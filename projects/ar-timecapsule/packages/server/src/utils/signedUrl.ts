type Opts = {
  accountId: string; accessKeyId: string; secretAccessKey: string;
  bucketName: string; key: string; expiresIn: number;
  method?: "GET" | "PUT"; contentType?: string;
};
const toHex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2,"0")).join("");
async function hmac(key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> {
  const k = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const ck = await crypto.subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", ck, new TextEncoder().encode(data));
}
async function sha256(s: string) { return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }

export async function generatePresignedUrl(opts: Opts): Promise<string> {
  const { accountId, accessKeyId, secretAccessKey, bucketName, key, expiresIn, method = "GET", contentType } = opts;
  const region = "auto", service = "s3";
  const now = new Date();
  const ds = now.toISOString().replace(/[-:]/g,"").split("T")[0]!;
  const amz = now.toISOString().replace(/[-:]/g,"").replace(/\.\d+/,"");
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const uri  = `/${bucketName}/${key}`;
  const scope = `${ds}/${region}/${service}/aws4_request`;
  const cred  = `${accessKeyId}/${scope}`;
  const qp = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": cred,
    "X-Amz-Date": amz, "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
    ...(contentType ? { "Content-Type": contentType } : {}),
  });
  const sq = new URLSearchParams([...qp.entries()].sort(([a],[b]) => a.localeCompare(b))).toString();
  const cr = [method, uri, sq, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amz, scope, await sha256(cr)].join("\n");
  const kd = await hmac(`AWS4${secretAccessKey}`, ds);
  const kr = await hmac(kd, region);
  const ks = await hmac(kr, service);
  const kk = await hmac(ks, "aws4_request");
  const sig = toHex(await hmac(kk, sts));
  return `https://${host}${uri}?${sq}&X-Amz-Signature=${sig}`;
}
