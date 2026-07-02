import SwiftUI
import AVFoundation

// MARK: - QrScannerView (UIViewRepresentable)

struct QrScannerView: UIViewRepresentable {
    var onDetected: (Data) -> Void

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        let session = context.coordinator.session

        if let device = AVCaptureDevice.default(for: .video),
           let input = try? AVCaptureDeviceInput(device: device) {
            if session.canAddInput(input) { session.addInput(input) }
        }

        let output = AVCaptureMetadataOutput()
        if session.canAddOutput(output) {
            session.addOutput(output)
            output.setMetadataObjectsDelegate(context.coordinator, queue: .main)
            output.metadataObjectTypes = [.qr]
        }

        let previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        view.previewLayer = previewLayer
        view.layer.addSublayer(previewLayer)

        DispatchQueue.global(qos: .userInitiated).async { session.startRunning() }
        return view
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {
        DispatchQueue.main.async {
            uiView.previewLayer?.frame = uiView.bounds
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(onDetected: onDetected) }

    static func dismantleUIView(_ uiView: PreviewView, coordinator: Coordinator) {
        coordinator.session.stopRunning()
    }

    // MARK: - PreviewView

    final class PreviewView: UIView {
        var previewLayer: AVCaptureVideoPreviewLayer?
        override func layoutSubviews() {
            super.layoutSubviews()
            previewLayer?.frame = bounds
        }
    }

    // MARK: - Coordinator

    final class Coordinator: NSObject, AVCaptureMetadataOutputObjectsDelegate {
        let session = AVCaptureSession()
        var onDetected: (Data) -> Void
        private var handled = false

        init(onDetected: @escaping (Data) -> Void) { self.onDetected = onDetected }

        func metadataOutput(_ output: AVCaptureMetadataOutput,
                            didOutput metadataObjects: [AVMetadataObject],
                            from connection: AVCaptureConnection) {
            guard !handled,
                  let obj = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
                  obj.type == .qr else { return }

            // QRのrawDescriptorはData(ISO-8859-1バイナリ)として取得
            // fallback: stringValueをISO-8859-1としてData化
            let data: Data?
            if let raw = obj.stringValue?.data(using: .isoLatin1) {
                data = raw
            } else {
                data = obj.stringValue.flatMap { $0.data(using: .utf8) }
            }
            guard let bytes = data else { return }
            handled = true
            onDetected(bytes)
        }
    }
}
