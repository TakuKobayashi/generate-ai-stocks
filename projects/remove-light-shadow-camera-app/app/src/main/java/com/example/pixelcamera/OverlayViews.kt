package com.example.pixelcamera

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View

// ─────────────────────────────────────────────────────────────────────────────
// Grid Overlay
// ─────────────────────────────────────────────────────────────────────────────
class GridOverlayView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null
) : View(context, attrs) {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0x55FFFFFF; strokeWidth = 1f; style = Paint.Style.STROKE
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat(); val h = height.toFloat()
        canvas.drawLine(w / 3f, 0f, w / 3f, h, paint)
        canvas.drawLine(2f * w / 3f, 0f, 2f * w / 3f, h, paint)
        canvas.drawLine(0f, h / 3f, w, h / 3f, paint)
        canvas.drawLine(0f, 2f * h / 3f, w, 2f * h / 3f, paint)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Level Indicator
// ─────────────────────────────────────────────────────────────────────────────
class LevelIndicatorView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null
) : View(context, attrs) {

    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeWidth = 3f; style = Paint.Style.STROKE }
    private val dotPaint  = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = 28f; textAlign = Paint.Align.CENTER; color = Color.WHITE
    }

    var roll: Float = 0f
        set(value) { field = value; invalidate() }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val cx = width / 2f; val cy = height / 2f; val halfLen = 100f
        val isLevel = Math.abs(roll) < 1.5f
        val lineColor = if (isLevel) 0xFF00FF00.toInt() else 0xCCFFFFFF.toInt()
        linePaint.color = lineColor; dotPaint.color = lineColor

        canvas.save()
        canvas.rotate(-roll, cx, cy)
        canvas.drawLine(cx - halfLen, cy, cx + halfLen, cy, linePaint)
        canvas.restore()

        // Fixed center dot
        canvas.drawCircle(cx, cy, 6f, dotPaint)

        if (!isLevel) {
            canvas.drawText(String.format("%.1f°", roll), cx, cy - 120f, textPaint)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Focus Ring (tap-to-focus and motion AF visual feedback)
// ─────────────────────────────────────────────────────────────────────────────
class FocusRingView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null
) : View(context, attrs) {

    enum class FocusSource { MANUAL, MOTION }

    private val manualPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeWidth = 2.5f; color = 0xFFFFD600.toInt()
    }
    private val motionPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeWidth = 2f; color = 0xFF00E5FF.toInt()
    }

    private var cx = 0f; private var cy = 0f
    private var radius = 70f
    private var showing = false
    private var source = FocusSource.MANUAL

    /** タップフォーカス（黄色リング） */
    fun showManualAt(x: Float, y: Float) = show(x, y, FocusSource.MANUAL, 85f)

    /** モーション AF（水色リング・やや大きめ） */
    fun showMotionAt(x: Float, y: Float) = show(x, y, FocusSource.MOTION, 110f)

    private fun show(x: Float, y: Float, src: FocusSource, initRadius: Float) {
        cx = x; cy = y; radius = initRadius; source = src; showing = true
        animate().cancel(); alpha = 1f; invalidate()

        ObjectAnimator.ofFloat(this, "radius", initRadius, initRadius * 0.65f).apply {
            duration = 250; start()
        }
        postDelayed({
            animate().alpha(0f).setDuration(350)
                .setListener(object : AnimatorListenerAdapter() {
                    override fun onAnimationEnd(animation: Animator) {
                        showing = false; invalidate()
                    }
                }).start()
        }, if (src == FocusSource.MOTION) 900L else 1200L)
    }

    fun setRadius(r: Float) { radius = r; invalidate() }

    override fun onDraw(canvas: Canvas) {
        if (!showing) return
        val paint = if (source == FocusSource.MANUAL) manualPaint else motionPaint
        val half = radius; val bracket = half * 0.38f
        listOf(
            floatArrayOf(cx - half, cy - half, cx - half + bracket, cy - half,
                         cx - half, cy - half, cx - half, cy - half + bracket),
            floatArrayOf(cx + half, cy - half, cx + half - bracket, cy - half,
                         cx + half, cy - half, cx + half, cy - half + bracket),
            floatArrayOf(cx - half, cy + half, cx - half + bracket, cy + half,
                         cx - half, cy + half, cx - half, cy + half - bracket),
            floatArrayOf(cx + half, cy + half, cx + half - bracket, cy + half,
                         cx + half, cy + half, cx + half, cy + half - bracket)
        ).forEach { c ->
            canvas.drawLine(c[0], c[1], c[2], c[3], paint)
            canvas.drawLine(c[4], c[5], c[6], c[7], paint)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Motion AF Indicator  ── プレビュー右上に表示するアイコン
// ─────────────────────────────────────────────────────────────────────────────
class MotionAfIndicatorView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null
) : View(context, attrs) {

    /** 現在のモーション状態 */
    var motionState: MotionAutoFocus.MotionState = MotionAutoFocus.MotionState.STILL
        set(value) { field = value; invalidate() }

    private val bgPaint  = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val txtPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = 22f; textAlign = Paint.Align.CENTER; color = Color.WHITE; isFakeBoldText = true
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat(); val h = height.toFloat()

        val (bg, label) = when (motionState) {
            MotionAutoFocus.MotionState.STILL    -> Pair(0xCC1A6B1A.toInt(), "AF待機")
            MotionAutoFocus.MotionState.MOVING   -> Pair(0xCCB85000.toInt(), "移動中")
            MotionAutoFocus.MotionState.SETTLING -> Pair(0xCC00A0CC.toInt(), "AF中…")
        }

        bgPaint.color = bg
        canvas.drawRoundRect(0f, 0f, w, h, 12f, 12f, bgPaint)
        canvas.drawText(label, w / 2f, h / 2f + txtPaint.textSize / 3f, txtPaint)
    }
}
