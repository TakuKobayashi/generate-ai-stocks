/**
 * Google Calendar アクセス層。
 * - 本番: googleapis
 * - モック: メモリ上のカレンダー (MOCK_GOOGLE=true)
 * - DRY RUN: 読み取りは実際に行い、書き込みはログ出力のみ
 *
 * 重複検出のため、登録する予定の extendedProperties.private に以下を保存する:
 *   gcsSource=gmail-calendar-sync, gcsMessageId, gcsReservation, gcsKind, gcsSegment, gcsHash
 */
import { google, type calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { DateTime } from "luxon";
import { log } from "./logger.js";

export type CalEvent = calendar_v3.Schema$Event;

export const PROP = {
  source: "gcsSource",
  messageId: "gcsMessageId",
  reservation: "gcsReservation",
  kind: "gcsKind",
  segment: "gcsSegment",
  hash: "gcsHash",
} as const;
export const SOURCE_VALUE = "gmail-calendar-sync";

export interface CalendarApi {
  /** privateExtendedProperty の AND 検索 */
  findByPrivate(calendarId: string, props: Record<string, string>): Promise<CalEvent[]>;
  /** 期間内の予定 (timeMin/timeMax は ISO 8601) */
  listWindow(calendarId: string, timeMin: string, timeMax: string): Promise<CalEvent[]>;
  insert(calendarId: string, ev: CalEvent): Promise<CalEvent>;
  patch(calendarId: string, id: string, ev: CalEvent): Promise<CalEvent>;
  remove(calendarId: string, id: string): Promise<void>;
}

export class GoogleCalendarApi implements CalendarApi {
  private readonly cal: calendar_v3.Calendar;
  constructor(auth: OAuth2Client) {
    this.cal = google.calendar({ version: "v3", auth });
  }

  async findByPrivate(calendarId: string, props: Record<string, string>): Promise<CalEvent[]> {
    const res = await this.cal.events.list({
      calendarId,
      privateExtendedProperty: Object.entries(props).map(([k, v]) => `${k}=${v}`),
      showDeleted: false,
      singleEvents: true,
      maxResults: 50,
    });
    return res.data.items ?? [];
  }

  async listWindow(calendarId: string, timeMin: string, timeMax: string): Promise<CalEvent[]> {
    const res = await this.cal.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      showDeleted: false,
      maxResults: 100,
    });
    return res.data.items ?? [];
  }

  async insert(calendarId: string, ev: CalEvent): Promise<CalEvent> {
    const res = await this.cal.events.insert({ calendarId, requestBody: ev });
    return res.data;
  }

  async patch(calendarId: string, id: string, ev: CalEvent): Promise<CalEvent> {
    const res = await this.cal.events.patch({ calendarId, eventId: id, requestBody: ev });
    return res.data;
  }

  async remove(calendarId: string, id: string): Promise<void> {
    await this.cal.events.delete({ calendarId, eventId: id });
  }
}

/** 予定の開始・終了を UTC ミリ秒の区間にする (終日は指定タイムゾーンの 0 時基準) */
export function eventInterval(ev: CalEvent, defaultTz = "Asia/Tokyo"): { start: number; end: number } | null {
  const toMs = (t: calendar_v3.Schema$EventDateTime | undefined): number | null => {
    if (!t) return null;
    if (t.dateTime) return DateTime.fromISO(t.dateTime).toMillis();
    if (t.date) return DateTime.fromISO(t.date, { zone: t.timeZone ?? defaultTz }).toMillis();
    return null;
  };
  const s = toMs(ev.start);
  const e = toMs(ev.end);
  if (s === null) return null;
  return { start: s, end: e ?? s };
}

/** メモリ上のカレンダー (モック・テスト用) */
export class MemoryCalendarApi implements CalendarApi {
  readonly events = new Map<string, CalEvent[]>();
  private seq = 0;

  private list(calendarId: string): CalEvent[] {
    if (!this.events.has(calendarId)) this.events.set(calendarId, []);
    return this.events.get(calendarId)!;
  }

  async findByPrivate(calendarId: string, props: Record<string, string>): Promise<CalEvent[]> {
    return this.list(calendarId).filter((e) =>
      Object.entries(props).every(([k, v]) => e.extendedProperties?.private?.[k] === v),
    );
  }

  async listWindow(calendarId: string, timeMin: string, timeMax: string): Promise<CalEvent[]> {
    const a = DateTime.fromISO(timeMin).toMillis();
    const b = DateTime.fromISO(timeMax).toMillis();
    return this.list(calendarId).filter((e) => {
      const iv = eventInterval(e);
      return iv !== null && iv.start < b && iv.end > a;
    });
  }

  async insert(calendarId: string, ev: CalEvent): Promise<CalEvent> {
    const created = { ...ev, id: `mem${++this.seq}` };
    this.list(calendarId).push(created);
    return created;
  }

  async patch(calendarId: string, id: string, ev: CalEvent): Promise<CalEvent> {
    const list = this.list(calendarId);
    const i = list.findIndex((e) => e.id === id);
    if (i < 0) throw new Error(`event ${id} not found`);
    const merged: CalEvent = {
      ...list[i],
      ...ev,
      extendedProperties: {
        private: { ...list[i]!.extendedProperties?.private, ...ev.extendedProperties?.private },
      },
    };
    list[i] = merged;
    return merged;
  }

  async remove(calendarId: string, id: string): Promise<void> {
    const list = this.list(calendarId);
    const i = list.findIndex((e) => e.id === id);
    if (i >= 0) list.splice(i, 1);
  }
}

/** DRY RUN: 読み取りは委譲、書き込みはログのみ */
export class DryRunCalendarApi implements CalendarApi {
  constructor(private readonly inner: CalendarApi) {}
  findByPrivate(c: string, p: Record<string, string>) {
    return this.inner.findByPrivate(c, p);
  }
  listWindow(c: string, a: string, b: string) {
    return this.inner.listWindow(c, a, b);
  }
  async insert(calendarId: string, ev: CalEvent): Promise<CalEvent> {
    log.info(`[DRY RUN] 予定を作成: ${calendarId}`, summarizeEvent(ev));
    return { ...ev, id: "dry-run" };
  }
  async patch(calendarId: string, id: string, ev: CalEvent): Promise<CalEvent> {
    log.info(`[DRY RUN] 予定を更新: ${calendarId}/${id}`, summarizeEvent(ev));
    return { ...ev, id };
  }
  async remove(calendarId: string, id: string): Promise<void> {
    log.info(`[DRY RUN] 予定を削除: ${calendarId}/${id}`);
  }
}

export function summarizeEvent(ev: CalEvent): Record<string, unknown> {
  return {
    summary: ev.summary,
    start: ev.start,
    end: ev.end,
    location: ev.location,
    status: ev.status,
    private: ev.extendedProperties?.private,
  };
}
