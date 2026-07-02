import Foundation
import CoreNFC

// MARK: - NfcManager

/// CoreNFC でHCE端末(Android側)からセッショントークンを読み取る。
/// 読み取ったトークンをコールバックで通知する。
final class NfcManager: NSObject, ObservableObject {
    @Published var status: String = "相手の端末にiPhoneの上部を近づけてください"

    private var readerSession: NFCTagReaderSession?
    private var onTokenRead: ((String) -> Void)?

    static let aidBytes: [UInt8] = [0xF0, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06]

    func startReading(onTokenRead: @escaping (String) -> Void) {
        guard NFCTagReaderSession.readingAvailable else {
            DispatchQueue.main.async { self.status = "このデバイスはNFCに対応していません" }
            return
        }
        self.onTokenRead = onTokenRead
        readerSession = NFCTagReaderSession(pollingOption: [.iso14443], delegate: self, queue: nil)
        readerSession?.alertMessage = "相手の端末にiPhoneの上部を近づけてください"
        readerSession?.begin()
    }

    func stopReading() {
        readerSession?.invalidate()
        readerSession = nil
    }
}

extension NfcManager: NFCTagReaderSessionDelegate {
    func tagReaderSessionDidBecomeActive(_ session: NFCTagReaderSession) {}

    func tagReaderSession(_ session: NFCTagReaderSession, didInvalidateWithError error: Error) {
        DispatchQueue.main.async { self.status = "NFCセッションが終了しました" }
    }

    func tagReaderSession(_ session: NFCTagReaderSession, didDetect tags: [NFCTag]) {
        guard let tag = tags.first, case .iso7816(let isoTag) = tag else {
            session.invalidate(errorMessage: "対応したタグが見つかりませんでした")
            return
        }
        session.connect(to: tag) { [weak self] error in
            guard error == nil, let self = self else {
                session.invalidate(errorMessage: "接続に失敗しました")
                return
            }
            let selectApdu = NFCISO7816APDU(
                instructionClass: 0x00, instructionCode: 0xA4,
                p1Parameter: 0x04, p2Parameter: 0x00,
                data: Data(NfcManager.aidBytes), expectedResponseLength: -1
            )
            isoTag.sendCommand(apdu: selectApdu) { responseData, sw1, sw2, error in
                guard error == nil, sw1 == 0x90, sw2 == 0x00 else {
                    session.invalidate(errorMessage: "名刺アプリが見つかりませんでした")
                    return
                }
                let token = String(data: responseData, encoding: .ascii) ?? ""
                if token.isEmpty {
                    session.invalidate(errorMessage: "トークンの取得に失敗しました")
                    return
                }
                session.alertMessage = "接続を確立しました！"
                session.invalidate()
                DispatchQueue.main.async { self.onTokenRead?(token) }
            }
        }
    }
}
