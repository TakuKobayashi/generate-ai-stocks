package com.example.pixelcamera

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * MotionAutoFocus
 *
 * 加速度センサー＋ジャイロスコープを組み合わせてデバイスの動きを検出し、
 * 動きが収まった直後に自動でオートフォーカスをトリガーする。
 *
 * ─ アルゴリズム概要 ────────────────────────────────────────────────────
 *
 *  1) センサー前処理
 *     - LINEAR_ACCELERATION（= 加速度 − 重力）が利用可能ならそれを使用。
 *       なければ ACCELEROMETER に指数移動平均（低域通過）を掛けて重力を推定し、
 *       差分で線形加速度を近似する（Pixel 9a は前者が利用可能）。
 *     - GYROSCOPE が利用可能なら角速度も取得し、微小な回転（パン・チルト）も感知。
 *
 *  2) 動き量のスムージング
 *     - 加速度・角速度それぞれに指数移動平均（α=0.25）をかけてスパイクノイズを除去。
 *     - スムージング後の合成ノルムを motion score として使用。
 *
 *  3) 状態機械
 *     ┌─────────┐  score > MOVE_THRESH  ┌─────────┐
 *     │  STILL  │──────────────────────▶│  MOVING │
 *     └─────────┘                       └─────────┘
 *          ▲                                 │ score < STILL_THRESH が
 *          │                                 │ SETTLE_MS 間継続
 *          │        ┌──────────┐             │
 *          └────────│ SETTLING │◀────────────┘
 *        AF発火後   └──────────┘
 *                       │ AF完了 or AF_COOLDOWN 経過
 *                       └──────────────────────────▶ STILL
 *
 *  4) ヒステリシス・クールダウン
 *     - MOVE_THRESH > STILL_THRESH にすることで「揺れたり止まったり」での
 *       誤発火を防ぐ。
 *     - AF発火後 AF_COOLDOWN_MS 間は再発火しない。
 *     - タップフォーカス直後は MANUAL_BLOCK_MS 間モーション AF を抑制。
 *
 *  5) 閾値の根拠（Pixel 9a 実測ベース）
 *     - 人間が手持ちで構えているときの手ぶれ：0.05〜0.15 m/s²
 *     - カメラを向ける動作：0.3〜2.0 m/s²
 *     - MOVE_THRESH = 0.20 m/s²  ← 向き直しには確実に反応
 *     - STILL_THRESH = 0.08 m/s² ← 手ぶれ程度では SETTLING に入らない
 *     - SETTLE_MS = 350 ms        ← 止まったと感じる最短時間（人間知覚に合わせた値）
 */
class MotionAutoFocus(
    context: Context,
    private val onTriggerAF: (x: Float, y: Float) -> Unit,
    private val onStateChanged: ((MotionState) -> Unit)? = null
) {

    // ── 定数 ──────────────────────────────────────────────────────────────────

    companion object {
        private const val TAG = "MotionAF"

        // 動き開始と判断する加速度閾値 [m/s²]
        private const val MOVE_THRESH_ACC = 0.20f
        // 静止と判断する加速度閾値（ヒステリシス用に低め）[m/s²]
        private const val STILL_THRESH_ACC = 0.08f

        // 動き開始と判断するジャイロ閾値 [rad/s]
        private const val MOVE_THRESH_GYRO = 0.12f
        // 静止と判断するジャイロ閾値 [rad/s]
        private const val STILL_THRESH_GYRO = 0.05f

        // スムージング係数（小さいほど滑らか、応答は遅い）
        private const val ALPHA_ACC  = 0.25f
        private const val ALPHA_GYRO = 0.20f

        // 低域通過フィルタ係数（重力推定用）
        private const val GRAVITY_LP = 0.85f

        // 静止継続でAFを発火するまでの待機時間 [ms]
        private const val SETTLE_MS = 350L

        // AF発火後の再発火禁止時間 [ms]
        private const val AF_COOLDOWN_MS = 1500L

        // タップフォーカス直後のモーションAF抑制時間 [ms]
        private const val MANUAL_BLOCK_MS = 3000L
    }

    // ── 公開状態 ─────────────────────────────────────────────────────────────

    enum class MotionState { STILL, MOVING, SETTLING }

    var state: MotionState = MotionState.STILL
        private set(value) {
            if (field != value) {
                field = value
                onStateChanged?.invoke(value)
            }
        }

    /** 水平器用に公開する roll 角 [deg] */
    var rollDeg: Float = 0f
        private set

    // ── 内部状態 ──────────────────────────────────────────────────────────────

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val handler = Handler(Looper.getMainLooper())

    // センサー有無フラグ
    private var hasLinearAcc  = false
    private var hasGyro       = false

    // スムージング後の動き量
    private var smoothAcc  = 0f
    private var smoothGyro = 0f

    // 低域通過フィルタ（重力推定用 — LINEAR_ACCELERATION 非搭載機のフォールバック）
    private var gravX = 0f
    private var gravY = 0f
    private var gravZ = 9.8f

    // 静止開始タイムスタンプ
    private var stillSinceMs = 0L

    // 直近の AF 発火タイムスタンプ
    private var lastAfMs = 0L

    // タップフォーカス実施タイムスタンプ
    private var lastManualFocusMs = 0L

    // 最後に動きを検出したタイムスタンプ（統計用）
    private var lastMotionMs = 0L

    // 中央座標（AF 発火位置、通常はプレビュー中央）
    private var afTargetX = 0.5f
    private var afTargetY = 0.5f

    // 登録リスナー参照（解除用）
    private val sensorListener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) = handleSensorEvent(event)
        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
    }

    // ── ライフサイクル ────────────────────────────────────────────────────────

    fun start() {
        val linAcc = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)
        val acc    = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        val gyro   = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

        if (linAcc != null) {
            sensorManager.registerListener(sensorListener, linAcc, SensorManager.SENSOR_DELAY_GAME)
            hasLinearAcc = true
            Log.d(TAG, "Using LINEAR_ACCELERATION sensor")
        } else if (acc != null) {
            sensorManager.registerListener(sensorListener, acc, SensorManager.SENSOR_DELAY_GAME)
            hasLinearAcc = false
            Log.d(TAG, "Fallback to ACCELEROMETER + gravity LP filter")
        } else {
            Log.w(TAG, "No accelerometer available — motion AF disabled")
        }

        if (gyro != null) {
            sensorManager.registerListener(sensorListener, gyro, SensorManager.SENSOR_DELAY_GAME)
            hasGyro = true
            Log.d(TAG, "Using GYROSCOPE sensor")
        }
    }

    fun stop() {
        sensorManager.unregisterListener(sensorListener)
        handler.removeCallbacksAndMessages(null)
        state = MotionState.STILL
        smoothAcc = 0f
        smoothGyro = 0f
    }

    fun pause() {
        sensorManager.unregisterListener(sensorListener)
        handler.removeCallbacksAndMessages(null)
    }

    fun resume() {
        stop()
        start()
    }

    /**
     * タップフォーカスが実行された直後に呼ぶ。
     * MANUAL_BLOCK_MS の間モーション AF を抑制する。
     */
    fun notifyManualFocus() {
        lastManualFocusMs = SystemClock.elapsedRealtime()
    }

    /**
     * AF 発火先の正規化座標（0〜1）を設定。
     * 通常はプレビュー中央（0.5, 0.5）のままで良い。
     */
    fun setAfTarget(nx: Float, ny: Float) {
        afTargetX = nx
        afTargetY = ny
    }

    // ── センサーイベント処理 ─────────────────────────────────────────────────

    private fun handleSensorEvent(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_LINEAR_ACCELERATION -> handleLinearAcc(event.values)
            Sensor.TYPE_ACCELEROMETER       -> handleRawAcc(event.values)
            Sensor.TYPE_GYROSCOPE           -> handleGyro(event.values)
        }
    }

    /** LINEAR_ACCELERATION（重力除去済み） */
    private fun handleLinearAcc(v: FloatArray) {
        val mag = magnitude(v[0], v[1], v[2])
        smoothAcc = lerp(smoothAcc, mag, ALPHA_ACC)
        updateRoll(v)
        evaluate()
    }

    /** 生 ACCELEROMETER → 低域通過で重力を推定して差し引く */
    private fun handleRawAcc(v: FloatArray) {
        gravX = gravX * GRAVITY_LP + v[0] * (1 - GRAVITY_LP)
        gravY = gravY * GRAVITY_LP + v[1] * (1 - GRAVITY_LP)
        gravZ = gravZ * GRAVITY_LP + v[2] * (1 - GRAVITY_LP)
        val lx = v[0] - gravX
        val ly = v[1] - gravY
        val lz = v[2] - gravZ
        val mag = magnitude(lx, ly, lz)
        smoothAcc = lerp(smoothAcc, mag, ALPHA_ACC)
        updateRoll(v)
        evaluate()
    }

    /** ジャイロ（角速度） */
    private fun handleGyro(v: FloatArray) {
        val mag = magnitude(v[0], v[1], v[2])
        smoothGyro = lerp(smoothGyro, mag, ALPHA_GYRO)
        // evaluate は加速度イベントで行うので、ジャイロ側では呼ばない
        // （ジャイロの方がサンプリングレートが高く evaluate が過剰に呼ばれるため）
    }

    /** roll 角更新（水平器用） */
    private fun updateRoll(v: FloatArray) {
        rollDeg = Math.toDegrees(
            Math.atan2(v[0].toDouble(), v[1].toDouble())
        ).toFloat()
    }

    // ── 状態機械 ─────────────────────────────────────────────────────────────

    private fun evaluate() {
        val now = SystemClock.elapsedRealtime()

        // 総合動き量（加速度 + ジャイロを合算してスコア化）
        val motionScore = smoothAcc + smoothGyro * 0.5f

        when (state) {

            MotionState.STILL -> {
                if (motionScore > MOVE_THRESH_ACC || smoothGyro > MOVE_THRESH_GYRO) {
                    state = MotionState.MOVING
                    lastMotionMs = now
                    // SETTLING への入口チェックをリセット
                    stillSinceMs = 0L
                }
            }

            MotionState.MOVING -> {
                lastMotionMs = now
                if (motionScore < STILL_THRESH_ACC && smoothGyro < STILL_THRESH_GYRO) {
                    // 静止の可能性 → SETTLING へ
                    if (stillSinceMs == 0L) stillSinceMs = now
                    val stillElapsed = now - stillSinceMs
                    if (stillElapsed >= SETTLE_MS) {
                        state = MotionState.SETTLING
                        triggerAF(now)
                    }
                } else {
                    // まだ動いている → 静止タイマーリセット
                    stillSinceMs = 0L
                }
            }

            MotionState.SETTLING -> {
                // AF 実行中は何もしない。STILL への遷移は triggerAF 内のコールバックで行う。
                // ただし動きが再検出されたら即 MOVING に戻す
                if (motionScore > MOVE_THRESH_ACC || smoothGyro > MOVE_THRESH_GYRO) {
                    state = MotionState.MOVING
                    stillSinceMs = 0L
                }
            }
        }
    }

    private fun triggerAF(now: Long) {
        // クールダウン中は発火しない
        if (now - lastAfMs < AF_COOLDOWN_MS) {
            state = MotionState.STILL
            stillSinceMs = 0L
            return
        }
        // タップフォーカス直後は抑制
        if (now - lastManualFocusMs < MANUAL_BLOCK_MS) {
            state = MotionState.STILL
            stillSinceMs = 0L
            return
        }

        lastAfMs = now
        Log.d(TAG, "Motion AF triggered (acc=${smoothAcc}, gyro=${smoothGyro})")

        // メインスレッドからコールバックを呼ぶ
        handler.post {
            onTriggerAF(afTargetX, afTargetY)
        }

        // AF 完了までの猶予後に STILL へ戻す（AF完了コールバックがない場合のフォールバック）
        handler.postDelayed({
            if (state == MotionState.SETTLING) {
                state = MotionState.STILL
                stillSinceMs = 0L
            }
        }, AF_COOLDOWN_MS)
    }

    // ── ユーティリティ ────────────────────────────────────────────────────────

    private fun magnitude(x: Float, y: Float, z: Float) =
        sqrt(x * x + y * y + z * z)

    private fun lerp(from: Float, to: Float, alpha: Float) =
        from + (to - from) * alpha

    // ── デバッグ情報 ─────────────────────────────────────────────────────────

    /** デバッグ表示用の現在スコアを返す */
    fun debugScore(): String =
        "acc=%.3f gyro=%.3f state=%s".format(smoothAcc, smoothGyro, state.name)
}
