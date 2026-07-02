package com.example.pixelcamera

import android.Manifest
import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.location.Location
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.*
import android.provider.MediaStore
import android.util.Log
import android.util.Size
import android.view.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.extensions.ExtensionMode
import androidx.camera.extensions.ExtensionsManager
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.exifinterface.media.ExifInterface
import androidx.lifecycle.lifecycleScope
import com.example.pixelcamera.databinding.ActivityMainBinding
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import kotlinx.coroutines.*
import org.opencv.android.OpenCVLoader
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "PixelCamera"
        private const val PERMISSIONS_REQUEST = 100
        private val REQUIRED_PERMISSIONS = buildList {
            add(Manifest.permission.CAMERA)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
                add(Manifest.permission.READ_MEDIA_IMAGES)
            else
                add(Manifest.permission.READ_EXTERNAL_STORAGE)
            add(Manifest.permission.ACCESS_FINE_LOCATION)
        }.toTypedArray()
    }

    // ── Binding ───────────────────────────────────────────────────────────────
    private lateinit var binding: ActivityMainBinding

    // ── CameraX ───────────────────────────────────────────────────────────────
    private var cameraProvider: ProcessCameraProvider? = null
    private var preview: Preview? = null
    private var imageCapture: ImageCapture? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var camera: Camera? = null
    private lateinit var cameraExecutor: ExecutorService
    private var extensionsManager: ExtensionsManager? = null
    private var nightModeAvailable = false
    private var bokehModeAvailable = false

    // ── Camera state ──────────────────────────────────────────────────────────
    private var lensFacing    = CameraSelector.LENS_FACING_BACK
    private var currentMode   = CameraMode.PHOTO
    private var flashMode     = FlashMode.AUTO
    private var timerMode     = TimerMode.OFF
    private var aspectRatio   = AspectRatio.RATIO_4_3
    private var hdrMode       = HdrMode.AUTO
    private var whiteBalance  = WhiteBalance.AUTO
    private var showGrid      = false
    private var showLevel     = false
    private var locationTagging = false
    private var zoomRatio     = 1f
    private var minZoom       = 1f
    private var maxZoom       = 10f
    private var exposureCompensation = 0
    private var processingStrength = 0.7f
    private var isProcessingFrame  = false

    // ── Motion Auto Focus ─────────────────────────────────────────────────────
    private lateinit var motionAf: MotionAutoFocus
    private var motionAfEnabled = true

    // ── Sensors / Location ────────────────────────────────────────────────────
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var lastLocation: Location? = null

    // ── Timer job ────────────────────────────────────────────────────────────
    private var timerJob: Job? = null

    // ── Gestures ─────────────────────────────────────────────────────────────
    private lateinit var scaleGestureDetector: ScaleGestureDetector
    private lateinit var gestureDetector: GestureDetector

    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.apply {
            addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            @Suppress("DEPRECATION")
            decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
        }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (!OpenCVLoader.initDebug()) Log.e(TAG, "OpenCV init failed")

        cameraExecutor = Executors.newSingleThreadExecutor()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        // MotionAutoFocus を初期化
        motionAf = MotionAutoFocus(
            context       = this,
            onTriggerAF   = ::performMotionAf,
            onStateChanged = ::onMotionStateChanged
        )

        if (allPermissionsGranted()) {
            startCamera()
        } else {
            ActivityCompat.requestPermissions(this, REQUIRED_PERMISSIONS, PERMISSIONS_REQUEST)
        }

        setupGestures()
        setupUI()
        loadLastPhoto()
    }

    override fun onResume() {
        super.onResume()
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )
        if (motionAfEnabled) motionAf.resume()
    }

    override fun onPause() {
        super.onPause()
        motionAf.pause()
    }

    override fun onDestroy() {
        super.onDestroy()
        motionAf.stop()
        cameraExecutor.shutdown()
        timerJob?.cancel()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Permissions
    // ─────────────────────────────────────────────────────────────────────────

    private fun allPermissionsGranted() = REQUIRED_PERMISSIONS.all {
        ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSIONS_REQUEST && allPermissionsGranted()) startCamera()
        else { Toast.makeText(this, "カメラの権限が必要です", Toast.LENGTH_LONG).show(); finish() }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CameraX
    // ─────────────────────────────────────────────────────────────────────────

    private fun startCamera() {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            cameraProvider = future.get()
            val extFuture = ExtensionsManager.getInstanceAsync(this, cameraProvider!!)
            extFuture.addListener({
                extensionsManager = extFuture.get()
                val sel = buildSelector()
                nightModeAvailable = extensionsManager!!.isExtensionAvailable(sel, ExtensionMode.NIGHT)
                bokehModeAvailable = extensionsManager!!.isExtensionAvailable(sel, ExtensionMode.BOKEH)
                bindCamera()
                motionAf.start()
            }, ContextCompat.getMainExecutor(this))
        }, ContextCompat.getMainExecutor(this))
    }

    private fun buildSelector() = CameraSelector.Builder().requireLensFacing(lensFacing).build()

    @SuppressLint("UnsafeOptInUsageError")
    private fun bindCamera() {
        val provider = cameraProvider ?: return
        try {
            provider.unbindAll()

            val needsAnalysis = currentMode == CameraMode.LIGHT_REMOVAL ||
                                currentMode == CameraMode.SHADOW_REMOVAL

            preview = Preview.Builder()
                .setTargetAspectRatio(aspectRatio.toCameraXRatio())
                .build()
                .also { it.setSurfaceProvider(binding.previewView.surfaceProvider) }

            imageCapture = ImageCapture.Builder()
                .setTargetAspectRatio(aspectRatio.toCameraXRatio())
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                .setFlashMode(flashMode.toCameraX())
                .build()

            var selector = buildSelector()
            val extMode = when {
                currentMode == CameraMode.NIGHT   && nightModeAvailable -> ExtensionMode.NIGHT
                currentMode == CameraMode.PORTRAIT && bokehModeAvailable -> ExtensionMode.BOKEH
                else -> ExtensionMode.NONE
            }
            if (extMode != ExtensionMode.NONE && extensionsManager != null) {
                selector = extensionsManager!!.getExtensionEnabledCameraSelector(selector, extMode)
            }

            imageAnalysis = if (needsAnalysis) {
                ImageAnalysis.Builder()
                    .setTargetResolution(Size(720, 1280))
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                    .build()
                    .also { it.setAnalyzer(cameraExecutor) { proxy -> processPreviewFrame(proxy) } }
            } else null

            binding.previewView.visibility       = if (needsAnalysis) View.INVISIBLE else View.VISIBLE
            binding.processedPreview.visibility  = if (needsAnalysis) View.VISIBLE   else View.GONE

            val useCases = buildList {
                add(preview!!)
                add(imageCapture!!)
                if (imageAnalysis != null) add(imageAnalysis!!)
            }.toTypedArray()

            camera = provider.bindToLifecycle(this, selector, *useCases)

            // モーション AF の発火位置をプレビュー中央に設定
            binding.previewView.post {
                val w = binding.previewView.width
                val h = binding.previewView.height
                if (w > 0 && h > 0) motionAf.setAfTarget(w / 2f, h / 2f)
            }

            camera?.cameraInfo?.zoomState?.observe(this) { st ->
                minZoom = st.minZoomRatio; maxZoom = st.maxZoomRatio
            }
            updateZoom()
            applyTorch()
            applyExposure()

        } catch (e: Exception) {
            Log.e(TAG, "bindCamera failed", e)
            Toast.makeText(this, "カメラ起動失敗: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Motion AF callbacks
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * MotionAutoFocus からモーションが止まったと判断されたときに呼ばれる。
     * プレビュー中央に向けてオートフォーカスを実行し、水色リングを表示する。
     */
    private fun performMotionAf(nx: Float, ny: Float) {
        val cam = camera ?: return
        if (!motionAfEnabled) return

        // プレビュー座標 → MeteringPoint
        val factory = binding.previewView.meteringPointFactory
        // nx, ny はピクセル座標（previewView内）
        val point = factory.createPoint(nx, ny)

        val action = FocusMeteringAction.Builder(point)
            .setAutoCancelDuration(3, java.util.concurrent.TimeUnit.SECONDS)
            .build()

        val future = cam.cameraControl.startFocusAndMetering(action)
        future.addListener({
            try {
                val result = future.get()
                if (result.isFocusSuccessful) {
                    Log.d(TAG, "Motion AF: success")
                } else {
                    Log.d(TAG, "Motion AF: not locked")
                }
            } catch (e: Exception) {
                Log.d(TAG, "Motion AF: ${e.message}")
            }
        }, ContextCompat.getMainExecutor(this))

        // 水色フォーカスリングをプレビュー中央に表示
        binding.focusRing.showMotionAt(nx, ny)
    }

    /**
     * モーション状態が変化したときに UI を更新する。
     */
    private fun onMotionStateChanged(state: MotionAutoFocus.MotionState) {
        binding.motionAfIndicator.motionState = state
        // 水平器も更新（STILL に戻ったタイミングで roll を反映）
        if (showLevel) binding.levelIndicator.roll = motionAf.rollDeg
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Preview frame processing
    // ─────────────────────────────────────────────────────────────────────────

    @SuppressLint("UnsafeOptInUsageError")
    private fun processPreviewFrame(proxy: ImageProxy) {
        if (isProcessingFrame) { proxy.close(); return }
        isProcessingFrame = true
        try {
            val bmp = proxy.toBitmap() ?: run { isProcessingFrame = false; proxy.close(); return }
            val processed = ImageProcessor.processForPreview(bmp, currentMode, processingStrength)
            runOnUiThread { binding.processedPreview.setImageBitmap(processed); isProcessingFrame = false }
        } catch (e: Exception) {
            Log.e(TAG, "Frame processing error", e)
            isProcessingFrame = false
        } finally {
            proxy.close()
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Capture
    // ─────────────────────────────────────────────────────────────────────────

    private fun takePhoto() {
        val ic = imageCapture ?: return
        if (timerMode != TimerMode.OFF) {
            timerJob?.cancel()
            timerJob = lifecycleScope.launch {
                binding.timerFullscreen.visibility = View.VISIBLE
                for (i in timerMode.seconds downTo 1) {
                    binding.timerFullscreen.text = i.toString(); delay(1000)
                }
                binding.timerFullscreen.visibility = View.GONE
                captureImage(ic)
            }
        } else {
            captureImage(ic)
        }
    }

    private fun captureImage(ic: ImageCapture) {
        val ts = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.JAPAN).format(Date())
        val name = "IMG_$ts.jpg"
        val cv = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, name)
            put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                put(MediaStore.Images.Media.RELATIVE_PATH, "DCIM/PixelCamera")
        }

        if (currentMode == CameraMode.LIGHT_REMOVAL || currentMode == CameraMode.SHADOW_REMOVAL) {
            captureWithProcessing(cv, name); return
        }

        val opts = ImageCapture.OutputFileOptions.Builder(
            contentResolver, MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv
        ).build()

        animateShutter(); playShutterSound()

        ic.takePicture(opts, ContextCompat.getMainExecutor(this),
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    output.savedUri?.let { if (locationTagging && lastLocation != null) addExifLocation(it.toString(), lastLocation!!) }
                    runOnUiThread { Toast.makeText(this@MainActivity, "📷 $name", Toast.LENGTH_SHORT).show(); loadLastPhoto() }
                }
                override fun onError(e: ImageCaptureException) {
                    runOnUiThread { Toast.makeText(this@MainActivity, "撮影失敗: ${e.message}", Toast.LENGTH_SHORT).show() }
                }
            })
    }

    private fun captureWithProcessing(cv: ContentValues, name: String) {
        val ic = imageCapture ?: return
        animateShutter(); playShutterSound()
        ic.takePicture(ContextCompat.getMainExecutor(this),
            object : ImageCapture.OnImageCapturedCallback() {
                @SuppressLint("UnsafeOptInUsageError")
                override fun onCaptureSuccess(image: ImageProxy) {
                    lifecycleScope.launch(Dispatchers.IO) {
                        try {
                            val bmp = image.toBitmap(); image.close()
                            if (bmp == null) { withContext(Dispatchers.Main) { Toast.makeText(this@MainActivity, "撮影失敗", Toast.LENGTH_SHORT).show() }; return@launch }
                            val processed = when (currentMode) {
                                CameraMode.LIGHT_REMOVAL  -> ImageProcessor.removeLights(bmp, processingStrength)
                                CameraMode.SHADOW_REMOVAL -> ImageProcessor.removeShadows(bmp, processingStrength)
                                else -> bmp
                            }
                            val uri = contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv)
                            uri?.let { u ->
                                contentResolver.openOutputStream(u)?.use { processed.compress(Bitmap.CompressFormat.JPEG, 95, it) }
                                if (locationTagging && lastLocation != null) addExifLocation(u.toString(), lastLocation!!)
                            }
                            withContext(Dispatchers.Main) { Toast.makeText(this@MainActivity, "📷 $name", Toast.LENGTH_SHORT).show(); loadLastPhoto() }
                        } catch (e: Exception) {
                            Log.e(TAG, "Processing capture failed", e)
                        }
                    }
                }
                override fun onError(e: ImageCaptureException) {
                    Toast.makeText(this@MainActivity, "撮影失敗", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun addExifLocation(uriStr: String, loc: Location) {
        try {
            contentResolver.openFileDescriptor(android.net.Uri.parse(uriStr), "rw")?.use {
                ExifInterface(it.fileDescriptor).apply { setGpsInfo(loc); saveAttributes() }
            }
        } catch (e: Exception) { Log.e(TAG, "EXIF location failed", e) }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UI setup
    // ─────────────────────────────────────────────────────────────────────────

    private fun setupUI() {
        buildModeBar()

        binding.shutterButton.setOnClickListener { takePhoto() }

        binding.btnFlipCamera.setOnClickListener {
            lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK)
                CameraSelector.LENS_FACING_FRONT else CameraSelector.LENS_FACING_BACK
            binding.btnFlipCamera.animate().rotationBy(180f).setDuration(300).start()
            bindCamera()
        }

        binding.btnFlash.setOnClickListener {
            flashMode = FlashMode.values()[(flashMode.ordinal + 1) % FlashMode.values().size]
            updateFlashIcon(); applyTorch()
            imageCapture?.flashMode = flashMode.toCameraX()
        }

        binding.btnTimer.setOnClickListener {
            timerMode = TimerMode.values()[(timerMode.ordinal + 1) % TimerMode.values().size]
            updateTimerIcon()
        }

        binding.btnAspectRatio.setOnClickListener {
            aspectRatio = AspectRatio.values()[(aspectRatio.ordinal + 1) % AspectRatio.values().size]
            binding.btnAspectRatio.contentDescription = aspectRatio.label
            bindCamera()
        }

        binding.btnGrid.setOnClickListener {
            showGrid = !showGrid
            binding.gridOverlay.visibility = if (showGrid) View.VISIBLE else View.GONE
            binding.btnGrid.setImageResource(if (showGrid) R.drawable.ic_grid_on else R.drawable.ic_grid_off)
        }

        binding.btnLevel.setOnClickListener {
            showLevel = !showLevel
            binding.levelIndicator.visibility = if (showLevel) View.VISIBLE else View.GONE
        }

        binding.btnLocation.setOnClickListener {
            locationTagging = !locationTagging
            binding.btnLocation.setImageResource(if (locationTagging) R.drawable.ic_location_on else R.drawable.ic_location_off)
            if (locationTagging) requestLocation()
        }

        // ─── Motion AF toggle ────────────────────────────────────────────────
        binding.btnMotionAf.setOnClickListener {
            motionAfEnabled = !motionAfEnabled
            if (motionAfEnabled) {
                motionAf.resume()
                binding.btnMotionAf.setColorFilter(Color.parseColor("#00E5FF"))
                binding.motionAfIndicator.visibility = View.VISIBLE
                Toast.makeText(this, "モーション AF ON", Toast.LENGTH_SHORT).show()
            } else {
                motionAf.pause()
                binding.btnMotionAf.setColorFilter(Color.GRAY)
                binding.motionAfIndicator.visibility = View.GONE
                Toast.makeText(this, "モーション AF OFF", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnSettings.setOnClickListener { showSettingsMenu() }

        binding.galleryThumb.setOnClickListener {
            startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
                data = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            })
        }

        binding.zoomBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar, p: Int, fromUser: Boolean) {
                if (!fromUser) return
                zoomRatio = minZoom + (maxZoom - minZoom) * (p / 100f)
                updateZoom(); showZoomText()
            }
            override fun onStartTrackingTouch(sb: SeekBar) {}
            override fun onStopTrackingTouch(sb: SeekBar) {
                Handler(Looper.getMainLooper()).postDelayed({ binding.zoomText.visibility = View.GONE }, 2000)
            }
        })

        binding.exposureSlider.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar, p: Int, fromUser: Boolean) {
                if (!fromUser) return
                exposureCompensation = ((p / 100f) * 20 - 10).toInt()
                binding.exposureValue.text = String.format("%+.1f", exposureCompensation / 3f)
                applyExposure()
            }
            override fun onStartTrackingTouch(sb: SeekBar) {}
            override fun onStopTrackingTouch(sb: SeekBar) {}
        })

        setupWhiteBalanceRow()
        updateFlashIcon()
        updateTimerIcon()
    }

    private fun buildModeBar() {
        binding.modeBar.removeAllViews()
        CameraMode.values().forEach { mode ->
            binding.modeBar.addView(TextView(this).apply {
                text = mode.label; textSize = 13f
                setPadding(24, 8, 24, 8)
                setTextColor(if (mode == currentMode) Color.YELLOW else Color.WHITE)
                setOnClickListener { selectMode(mode) }
            })
        }
    }

    private fun selectMode(mode: CameraMode) {
        currentMode = mode; buildModeBar()
        binding.modeBadge.visibility = if (mode == CameraMode.LIGHT_REMOVAL || mode == CameraMode.SHADOW_REMOVAL) View.VISIBLE else View.GONE
        binding.modeBadge.text = mode.label
        bindCamera()
    }

    private fun setupWhiteBalanceRow() {
        binding.wbContainer.removeAllViews()
        WhiteBalance.values().forEach { wb ->
            binding.wbContainer.addView(TextView(this).apply {
                text = wb.label; textSize = 12f; setPadding(16, 4, 16, 4)
                setTextColor(if (wb == whiteBalance) Color.YELLOW else Color.WHITE)
                setOnClickListener { whiteBalance = wb; setupWhiteBalanceRow() }
            })
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Gestures
    // ─────────────────────────────────────────────────────────────────────────

    @SuppressLint("ClickableViewAccessibility")
    private fun setupGestures() {
        scaleGestureDetector = ScaleGestureDetector(this,
            object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
                override fun onScale(d: ScaleGestureDetector): Boolean {
                    zoomRatio = (zoomRatio * d.scaleFactor).coerceIn(minZoom, maxZoom)
                    updateZoom(); showZoomText(); return true
                }
            })

        gestureDetector = GestureDetector(this,
            object : GestureDetector.SimpleOnGestureListener() {
                override fun onSingleTapUp(e: MotionEvent): Boolean {
                    tapToFocus(e.x, e.y); return true
                }
                override fun onDoubleTap(e: MotionEvent): Boolean {
                    zoomRatio = 1f; updateZoom(); return true
                }
                override fun onLongPress(e: MotionEvent) {
                    binding.exposurePanel.visibility =
                        if (binding.exposurePanel.visibility == View.VISIBLE) View.GONE else View.VISIBLE
                }
            })

        val listener = View.OnTouchListener { _, ev ->
            scaleGestureDetector.onTouchEvent(ev); gestureDetector.onTouchEvent(ev); true
        }
        binding.previewView.setOnTouchListener(listener)
        binding.processedPreview.setOnTouchListener(listener)
    }

    private fun tapToFocus(x: Float, y: Float) {
        val point = binding.previewView.meteringPointFactory.createPoint(x, y)
        val action = FocusMeteringAction.Builder(point)
            .setAutoCancelDuration(3, java.util.concurrent.TimeUnit.SECONDS)
            .build()
        camera?.cameraControl?.startFocusAndMetering(action)
        binding.focusRing.showManualAt(x, y)

        // タップフォーカス後は一定時間モーション AF を抑制
        motionAf.notifyManualFocus()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Camera helpers
    // ─────────────────────────────────────────────────────────────────────────

    private fun updateZoom() {
        camera?.cameraControl?.setZoomRatio(zoomRatio.coerceIn(minZoom, maxZoom))
        val range = maxZoom - minZoom
        if (range > 0) binding.zoomBar.progress = (((zoomRatio - minZoom) / range) * 100).toInt()
    }

    private fun showZoomText() {
        binding.zoomText.visibility = View.VISIBLE
        binding.zoomText.text = String.format("%.1f×", zoomRatio)
    }

    private fun applyTorch() { camera?.cameraControl?.enableTorch(flashMode == FlashMode.TORCH) }
    private fun applyExposure() { camera?.cameraControl?.setExposureCompensationIndex(exposureCompensation) }

    private fun updateFlashIcon() {
        binding.btnFlash.setImageResource(when (flashMode) {
            FlashMode.OFF   -> R.drawable.ic_flash_off
            FlashMode.AUTO  -> R.drawable.ic_flash_auto
            FlashMode.ON    -> R.drawable.ic_flash_on
            FlashMode.TORCH -> R.drawable.ic_flash_torch
        })
    }

    private fun updateTimerIcon() {
        binding.btnTimer.setImageResource(when (timerMode) {
            TimerMode.OFF   -> R.drawable.ic_timer_off
            TimerMode.THREE -> R.drawable.ic_timer_3
            TimerMode.TEN   -> R.drawable.ic_timer_10
        })
    }

    private fun AspectRatio.toCameraXRatio() = when (this) {
        AspectRatio.RATIO_4_3  -> androidx.camera.core.AspectRatio.RATIO_4_3
        AspectRatio.RATIO_16_9 -> androidx.camera.core.AspectRatio.RATIO_16_9
        AspectRatio.RATIO_1_1  -> androidx.camera.core.AspectRatio.RATIO_4_3
    }

    private fun FlashMode.toCameraX() = when (this) {
        FlashMode.OFF   -> ImageCapture.FLASH_MODE_OFF
        FlashMode.AUTO  -> ImageCapture.FLASH_MODE_AUTO
        FlashMode.ON, FlashMode.TORCH -> ImageCapture.FLASH_MODE_ON
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Settings
    // ─────────────────────────────────────────────────────────────────────────

    private fun showSettingsMenu() {
        PopupMenu(this, binding.btnSettings).apply {
            menu.add("処理強度: ${(processingStrength * 100).toInt()}%")
                .setEnabled(currentMode == CameraMode.LIGHT_REMOVAL || currentMode == CameraMode.SHADOW_REMOVAL)
                .setOnMenuItemClickListener { showStrengthDialog(); true }
            menu.add("WB: ${whiteBalance.label}")
            menu.add("比率: ${aspectRatio.label}")
        }.show()
    }

    private fun showStrengthDialog() {
        val sb = SeekBar(this).apply { max = 100; progress = (processingStrength * 100).toInt() }
        android.app.AlertDialog.Builder(this)
            .setTitle("処理強度")
            .setView(sb)
            .setPositiveButton("OK") { _, _ -> processingStrength = sb.progress / 100f }
            .show()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Shutter effects
    // ─────────────────────────────────────────────────────────────────────────

    private fun animateShutter() {
        val flash = View(this).apply { setBackgroundColor(Color.WHITE) }
        binding.root.addView(flash, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        flash.animate().alpha(0f).setDuration(150).withEndAction { binding.root.removeView(flash) }.start()
    }

    private fun playShutterSound() {
        try { ToneGenerator(AudioManager.STREAM_MUSIC, 80).startTone(ToneGenerator.TONE_PROP_BEEP, 80) }
        catch (e: Exception) { /* ignore */ }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Gallery
    // ─────────────────────────────────────────────────────────────────────────

    private fun loadLastPhoto() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val cursor = contentResolver.query(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    arrayOf(MediaStore.Images.Media._ID),
                    null, null,
                    "${MediaStore.Images.Media.DATE_ADDED} DESC"
                )
                cursor?.use { c ->
                    if (c.moveToFirst()) {
                        val id = c.getLong(c.getColumnIndexOrThrow(MediaStore.Images.Media._ID))
                        val uri = android.content.ContentUris.withAppendedId(
                            MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id
                        )
                        withContext(Dispatchers.Main) { binding.galleryThumb.setImageURI(uri) }
                    }
                }
            } catch (e: Exception) { Log.e(TAG, "Gallery load failed", e) }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Location
    // ─────────────────────────────────────────────────────────────────────────

    @SuppressLint("MissingPermission")
    private fun requestLocation() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED) {
            fusedLocationClient.lastLocation.addOnSuccessListener { lastLocation = it }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ImageProxy extension
    // ─────────────────────────────────────────────────────────────────────────

    @SuppressLint("UnsafeOptInUsageError")
    private fun ImageProxy.toBitmap(): Bitmap? = try {
        val buf = planes[0].buffer
        val bytes = ByteArray(buf.remaining()); buf.get(bytes)
        val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        bmp.copyPixelsFromBuffer(java.nio.ByteBuffer.wrap(bytes)); bmp
    } catch (e: Exception) {
        try {
            val buf = planes[0].buffer
            val bytes = ByteArray(buf.remaining()); buf.get(bytes)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (e2: Exception) { null }
    }
}
