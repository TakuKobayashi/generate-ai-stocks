// apps/android/app/src/main/java/com/arpreview/ar/ARCoreSession.kt
// ARCore セッションを管理し、毎フレームのデータを Flow で提供する。

package com.arpreview.ar

import android.content.Context
import android.util.Log
import com.google.ar.core.*
import com.google.ar.core.exceptions.*
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.*
import java.nio.ByteBuffer

private const val TAG = "ARCoreSession"

// ─────────────────────────────────────────────────────────────────
// フレームデータ (ARCore → Transport へ渡す中間型)
// ─────────────────────────────────────────────────────────────────

data class ARFrameData(
    val timestampMs: Long,
    val frameNumber: Long,
    // カメラ姿勢 (Unity 座標系に変換済み)
    val tx: Float, val ty: Float, val tz: Float,
    val rx: Float, val ry: Float, val rz: Float, val rw: Float,
    // 内部パラメータ
    val fx: Float, val fy: Float,
    val ppx: Float, val ppy: Float,
    val imageWidth: Int, val imageHeight: Int,
    // 環境光
    val averageLuminance: Float,
    val colorTemperature: Float,
    // カメラ画像バッファ (YUV or JPEG)
    val imageBuffer: ByteBuffer?,
    val imageFormat: Int,
)

data class ARPlaneData(
    val id: String,
    val event: PlaneEventType,
    val trackingState: TrackingState,
    val alignment: Plane.Type,
    val cx: Float, val cy: Float, val cz: Float,
    val rx: Float, val ry: Float, val rz: Float, val rw: Float,
    val extentX: Float, val extentZ: Float,
    val boundaryXZ: FloatArray,  // interleaved [x0,z0, x1,z1, ...]
    val subsumedById: String?,
)

enum class PlaneEventType { ADDED, UPDATED, REMOVED }

// ─────────────────────────────────────────────────────────────────
// ARCoreSession
// ─────────────────────────────────────────────────────────────────

class ARCoreSession(private val context: Context) {

    private var session: Session? = null
    private var frameNumber = 0L

    // 前フレームのプレーン状態 (差分計算用)
    private val prevPlaneIds = mutableSetOf<String>()

    // ─── ライフサイクル ──────────────────────────────────────────

    fun create(): Boolean {
        if (!isARCoreSupported()) {
            Log.e(TAG, "ARCore is not supported on this device")
            return false
        }
        return try {
            session = Session(context).apply {
                configure(Config(this).apply {
                    planeFindingMode   = Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
                    lightEstimationMode = Config.LightEstimationMode.ENVIRONMENTAL_HDR
                    updateMode         = Config.UpdateMode.LATEST_CAMERA_IMAGE
                    focusMode          = Config.FocusMode.AUTO
                })
            }
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create ARCore session: ${e.message}")
            false
        }
    }

    fun resume() = session?.resume()
    fun pause()  = session?.pause()

    fun destroy() {
        session?.close()
        session = null
    }

    private fun isARCoreSupported(): Boolean =
        ArCoreApk.getInstance()
            .checkAvailability(context) == ArCoreApk.Availability.SUPPORTED_INSTALLED

    // ─── フレーム取得 Flow ───────────────────────────────────────

    /**
     * SurfaceTexture を ARCore に設定した後、
     * callbackFlow で毎フレームの ARFrameData を emit する。
     * 呼び出し側が surfaceTexture を update してから collect する。
     */
    fun frameFlow(): Flow<ARFrameData> = flow {
        val s = session ?: error("Session not created")
        while (true) {
            val frame = try { s.update() } catch (e: Exception) {
                Log.w(TAG, "Frame update error: ${e.message}")
                continue
            }
            if (frame.camera.trackingState != TrackingState.TRACKING) continue

            emit(buildFrameData(frame))
        }
    }

    fun planeUpdateFlow(): Flow<List<ARPlaneData>> = flow {
        val s = session ?: error("Session not created")
        while (true) {
            val frame = try { s.update() } catch (e: Exception) { continue }
            val planes = buildPlaneDiff(frame)
            if (planes.isNotEmpty()) emit(planes)
        }
    }

    // ─── ビルダー ────────────────────────────────────────────────

    private fun buildFrameData(frame: Frame): ARFrameData {
        val cam  = frame.camera
        val pose = cam.pose

        // ARCore は OpenGL (右手系 Y-up) → Unity (左手系 Y-up) 変換
        // Z 軸の符号を反転する
        val tx =  pose.tx()
        val ty =  pose.ty()
        val tz = -pose.tz()
        val rx = -pose.qx()
        val ry = -pose.qy()
        val rz =  pose.qz()
        val rw =  pose.qw()

        // 内部パラメータ
        val intr        = cam.imageIntrinsics
        val focalLength = intr.focalLength
        val principal   = intr.principalPoint
        val imageSize   = intr.imageDimensions

        // 環境光
        val lightEst = frame.lightEstimate
        val lum  = lightEst?.pixelIntensity ?: 0f
        val temp = 6500f  // ARCore HDR では SphericalHarmonics から算出が正確だが簡略化

        return ARFrameData(
            timestampMs  = frame.timestamp / 1_000_000L,
            frameNumber  = frameNumber++,
            tx = tx, ty = ty, tz = tz,
            rx = rx, ry = ry, rz = rz, rw = rw,
            fx  = focalLength[0], fy = focalLength[1],
            ppx = principal[0],   ppy = principal[1],
            imageWidth  = imageSize[0],
            imageHeight = imageSize[1],
            averageLuminance  = lum,
            colorTemperature  = temp,
            imageBuffer = null,   // Video Track で送るので不要
            imageFormat = 0,
        )
    }

    private fun buildPlaneDiff(frame: Frame): List<ARPlaneData> {
        val s = session ?: return emptyList()
        val result = mutableListOf<ARPlaneData>()

        val currentPlanes = s.getAllTrackables(Plane::class.java)
        val currentIds    = currentPlanes.map { it.hashCode().toString() }.toSet()

        for (plane in currentPlanes) {
            val id    = plane.hashCode().toString()
            val event = when {
                id !in prevPlaneIds -> PlaneEventType.ADDED
                else                -> PlaneEventType.UPDATED
            }
            if (plane.trackingState == TrackingState.STOPPED) continue
            result += buildPlaneData(plane, id, event)
        }

        // 消えたプレーン
        for (id in prevPlaneIds - currentIds) {
            result += ARPlaneData(
                id = id, event = PlaneEventType.REMOVED,
                trackingState = TrackingState.STOPPED,
                alignment = Plane.Type.HORIZONTAL_UPWARD_FACING,
                cx = 0f, cy = 0f, cz = 0f,
                rx = 0f, ry = 0f, rz = 0f, rw = 1f,
                extentX = 0f, extentZ = 0f,
                boundaryXZ = floatArrayOf(),
                subsumedById = null,
            )
        }

        prevPlaneIds.clear()
        prevPlaneIds.addAll(currentIds)
        return result
    }

    private fun buildPlaneData(plane: Plane, id: String, event: PlaneEventType): ARPlaneData {
        val cp   = plane.centerPose
        // ARCore → Unity 座標変換 (Z 反転)
        val cx   =  cp.tx()
        val cy   =  cp.ty()
        val cz   = -cp.tz()
        val rx   = -cp.qx()
        val ry   = -cp.qy()
        val rz   =  cp.qz()
        val rw   =  cp.qw()

        // Boundary polygon (plane 局所座標系の XZ)
        val poly  = plane.polygon
        val bxz   = FloatArray(poly.limit())
        poly.rewind()
        poly.get(bxz)

        return ARPlaneData(
            id            = id,
            event         = event,
            trackingState = plane.trackingState,
            alignment     = plane.type,
            cx = cx, cy = cy, cz = cz,
            rx = rx, ry = ry, rz = rz, rw = rw,
            extentX       = plane.extentX,
            extentZ       = plane.extentZ,
            boundaryXZ    = bxz,
            subsumedById  = plane.subsumedBy?.hashCode()?.toString(),
        )
    }
}
