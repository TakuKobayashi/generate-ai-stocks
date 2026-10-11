/**
 * Gmail アクセス層。
 * - 本番: googleapis (OAuth2 リフレッシュトークン)
 * - モック: samples/*.eml をメールとして扱う (MOCK_GOOGLE=true、デモ・テスト用)
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { google, type gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { log } from "./logger.js";

export interface MessageRef {
  id: string;
  threadId: string;
}

export interface RawMessage {
  id: string;
  threadId: string;
  raw: Buffer;
  internalDate: Date | null;
  labelIds: string[];
}

export interface MailSource {
  search(query: string, max: number): Promise<MessageRef[]>;
  getRaw(id: string): Promise<RawMessage>;
  /** ラベルが無ければ作成し、ID を返す */
  ensureLabel(name: string): Promise<string>;
  addLabels(id: string, labelIds: string[]): Promise<void>;
}

/** OAuth2 クライアント (Gmail / Calendar 共通) */
export function createGoogleAuth(clientId: string, clientSecret: string, refreshToken: string): OAuth2Client {
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

/** Gmail 検索でネストしたラベルを指定する時は "/" と空白を "-" にする */
export function labelToQuery(name: string): string {
  return name.replace(/[\/\s]/g, "-");
}

/** ユーザー指定のクエリに「処理済みラベルを除外」を付け足す */
export function buildQuery(baseQuery: string, processedLabel: string): string {
  return `${baseQuery} -label:${labelToQuery(processedLabel)}`.trim();
}

export class GoogleMailSource implements MailSource {
  private readonly gmail: gmail_v1.Gmail;
  private labelCache = new Map<string, string>();

  constructor(auth: OAuth2Client) {
    this.gmail = google.gmail({ version: "v1", auth });
  }

  async search(query: string, max: number): Promise<MessageRef[]> {
    const out: MessageRef[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: Math.min(100, max - out.length),
        pageToken,
      });
      for (const m of res.data.messages ?? []) {
        if (m.id) out.push({ id: m.id, threadId: m.threadId ?? m.id });
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken && out.length < max);
    // 古い順に処理する (予約 → 変更 → キャンセル の順序を保つため)
    return out.reverse();
  }

  async getRaw(id: string): Promise<RawMessage> {
    const res = await this.gmail.users.messages.get({ userId: "me", id, format: "raw" });
    const raw = Buffer.from(res.data.raw ?? "", "base64url");
    return {
      id,
      threadId: res.data.threadId ?? id,
      raw,
      internalDate: res.data.internalDate ? new Date(Number(res.data.internalDate)) : null,
      labelIds: res.data.labelIds ?? [],
    };
  }

  async ensureLabel(name: string): Promise<string> {
    const cached = this.labelCache.get(name);
    if (cached) return cached;
    const list = await this.gmail.users.labels.list({ userId: "me" });
    const found = list.data.labels?.find((l) => l.name === name);
    let id = found?.id ?? null;
    if (!id) {
      log.info(`Gmail ラベルを作成します: ${name}`);
      const created = await this.gmail.users.labels.create({
        userId: "me",
        requestBody: { name, labelListVisibility: "labelShow", messageListVisibility: "show" },
      });
      id = created.data.id ?? null;
    }
    if (!id) throw new Error(`ラベル ${name} を作成できませんでした`);
    this.labelCache.set(name, id);
    return id;
  }

  async addLabels(id: string, labelIds: string[]): Promise<void> {
    await this.gmail.users.messages.modify({ userId: "me", id, requestBody: { addLabelIds: labelIds } });
  }
}

/** samples ディレクトリの .eml を Gmail の代わりに使う (モック) */
export class FileMailSource implements MailSource {
  readonly appliedLabels = new Map<string, string[]>();

  constructor(private readonly dir: string) {}

  async search(_query: string, max: number): Promise<MessageRef[]> {
    const files = (await readdir(this.dir)).filter((f) => f.endsWith(".eml")).sort();
    return files.slice(0, max).map((f) => ({ id: f, threadId: f }));
  }

  async getRaw(id: string): Promise<RawMessage> {
    const p = path.join(this.dir, id);
    const raw = await readFile(p);
    // 受信日時は .eml の Date ヘッダを使う (internalDate は null)
    return { id, threadId: id, raw, internalDate: null, labelIds: [] };
  }

  async ensureLabel(name: string): Promise<string> {
    return `mock-label:${name}`;
  }

  async addLabels(id: string, labelIds: string[]): Promise<void> {
    this.appliedLabels.set(id, [...(this.appliedLabels.get(id) ?? []), ...labelIds]);
  }
}

/** 書き込み (ラベル付け) をしない DRY RUN 用ラッパー */
export class DryRunMailSource implements MailSource {
  constructor(private readonly inner: MailSource) {}
  search(q: string, max: number) {
    return this.inner.search(q, max);
  }
  getRaw(id: string) {
    return this.inner.getRaw(id);
  }
  async ensureLabel(name: string): Promise<string> {
    return `dry-run:${name}`;
  }
  async addLabels(id: string, labelIds: string[]): Promise<void> {
    log.info(`[DRY RUN] Gmail ${id} にラベル付与: ${labelIds.join(", ")}`);
  }
}
