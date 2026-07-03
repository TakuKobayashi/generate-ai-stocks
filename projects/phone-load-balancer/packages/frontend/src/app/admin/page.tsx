"use client";
import { useEffect, useState } from "react";
import { api, type Tenant, type CallLeg, type CallLog } from "@/lib/api";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeCalls, setActiveCalls] = useState<CallLeg[]>([]);
  const [recentLogs, setRecentLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [t, a, l] = await Promise.all([
        api.tenants.list(),
        api.callLogs.active(),
        api.callLogs.list({ limit: 10 }),
      ]);
      setTenants(t);
      setActiveCalls(a);
      setRecentLogs(l);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const activeTenants = tenants.filter((t) => t.isActive);
  const ringing = activeCalls.filter((c) => c.status === "ringing").length;
  const connected = activeCalls.filter((c) => c.status === "connected").length;
  const queued = activeCalls.filter((c) => c.status === "queued").length;

  if (loading) return <LoadingState />;

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>ダッシュボード</h1>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <StatCard label="テナント数" value={activeTenants.length} icon="🏢" />
        <StatCard label="発信中" value={ringing} icon="📞" color="warning" />
        <StatCard label="通話中" value={connected} icon="✅" color="success" />
        <StatCard label="待機中" value={queued} icon="⏳" color="muted" />
      </div>

      {/* Active calls */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          アクティブな通話
          <span className={styles.badge}>{activeCalls.length}</span>
        </h2>
        {activeCalls.length === 0 ? (
          <EmptyState message="現在アクティブな通話はありません" />
        ) : (
          <div className={styles.callTable}>
            <div className={styles.tableHeader}>
              <span>発信者</span>
              <span>テナントID</span>
              <span>ステータス</span>
              <span>開始時刻</span>
            </div>
            {activeCalls.map((call) => (
              <div key={call.id} className={styles.tableRow}>
                <span className={styles.mono}>{call.callerNumber}</span>
                <span>{call.tenantId}</span>
                <StatusBadge status={call.status} />
                <span className={styles.timeStr}>
                  {new Date(call.createdAt).toLocaleTimeString("ja-JP")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent call logs */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>最近の通話ログ</h2>
        {recentLogs.length === 0 ? (
          <EmptyState message="通話ログがありません" />
        ) : (
          <div className={styles.callTable}>
            <div className={styles.tableHeader}>
              <span>発信者</span>
              <span>着信番号</span>
              <span>結果</span>
              <span>時刻</span>
            </div>
            {recentLogs.map((log) => (
              <div key={log.id} className={styles.tableRow}>
                <span className={styles.mono}>{log.callerNumber}</span>
                <span className={styles.mono}>{log.vonageNumber}</span>
                <OutcomeBadge outcome={log.outcome} />
                <span className={styles.timeStr}>
                  {new Date(log.createdAt).toLocaleString("ja-JP")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color?: "success" | "warning" | "muted";
}) {
  return (
    <div className={styles.statCard} data-color={color}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: CallLeg["status"] }) {
  const labels: Record<CallLeg["status"], string> = {
    ringing: "発信中",
    connected: "通話中",
    queued: "待機中",
    completed: "完了",
    failed: "失敗",
  };
  return (
    <span className={styles.statusBadge} data-status={status}>
      {labels[status]}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const labels: Record<string, string> = {
    connected: "接続",
    no_answer: "不応答",
    queued: "キュー",
    unknown_number: "番号不明",
    no_forward_numbers: "転送先なし",
    all_busy: "全通話中",
  };
  return (
    <span className={styles.outcomeBadge} data-outcome={outcome}>
      {labels[outcome] ?? outcome}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className={styles.emptyState}>{message}</div>;
}

function LoadingState() {
  return (
    <div className={styles.page}>
      <div className={styles.loading}>読み込み中...</div>
    </div>
  );
}
