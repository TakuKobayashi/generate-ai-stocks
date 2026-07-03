"use client";
import { useEffect, useState } from "react";
import { api, type Tenant, type ForwardNumber } from "@/lib/api";
import styles from "./tenants.module.css";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [forwardNumbers, setForwardNumbers] = useState<ForwardNumber[]>([]);

  useEffect(() => {
    loadTenants();
  }, []);

  async function loadTenants() {
    try {
      const data = await api.tenants.list();
      setTenants(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function selectTenant(tenant: Tenant) {
    setSelectedTenant(tenant);
    const nums = await api.forwardNumbers.list(tenant.id);
    setForwardNumbers(nums);
  }

  if (loading) return <div className={styles.loading}>読み込み中...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>テナント管理</h1>
        <button
          className={styles.btnPrimary}
          onClick={() => setShowCreateTenant(true)}
        >
          + テナントを作成
        </button>
      </div>

      <div className={styles.splitLayout}>
        {/* Tenant list */}
        <div className={styles.tenantList}>
          <h2 className={styles.panelTitle}>テナント一覧</h2>
          {tenants.length === 0 ? (
            <div className={styles.emptyState}>
              テナントがありません。まず作成してください。
            </div>
          ) : (
            tenants.map((tenant) => (
              <div
                key={tenant.id}
                className={`${styles.tenantCard} ${
                  selectedTenant?.id === tenant.id ? styles.tenantCardActive : ""
                }`}
                onClick={() => selectTenant(tenant)}
              >
                <div className={styles.tenantCardHeader}>
                  <span className={styles.tenantName}>{tenant.name}</span>
                  <span
                    className={styles.tenantStatus}
                    data-active={tenant.isActive}
                  >
                    {tenant.isActive ? "有効" : "無効"}
                  </span>
                </div>
                {tenant.vonageNumber && (
                  <div className={styles.tenantNumber}>
                    📞 {tenant.vonageNumber}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Tenant detail */}
        <div className={styles.tenantDetail}>
          {selectedTenant ? (
            <TenantDetail
              tenant={selectedTenant}
              forwardNumbers={forwardNumbers}
              onUpdated={async () => {
                await loadTenants();
                const updated = await api.tenants.get(selectedTenant.id);
                setSelectedTenant(updated);
                const nums = await api.forwardNumbers.list(selectedTenant.id);
                setForwardNumbers(nums);
              }}
              onDeleted={async () => {
                setSelectedTenant(null);
                await loadTenants();
              }}
            />
          ) : (
            <div className={styles.selectHint}>
              テナントを選択して詳細を表示・編集します
            </div>
          )}
        </div>
      </div>

      {/* Create tenant modal */}
      {showCreateTenant && (
        <CreateTenantModal
          onClose={() => setShowCreateTenant(false)}
          onCreated={async () => {
            setShowCreateTenant(false);
            await loadTenants();
          }}
        />
      )}
    </div>
  );
}

function TenantDetail({
  tenant,
  forwardNumbers,
  onUpdated,
  onDeleted,
}: {
  tenant: Tenant;
  forwardNumbers: ForwardNumber[];
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tenant.name);
  const [vonageNumber, setVonageNumber] = useState(tenant.vonageNumber ?? "");
  const [vonageAppId, setVonageAppId] = useState(tenant.vonageAppId ?? "");
  const [saving, setSaving] = useState(false);
  const [showAddNumber, setShowAddNumber] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newPriority, setNewPriority] = useState(1);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    try {
      await api.tenants.update(tenant.id, {
        name,
        vonageNumber: vonageNumber || undefined,
        vonageAppId: vonageAppId || undefined,
      });
      setEditing(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTenant() {
    if (!confirm(`テナント「${tenant.name}」を削除しますか？`)) return;
    await api.tenants.delete(tenant.id);
    onDeleted();
  }

  async function addForwardNumber() {
    if (!newPhone) return;
    try {
      await api.forwardNumbers.create(tenant.id, {
        phoneNumber: newPhone,
        priority: newPriority,
      });
      setNewPhone("");
      setNewPriority(1);
      setShowAddNumber(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "追加失敗");
    }
  }

  async function deleteForwardNumber(id: number) {
    await api.forwardNumbers.delete(tenant.id, id);
    onUpdated();
  }

  async function toggleForwardNumber(id: number, current: boolean) {
    await api.forwardNumbers.update(tenant.id, id, { isActive: !current });
    onUpdated();
  }

  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>{tenant.name}</h2>
        <div className={styles.detailActions}>
          <button
            className={styles.btnSecondary}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "キャンセル" : "編集"}
          </button>
          <button className={styles.btnDanger} onClick={deleteTenant}>
            削除
          </button>
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {editing ? (
        <div className={styles.editForm}>
          <div className={styles.field}>
            <label className={styles.label}>テナント名</label>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Vonage電話番号（着信番号）</label>
            <input
              className={styles.input}
              value={vonageNumber}
              onChange={(e) => setVonageNumber(e.target.value)}
              placeholder="+819012345678"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Vonage Application ID</label>
            <input
              className={styles.input}
              value={vonageAppId}
              onChange={(e) => setVonageAppId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>
          <button
            className={styles.btnPrimary}
            onClick={save}
            disabled={saving}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      ) : (
        <div className={styles.infoGrid}>
          <InfoRow label="テナントID" value={String(tenant.id)} mono />
          <InfoRow
            label="Vonage番号"
            value={tenant.vonageNumber ?? "未設定"}
            mono
          />
          <InfoRow
            label="Application ID"
            value={tenant.vonageAppId ?? "未設定"}
            mono
          />
          <InfoRow label="ステータス" value={tenant.isActive ? "有効" : "無効"} />
          <InfoRow
            label="作成日時"
            value={new Date(tenant.createdAt).toLocaleString("ja-JP")}
          />
        </div>
      )}

      {/* Webhook URLs */}
      <div className={styles.webhookSection}>
        <h3 className={styles.subTitle}>Vonage Webhook URL</h3>
        <p className={styles.webhookHint}>
          VonageのApplication設定に以下のURLを登録してください
        </p>
        <WebhookUrl label="Answer URL" path="/api/webhooks/answer" />
        <WebhookUrl label="Event URL" path="/api/webhooks/call-event" />
        <WebhookUrl label="Fallback URL" path="/api/webhooks/fallback" />
      </div>

      {/* Forward numbers */}
      <div className={styles.forwardSection}>
        <div className={styles.forwardHeader}>
          <h3 className={styles.subTitle}>転送先番号</h3>
          <button
            className={styles.btnSmall}
            onClick={() => setShowAddNumber(!showAddNumber)}
          >
            + 追加
          </button>
        </div>

        {showAddNumber && (
          <div className={styles.addNumberForm}>
            <input
              className={styles.input}
              placeholder="+819012345678"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
            <div className={styles.priorityField}>
              <label className={styles.label}>優先度（小さいほど高優先）</label>
              <input
                type="number"
                min={1}
                className={styles.input}
                value={newPriority}
                onChange={(e) => setNewPriority(parseInt(e.target.value))}
              />
            </div>
            <button className={styles.btnPrimary} onClick={addForwardNumber}>
              登録
            </button>
          </div>
        )}

        {forwardNumbers.length === 0 ? (
          <div className={styles.emptyForward}>転送先番号が登録されていません</div>
        ) : (
          <div className={styles.numberList}>
            <div className={styles.numberListHeader}>
              <span>電話番号</span>
              <span>優先度</span>
              <span>ステータス</span>
              <span>有効</span>
              <span></span>
            </div>
            {[...forwardNumbers]
              .sort((a, b) => a.priority - b.priority)
              .map((num) => (
                <div key={num.id} className={styles.numberRow}>
                  <span className={styles.mono}>{num.phoneNumber}</span>
                  <span className={styles.priorityBadge}>{num.priority}</span>
                  <span
                    className={styles.callStatus}
                    data-status={num.status}
                  >
                    {num.status === "idle"
                      ? "空き"
                      : num.status === "busy"
                      ? "通話中"
                      : "利用不可"}
                  </span>
                  <button
                    className={styles.toggleBtn}
                    data-active={num.isActive}
                    onClick={() => toggleForwardNumber(num.id, num.isActive)}
                  >
                    {num.isActive ? "ON" : "OFF"}
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => deleteForwardNumber(num.id)}
                  >
                    削除
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={mono ? styles.mono : styles.infoValue}>{value}</span>
    </div>
  );
}

function WebhookUrl({ label, path }: { label: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.webhookRow}>
      <span className={styles.webhookLabel}>{label}</span>
      <code className={styles.webhookCode}>{url}</code>
      <button className={styles.copyBtn} onClick={copy}>
        {copied ? "✓" : "コピー"}
      </button>
    </div>
  );
}

function CreateTenantModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [vonageNumber, setVonageNumber] = useState("");
  const [vonageAppId, setVonageAppId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (!name) return;
    setSaving(true);
    try {
      await api.tenants.create({
        name,
        vonageNumber: vonageNumber || undefined,
        vonageAppId: vonageAppId || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>テナントを作成</h2>
        {error && <div className={styles.errorBox}>{error}</div>}
        <div className={styles.field}>
          <label className={styles.label}>テナント名 *</label>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="株式会社○○ サポートセンター"
            autoFocus
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Vonage電話番号（後から設定可）</label>
          <input
            className={styles.input}
            value={vonageNumber}
            onChange={(e) => setVonageNumber(e.target.value)}
            placeholder="+819012345678"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Vonage Application ID（後から設定可）</label>
          <input
            className={styles.input}
            value={vonageAppId}
            onChange={(e) => setVonageAppId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose}>
            キャンセル
          </button>
          <button
            className={styles.btnPrimary}
            onClick={create}
            disabled={saving || !name}
          >
            {saving ? "作成中..." : "作成"}
          </button>
        </div>
      </div>
    </div>
  );
}
