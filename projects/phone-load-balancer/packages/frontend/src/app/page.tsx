import Link from "next/link";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.main}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <span className={styles.logo}>
            <span className={styles.logoMark}>▶</span> PhoneRoute
          </span>
          <Link href="/admin" className={styles.navCta}>
            管理画面
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true">
          {Array.from({ length: 64 }).map((_, i) => (
            <div key={i} className={styles.gridCell} />
          ))}
        </div>
        <div className={styles.heroContent}>
          <div className={styles.eyebrow}>Vonage × Cloudflare Workers</div>
          <h1 className={styles.headline}>
            着信を、
            <br />
            <span className={styles.headlineAccent}>賢くさばく。</span>
          </h1>
          <p className={styles.subheadline}>
            テナントごとに転送先をチームを設定し、
            優先度順に自動転送・キューイング。
            すべてエッジで動く電話ロードバランサー。
          </p>
          <div className={styles.heroCtas}>
            <Link href="/admin" className={styles.ctaPrimary}>
              管理画面を開く
            </Link>
            <a
              href="https://github.com"
              className={styles.ctaSecondary}
              target="_blank"
              rel="noopener noreferrer"
            >
              ドキュメント →
            </a>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <CallFlowDiagram />
        </div>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <div className={styles.featuresInner}>
          <h2 className={styles.sectionTitle}>仕組み</h2>
          <div className={styles.featureGrid}>
            <FeatureCard
              icon="📞"
              title="着信検知"
              description="Vonage番号への着信をwebhookで即座にキャッチ。テナント番号を照合します。"
            />
            <FeatureCard
              icon="⚡"
              title="優先度転送"
              description="登録した転送先に優先順位をつけて自動転送。10秒応答なしで次の番号へ。"
            />
            <FeatureCard
              icon="🔄"
              title="ステータス追跡"
              description="通話中・空きをリアルタイムに管理。空き番号のみに転送します。"
            />
            <FeatureCard
              icon="⏳"
              title="自動キュー"
              description="全員通話中の場合は順番待ちキューへ。空きが出たら自動で転送再開。"
            />
            <FeatureCard
              icon="🏢"
              title="マルチテナント"
              description="複数の企業・部署を1システムで管理。テナントごとに独立した設定。"
            />
            <FeatureCard
              icon="🌐"
              title="エッジ動作"
              description="Cloudflare Workers上で稼働。世界中のエッジから低レイテンシで応答。"
            />
          </div>
        </div>
      </section>

      {/* Flow */}
      <section className={styles.flowSection}>
        <div className={styles.flowInner}>
          <h2 className={styles.sectionTitle}>転送フロー</h2>
          <div className={styles.flowSteps}>
            <FlowStep step={1} label="着信" desc="顧客からVonage番号に電話" />
            <FlowArrow />
            <FlowStep step={2} label="テナント照合" desc="番号からテナントを特定" />
            <FlowArrow />
            <FlowStep step={3} label="転送先選択" desc="空き番号を優先度順で選択" />
            <FlowArrow />
            <FlowStep step={4} label="転送実行" desc="10秒で次の番号へ自動切替" />
            <FlowArrow />
            <FlowStep step={5} label="接続完了" desc="通話成立・ステータス更新" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>PhoneRoute — Built on Vonage + Cloudflare Workers + Hono + D1</p>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className={styles.featureCard}>
      <span className={styles.featureIcon}>{icon}</span>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDesc}>{description}</p>
    </div>
  );
}

function FlowStep({
  step,
  label,
  desc,
}: {
  step: number;
  label: string;
  desc: string;
}) {
  return (
    <div className={styles.flowStep}>
      <div className={styles.flowStepNum}>{step}</div>
      <div className={styles.flowStepLabel}>{label}</div>
      <div className={styles.flowStepDesc}>{desc}</div>
    </div>
  );
}

function FlowArrow() {
  return <div className={styles.flowArrow}>→</div>;
}

function CallFlowDiagram() {
  return (
    <div className={styles.diagram}>
      <div className={styles.diagramBox} data-type="caller">
        📱 発信者
      </div>
      <div className={styles.diagramLine} />
      <div className={styles.diagramBox} data-type="vonage">
        🔵 Vonage
      </div>
      <div className={styles.diagramLine} />
      <div className={styles.diagramBox} data-type="worker">
        ⚡ Worker
      </div>
      <div className={styles.diagramFork}>
        <div className={styles.diagramForwardBox} data-status="active">
          ☎ 担当者A
        </div>
        <div className={styles.diagramForwardBox} data-status="busy">
          ☎ 担当者B (通話中)
        </div>
        <div className={styles.diagramForwardBox} data-status="idle">
          ☎ 担当者C
        </div>
      </div>
    </div>
  );
}
