import UIKit
import PhotosUI

enum ImageUtil {
    private static let maxSize: CGFloat = 256

    /// ファイル保存済みのパスからJPEGバイト列を返す (MessagePack送信用)
    static func loadJpegData(from path: String?) -> Data? {
        guard let path else { return nil }
        guard let img = UIImage(contentsOfFile: path) else { return nil }
        return scaled(img).jpegData(compressionQuality: 0.7)
    }

    /// UIImageをアプリ内部に保存してパスを返す
    @discardableResult
    static func saveImage(_ image: UIImage) -> String? {
        let dir = profileIconsDir()
        let file = dir.appendingPathComponent(UUID().uuidString + ".jpg")
        guard let data = scaled(image).jpegData(compressionQuality: 0.85) else { return nil }
        try? data.write(to: file)
        return file.path
    }

    /// 受信したJPEGバイト列をファイルに保存してパスを返す
    @discardableResult
    static func saveImageData(_ data: Data) -> String? {
        guard let img = UIImage(data: data) else { return nil }
        return saveImage(img)
    }

    static func image(at path: String?) -> UIImage? {
        guard let path else { return nil }
        return UIImage(contentsOfFile: path)
    }

    // MARK: - Private

    private static func scaled(_ img: UIImage) -> UIImage {
        let size = img.size
        let ratio = min(maxSize / size.width, maxSize / size.height, 1.0)
        guard ratio < 1.0 else { return img }
        let newSize = CGSize(width: size.width * ratio, height: size.height * ratio)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in img.draw(in: CGRect(origin: .zero, size: newSize)) }
    }

    private static func profileIconsDir() -> URL {
        let base = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("profile_icons")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }
}
