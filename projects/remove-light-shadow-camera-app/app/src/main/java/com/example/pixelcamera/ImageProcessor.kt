package com.example.pixelcamera

import android.graphics.Bitmap
import org.opencv.android.Utils
import org.opencv.core.*
import org.opencv.imgproc.Imgproc
import org.opencv.photo.Photo

object ImageProcessor {

    fun removeLights(src: Bitmap, strength: Float = 0.7f): Bitmap {
        val mat = Mat(); Utils.bitmapToMat(src, mat)
        val bgr = Mat(); Imgproc.cvtColor(mat, bgr, Imgproc.COLOR_RGBA2BGR)
        val lab = Mat(); Imgproc.cvtColor(bgr, lab, Imgproc.COLOR_BGR2Lab)
        val ch = mutableListOf<Mat>(); Core.split(lab, ch)

        val lut = buildHighlightLUT(strength)
        val lProc = Mat(); Core.LUT(ch[0], lut, lProc)
        val clahe = Imgproc.createCLAHE(1.5, Size(8.0, 8.0))
        val lClahe = Mat(); clahe.apply(lProc, lClahe)
        val lBlend = Mat()
        Core.addWeighted(lProc, 1.0 - 0.3 * strength, lClahe, 0.3 * strength, 0.0, lBlend)

        ch[0] = lBlend
        val labOut = Mat(); Core.merge(ch, labOut)
        val bgrOut = Mat(); Imgproc.cvtColor(labOut, bgrOut, Imgproc.COLOR_Lab2BGR)

        val hsv = Mat(); Imgproc.cvtColor(bgrOut, hsv, Imgproc.COLOR_BGR2HSV)
        val hCh = mutableListOf<Mat>(); Core.split(hsv, hCh)
        desaturateHighlights(hCh[1], hCh[2], strength)
        Core.merge(hCh, hsv); Imgproc.cvtColor(hsv, bgrOut, Imgproc.COLOR_HSV2BGR)

        val result = Mat(); Imgproc.cvtColor(bgrOut, result, Imgproc.COLOR_BGR2RGBA)
        val out = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
        Utils.matToBitmap(result, out)
        listOf(mat,bgr,lab,lProc,lClahe,lBlend,labOut,bgrOut,result,hsv,lut).forEach(Mat::release)
        (ch+hCh).forEach(Mat::release)
        return out
    }

    fun removeShadows(src: Bitmap, strength: Float = 0.7f): Bitmap {
        val mat = Mat(); Utils.bitmapToMat(src, mat)
        val bgr = Mat(); Imgproc.cvtColor(mat, bgr, Imgproc.COLOR_RGBA2BGR)
        val lab = Mat(); Imgproc.cvtColor(bgr, lab, Imgproc.COLOR_BGR2Lab)
        val ch = mutableListOf<Mat>(); Core.split(lab, ch)

        val lut = buildShadowLUT(strength)
        val lLifted = Mat(); Core.LUT(ch[0], lut, lLifted)
        val clahe = Imgproc.createCLAHE(2.0 + 2.0 * strength, Size(8.0, 8.0))
        val lClahe = Mat(); clahe.apply(lLifted, lClahe)
        val lBlend = Mat()
        Core.addWeighted(lLifted, 1.0 - 0.4 * strength, lClahe, 0.4 * strength, 0.0, lBlend)

        ch[0] = lBlend
        val labOut = Mat(); Core.merge(ch, labOut)
        val bgrOut = Mat(); Imgproc.cvtColor(labOut, bgrOut, Imgproc.COLOR_Lab2BGR)
        val denoised = Mat()
        Photo.fastNlMeansDenoisingColored(bgrOut, denoised, 5f * strength, 5f * strength, 7, 21)

        val result = Mat(); Imgproc.cvtColor(denoised, result, Imgproc.COLOR_BGR2RGBA)
        val out = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
        Utils.matToBitmap(result, out)
        listOf(mat,bgr,lab,lLifted,lClahe,lBlend,labOut,bgrOut,denoised,result,lut).forEach(Mat::release)
        ch.forEach(Mat::release)
        return out
    }

    fun processForPreview(src: Bitmap, mode: CameraMode, strength: Float = 0.7f, maxDim: Int = 720): Bitmap {
        val scale = minOf(1f, maxDim.toFloat() / maxOf(src.width, src.height))
        val small = if (scale < 1f)
            Bitmap.createScaledBitmap(src, (src.width * scale).toInt(), (src.height * scale).toInt(), false)
        else src
        val processed = when (mode) {
            CameraMode.LIGHT_REMOVAL  -> removeLights(small, strength)
            CameraMode.SHADOW_REMOVAL -> removeShadows(small, strength)
            else -> small
        }
        return if (scale < 1f) Bitmap.createScaledBitmap(processed, src.width, src.height, true)
        else processed
    }

    private fun buildHighlightLUT(strength: Float): Mat {
        val lut = Mat(1, 256, CvType.CV_8UC1)
        val buf = ByteArray(256)
        for (i in 0..255) {
            val v = i / 255.0
            val out = if (v < 0.5) v
            else 0.5 + (v - 0.5) * (1.0 - 0.85 * strength)
            buf[i] = (out.coerceIn(0.0, 1.0) * 255.0).toInt().toByte()
        }
        lut.put(0, 0, buf); return lut
    }

    private fun buildShadowLUT(strength: Float): Mat {
        val lut = Mat(1, 256, CvType.CV_8UC1)
        val buf = ByteArray(256)
        val gamma = 1.0 - 0.55 * strength
        for (i in 0..255) {
            val v = i / 255.0
            val out = if (v < 0.5) Math.pow(v, gamma)
            else v + (Math.pow(v, gamma) - v) * 0.2 * strength
            buf[i] = (out.coerceIn(0.0, 1.0) * 255.0).toInt().toByte()
        }
        lut.put(0, 0, buf); return lut
    }

    private fun desaturateHighlights(sat: Mat, `val`: Mat, strength: Float) {
        val sData = ByteArray(sat.total().toInt())
        val vData = ByteArray(`val`.total().toInt())
        sat.get(0, 0, sData); `val`.get(0, 0, vData)
        for (i in sData.indices) {
            val v = vData[i].toInt() and 0xFF
            if (v > 200) {
                val f = (v - 200) / 55.0 * strength
                val s = sData[i].toInt() and 0xFF
                sData[i] = (s * (1.0 - f * 0.6)).toInt().coerceIn(0, 255).toByte()
            }
        }
        sat.put(0, 0, sData)
    }
}
