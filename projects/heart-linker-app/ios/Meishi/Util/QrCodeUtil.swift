import UIKit
import CoreImage

enum QrCodeUtil {
    /// MessagePackバイト列からQRコードのUIImageを生成する
    /// CoreImage の QR コードはISO-8859-1でバイナリを扱える
    static func generate(data: Data, size: CGFloat = 280) -> UIImage? {
        guard let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("L", forKey: "inputCorrectionLevel")   // Lで最大データ容量確保
        guard let output = filter.outputImage else { return nil }
        let scale = size / output.extent.width
        let scaled = output.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        return UIImage(ciImage: scaled)
    }
}
