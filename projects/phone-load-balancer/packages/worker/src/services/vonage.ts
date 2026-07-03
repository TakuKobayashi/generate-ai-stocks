// Vonage Voice API client (using fetch directly for Workers compatibility)
// Vonage Node SDK has Node.js dependencies, so we use REST API directly

export type VonageCallStatus =
  | "started"
  | "ringing"
  | "answered"
  | "machine"
  | "completed"
  | "busy"
  | "cancelled"
  | "failed"
  | "rejected"
  | "timeout"
  | "unanswered";

export type VonageCallEvent = {
  uuid: string;
  conversation_uuid: string;
  call_uuid?: string;
  status: VonageCallStatus;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  timestamp: string;
  duration?: string;
};

export type VonageAnswerEvent = {
  uuid: string;
  conversation_uuid: string;
  from: string;
  to: string;
  direction: "inbound" | "outbound";
};

async function getVonageJWT(
  applicationId: string,
  privateKey: string
): Promise<string> {
  // Build JWT for Vonage API authentication
  const { SignJWT } = await import("jose");
  const keyData = privateKey.replace(/\\n/g, "\n");
  const encoder = new TextEncoder();

  // Import private key - Vonage uses RS256
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToBuffer(keyData),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const jti = crypto.randomUUID();
  return new SignJWT({ application_id: applicationId })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setJti(jti)
    .setExpirationTime("5m")
    .sign(cryptoKey);
}

function pemToBuffer(pem: string): ArrayBuffer {
  const lines = pem
    .split("\n")
    .filter((l) => !l.startsWith("-----") && l.trim() !== "");
  const base64 = lines.join("");
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

export class VonageClient {
  private applicationId: string;
  private privateKey: string;
  private baseUrl = "https://api.nexmo.com";

  constructor(applicationId: string, privateKey: string) {
    this.applicationId = applicationId;
    this.privateKey = privateKey;
  }

  private async getAuthHeaders(): Promise<Headers> {
    const jwt = await getVonageJWT(this.applicationId, this.privateKey);
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${jwt}`);
    headers.set("Content-Type", "application/json");
    return headers;
  }

  // Create an outbound call (for forwarding)
  async createCall(params: {
    to: Array<{ type: "phone"; number: string }>;
    from: { type: "phone"; number: string };
    ncco: object[];
    answerMethod?: string;
    eventUrl?: string[];
    eventMethod?: string;
  }): Promise<{ uuid: string; conversation_uuid: string; status: string }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/v1/calls`, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vonage create call failed: ${response.status} ${error}`);
    }
    return response.json();
  }

  // Transfer an existing call with new NCCO
  async transferCall(callUuid: string, ncco: object[]): Promise<void> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/v1/calls/${callUuid}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ action: "transfer", destination: { type: "ncco", ncco } }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vonage transfer call failed: ${response.status} ${error}`);
    }
  }

  // Hang up a call
  async hangupCall(callUuid: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/v1/calls/${callUuid}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ action: "hangup" }),
    });
    if (!response.ok) {
      // Ignore 404 (call already ended)
      if (response.status !== 404) {
        const error = await response.text();
        throw new Error(`Vonage hangup failed: ${response.status} ${error}`);
      }
    }
  }

  // Stream TTS to a call
  async talkToCall(callUuid: string, text: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/v1/calls/${callUuid}/talk`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ text, language: "ja-JP", style: 0 }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vonage talk failed: ${response.status} ${error}`);
    }
  }
}
