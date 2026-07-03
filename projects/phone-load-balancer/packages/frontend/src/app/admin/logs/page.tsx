"use client";
import { useEffect, useState } from "react";
import { api, type CallLog, type Tenant } from "@/lib/api";
import styles from "./logs.module.css";

const OUTCOME_LABELS: Record<string, string> = {
  connected: "接続成功",
  no_answer: "不応答",
  queued: "キュー待ち",
  unknown_number: "番号不明",
  no_forward_numbers: "転送先未登録",
  all_busy: "全回線通話中",
};

const PAGE_SIZE = 20;

export default function LogsPage() {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filterTenantId, setFilterTenantId] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    setOffset(0);
    loadLogs(0);
  }, [filterTenantId]);

  async function loadTenants() {
    try {
      const data = await api.tenants.list();
      setTenants(data);
    } catch {}
  }

  async function loadLogs(newOffset = offset) {
    setLoading(true);
    try {
      const params: { tenantId?: number; limit: number; offset: number } = {
        limit: PAGE_SIZE + 1,
        offset: newOffset,
      };
      if (filterTenantId) params.tenantId = parseInt(filterTenantId);

      const data = await api.callLogs.list(params);
      setHasMore(data.length > PAGE_SIZE);
      setLogs(data.slice(0, PAGE_SIZE));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function prevPage() {
    const newOffset = Math.max(0, offset - PAGE_SIZE);
    setOffset(newOffset);
    loadLogs(newOffset);
  }

  function nextPage() {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    loadLogs(newOffset);
  }

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>通話ログ</h1>
        <button className={styles.refreshBtn} onClick={() => loadLogs(offset)}>
          ↻ 更新
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterField}>
          <label className={styles.filterLabel}>テナントで絞り込み</label>
          <select
            className={styles.select}
            value={filterTenantId}
            onChange={(e) => setFilterTenantId(e.target.value)}
          >
            <option value="">すべてのテナント</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Log table */}
      {loading ? (
        <div className={styles.loading}>読み込み中...</div>
      ) : logs.length === 0 ? (
        <div className={styles.emptyState}>通話ログがありません</div>
      ) : (
        <>
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>発信者番号</span>
              <span>着信番号</span>
              <span>転送先</span>
              <span>結果</span>
              <span>通話時間</span>
              <span>日時</span>
            </div>
            {logs.map((log) => (
              <div key={log.id} className={styles.tableRow}>
                <span className={styles.mono}>{log.callerNumber}</span>
                <span className={styles.mono}>{log.vonageNumber}</span>
                <span className={styles.mono}>
                  {log.forwardedTo ?? <span className={styles.dash}>—</span>}
                </span>
                <OutcomeBadge outcome={log.outcome} />
                <span className={styles.duration}>
                  {log.durationSeconds != null
                    ? formatDuration(log.durationSeconds)
                    : <span className={styles.dash}>—</span>}
                </span>
                <span className={styles.timeStr}>
                  {new Date(log.createdAt).toLocaleString("ja-JP")}
                </span>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              onClick={prevPage}
              disabled={offset === 0}
            >
              ← 前のページ
            </button>
            <span className={styles.pageInfo}>
              ページ {currentPage}
            </span>
            <button
              className={styles.pageBtn}
              onClick={nextPage}
              disabled={!hasMore}
            >
              次のページ →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  return (
    <span className={styles.outcomeBadge} data-outcome={outcome}>
      {OUTCOME_LABELS[outcome] ?? outcome}
    </span>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}分${s}秒`;
}
