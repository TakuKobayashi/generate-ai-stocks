/**
 * 1 通のメールを処理するパイプライン:
 *   前処理 → ヒューリスティック → classify → extract → 逐語チェック (+自己検証) → 日時解決 → 重複検出 → 作成/更新/キャンセル
 */
import { DateTime } from "luxon";
import type { AppConfig } from "./config.js";
import { type CalEvent, type CalendarApi } from "./calendar.js";
import { describeWhen } from "./dates.js";
import { findExisting, type CompareTarget, type SameEventJudge } from "./dedupe.js";
import type { MailSource } from "./gmail.js";
import { log, redact, type RunSummary } from "./logger.js";
import type { OllamaClient } from "./llm/ollama.js";
import {
  classifyMessages,
  extractMessages,
  sameEventMessages,
  verifyMessages,
  type EmailForPrompt,
} from "./llm/prompts.js";
import { ClassifySchema, ExtractSchema, SameEventSchema, VerifySchema } from "./llm/schemas.js";
import { looksLikeSchedule, prepareEmail, type PreparedEmail } from "./mime.js";
import { gmailLink, planEvents, verifyAgainstSource, type PlannedEvent } from "./planner.js";

export interface PipelineDeps {
  cfg: AppConfig;
  mail: MailSource;
  cal: CalendarApi;
  llm: OllamaClient;
  summary: RunSummary;
  labels: { processed: string; review: string };
}

/**
 * num_ctx のうち本文に使えるトークン数。
 * 実測 (qwen2.5): extract のシステムプロンプト + few-shot 5 例 ≒ 2,000 token、出力は最大 ~1,000 token を見込む。
 * Ollama はプロンプトが num_ctx を超えると「先頭」(= システムプロンプト) から切り捨てるので、必ず収める。
 */
export function bodyTokenBudget(cfg: AppConfig): number {
  return Math.max(1000, cfg.llm.numCtx - 2300 - 1000);
}

function toPrompt(email: PreparedEmail): EmailForPrompt {
  return {
    subject: email.subject,
    from: email.from,
    receivedDate: email.referenceDate.setLocale("ja").toFormat("yyyy-MM-dd (ccc)"),
    forwarded: email.forward.isForwarded,
    body: email.llmText,
  };
}

const CANCEL_PREFIX = "【キャンセル】";

export async function processMessage(id: string, deps: PipelineDeps): Promise<void> {
  const { cfg, mail, llm, summary } = deps;
  const raw = await mail.getRaw(id);
  const email = await prepareEmail(raw.raw, {
    gmailId: raw.id,
    threadId: raw.threadId,
    internalDate: raw.internalDate,
    maxBodyChars: cfg.llm.maxBodyChars,
    bodyTokenBudget: bodyTokenBudget(cfg),
    defaultTimezone: cfg.calendar.defaultTimezone,
  });
  summary.counters.scanned++;
  log.group(`📨 ${redact(email.subject)} (${id})`);
  try {
    log.info(
      `差出人: ${redact(email.from)} / 基準日: ${email.referenceDate.toISODate()} / 転送: ${email.forward.isForwarded} / 本文 ${email.fullText.length} 字 → LLM ${email.llmText.length} 字`,
    );

    // --- 0) 安価なヒューリスティック ---
    if (!looksLikeSchedule(email.subject, email.fullText)) {
      log.info("日付表記が無いためスキップ (ヒューリスティック)");
      summary.counters.skipped++;
      summary.add({ subject: email.subject, kind: "-", action: "スキップ", title: "", when: "", note: "日付表記なし" });
      await mail.addLabels(id, [deps.labels.processed]);
      return;
    }

    const prompt = toPrompt(email);

    // --- 1) classify ---
    const cls = await llm.chatJson(ClassifySchema, classifyMessages(prompt), { numPredict: 200, label: "classify" });
    log.info(`分類: ${cls.kind} (${cls.confidence}) — ${cls.reason}`);
    if (cls.kind === "not_schedule" && cls.confidence >= 0.7) {
      summary.counters.skipped++;
      summary.add({ subject: email.subject, kind: cls.kind, action: "スキップ", title: "", when: "", note: cls.reason });
      await mail.addLabels(id, [deps.labels.processed]);
      return;
    }

    // --- 2) extract ---
    const ext = await llm.chatJson(ExtractSchema, extractMessages(prompt, cls.kind), {
      numPredict: 1500,
      label: "extract",
    });
    log.debug("抽出結果", ext);
    if (ext.events.length === 0) {
      const suspicious = cls.kind !== "not_schedule" && cls.confidence >= 0.7;
      summary.counters.skipped++;
      if (suspicious) summary.counters.review++;
      summary.add({
        subject: email.subject,
        kind: cls.kind,
        action: suspicious ? "要確認" : "スキップ",
        title: "",
        when: "",
        note: "予定を抽出できず",
      });
      await mail.addLabels(id, suspicious ? [deps.labels.processed, deps.labels.review] : [deps.labels.processed]);
      return;
    }

    // --- 3) 逐語チェック (決定的) ---
    const haystack = `${email.subject}\n${email.fullText}`;
    const verified = ext.events.map((ev) => {
      const r = verifyAgainstSource(ev, haystack, email.referenceDate);
      for (const i of r.issues) log.warn(`逐語チェック [${i.severity}] ${i.field}: ${i.message}`);
      return { ...r, llmIssues: 0 };
    });

    // --- 3b) LLM 自己検証 (任意) ---
    const anyIssue = verified.some((v) => v.issues.length > 0);
    const doSelfCheck =
      cfg.llm.selfCheck === "always" || (cfg.llm.selfCheck === "auto" && (anyIssue || cls.confidence < 0.75));
    if (doSelfCheck) {
      try {
        const vr = await llm.chatJson(
          VerifySchema,
          verifyMessages(prompt, verified.map((v) => v.event)),
          { numPredict: 600, label: "verify" },
        );
        for (const issue of vr.issues) {
          const target = verified[issue.event_index];
          if (target) target.llmIssues++;
          log.warn(`自己検証: event[${issue.event_index}].${issue.field}: ${issue.problem}`);
        }
      } catch (err) {
        log.warn("自己検証に失敗 (続行します)", String(err));
      }
    }

    // --- 4) 日時解決 → 計画 ---
    const { planned, failures } = planEvents(email, cls, verified, {
      calendarId: cfg.calendar.calendarId,
      reviewCalendarId: cfg.calendar.reviewCalendarId,
      defaultTimezone: cfg.calendar.defaultTimezone,
      defaultEventMinutes: cfg.calendar.defaultEventMinutes,
      lodgingMode: cfg.calendar.lodgingMode,
      minConfidence: cfg.calendar.minConfidence,
      model: llm.model,
    });
    let needsReview = false;
    for (const f of failures) {
      needsReview = true;
      summary.counters.review++;
      log.warn(`日時を解決できません: ${f.title}: ${f.reason}`);
      summary.add({ subject: email.subject, kind: cls.kind, action: "要確認 (未登録)", title: f.title, when: "", note: f.reason });
    }

    // --- 5) 重複検出 → 反映 ---
    for (const p of planned) {
      if (p.needsReview) {
        needsReview = true;
        summary.counters.review++;
      }
      await applyPlanned(p, email, cls.kind, deps);
    }

    const labels = [deps.labels.processed];
    if (needsReview) labels.push(deps.labels.review);
    await mail.addLabels(id, labels);
  } finally {
    log.groupEnd();
  }
}

function makeJudge(deps: PipelineDeps): SameEventJudge {
  return async (planned: CompareTarget, existing: CalEvent, isChange: boolean) => {
    const fmt = (ms: number) => DateTime.fromMillis(ms).setZone(deps.cfg.calendar.defaultTimezone).toFormat("yyyy-MM-dd HH:mm");
    const exWhen = existing.start?.dateTime ?? existing.start?.date ?? "";
    const res = await deps.llm.chatJson(
      SameEventSchema,
      sameEventMessages(
        {
          title: planned.title,
          when: `${fmt(planned.interval.start)}〜${fmt(planned.interval.end)}`,
          location: planned.location,
          reservation: planned.reservation,
        },
        {
          title: existing.summary ?? "",
          when: `${exWhen}〜${existing.end?.dateTime ?? existing.end?.date ?? ""}`,
          location: existing.location ?? "",
          reservation: existing.extendedProperties?.private?.gcsReservation ?? "",
          description: existing.description ?? "",
        },
        isChange,
      ),
      { numPredict: 200, label: "same-event" },
    );
    log.info(`同一判定 (LLM): "${existing.summary}" → ${res.same} (${res.confidence}) ${res.reason}`);
    return res.same && res.confidence >= 0.6;
  };
}

async function applyPlanned(p: PlannedEvent, email: PreparedEmail, classKind: string, deps: PipelineDeps): Promise<void> {
  const { cfg, cal, summary } = deps;
  const when = describeWhen(p.when);
  const calendarIds = [cfg.calendar.calendarId, ...(cfg.calendar.reviewCalendarId ? [cfg.calendar.reviewCalendarId] : [])];
  const row = (action: string, note = "") =>
    summary.add({
      subject: email.subject,
      kind: classKind,
      action,
      title: p.summary,
      when,
      note: [note, `信頼度 ${p.confidence.toFixed(2)}`].filter(Boolean).join(" / "),
    });

  const match = await findExisting(
    {
      title: p.baseTitle,
      interval: p.interval,
      location: p.location,
      reservation: p.reservation,
      kind: p.kind,
      segment: p.segment,
      gmailId: p.gmailId,
      hash: p.hash,
      isChange: p.status === "changed",
    },
    cal,
    calendarIds,
    makeJudge(deps),
    cfg.calendar.defaultTimezone,
  );
  if (match) log.info(`既存予定と一致 (${match.how}, score=${match.score}): "${match.event.summary}"`);

  // --- キャンセル ---
  if (p.status === "cancelled") {
    if (!match?.event.id) {
      summary.counters.review++;
      row("要確認", "キャンセル対象の予定が見つかりません");
      return;
    }
    if (cfg.calendar.cancelMode === "delete") {
      await cal.remove(match.calendarId, match.event.id);
      row("削除 (キャンセル)", `一致: ${match.how}`);
    } else {
      const current = match.event.summary ?? "";
      if (current.startsWith(CANCEL_PREFIX)) {
        summary.counters.duplicates++;
        row("変更なし", "既にキャンセル済み");
        return;
      }
      await cal.patch(match.calendarId, match.event.id, {
        summary: `${CANCEL_PREFIX}${current}`,
        transparency: "transparent",
        description: `${match.event.description ?? ""}\n\n❌ キャンセル通知 (${email.referenceDate.toISODate()}): ${gmailLink(email)}`.slice(0, 8000),
      });
      row("キャンセル済みに変更", `一致: ${match.how}`);
    }
    summary.counters.cancelled++;
    return;
  }

  // --- 既存あり ---
  if (match?.event.id) {
    const existingHash = match.event.extendedProperties?.private?.gcsHash;
    if (existingHash === p.hash) {
      summary.counters.duplicates++;
      row("重複 (スキップ)", `一致: ${match.how}`);
      return;
    }
    // 同じ予約 (予約番号・同じメール) で内容が違う、または変更通知 → 更新
    if (p.status === "changed" || match.how === "reservation" || match.how === "message") {
      const old = match.event.start?.dateTime ?? match.event.start?.date ?? "?";
      const ev: CalEvent = {
        ...p.calendarEvent,
        description: `${p.calendarEvent.description ?? ""}\n\n🔁 更新 (${email.referenceDate.toISODate()}): 旧開始 ${old}`,
      };
      await cal.patch(match.calendarId, match.event.id, ev);
      summary.counters.updated++;
      row("更新", `一致: ${match.how}`);
      return;
    }
    // あいまい一致した既存予定 (手入力の予定やリマインドメール) → 重複として作らない
    summary.counters.duplicates++;
    row("重複 (スキップ)", `一致: ${match.how} "${match.event.summary ?? ""}"`);
    return;
  }

  // --- 新規 ---
  await cal.insert(p.calendarId, p.calendarEvent);
  summary.counters.created++;
  row(p.needsReview ? "作成 (要確認)" : "作成", p.status === "changed" ? "変更前の予定が見つからないため新規作成" : "");
}
