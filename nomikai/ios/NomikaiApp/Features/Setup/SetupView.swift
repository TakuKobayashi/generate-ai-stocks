import SwiftUI

struct SetupView: View {
    @State private var name = ""
    @State private var submitting = false
    @State private var error: String?
    var onComplete: () -> Void

    var body: some View {
        ZStack {
            // グラデーション背景
            LinearGradient(
                colors: [Color.beerAmber, Color.beerAmber.opacity(0.6), Color(.systemBackground)],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 32) {
                // ヒーロー
                VStack(spacing: 12) {
                    Text("🍺")
                        .font(.system(size: 80))
                        .shadow(radius: 8)
                    Text("飲みに行きたい！")
                        .font(.system(size: 34, weight: .black))
                        .foregroundColor(Color(.label))
                    Text("友達と気軽に飲み会を企画しよう")
                        .font(.subheadline)
                        .foregroundColor(Color(.secondaryLabel))
                }

                // 登録カード
                VStack(alignment: .leading, spacing: 20) {
                    Text("はじめに名前を教えてください")
                        .font(.headline)

                    VStack(alignment: .leading, spacing: 6) {
                        Text("ニックネーム")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(Color(.secondaryLabel))
                        TextField("例：太郎", text: $name)
                            .textFieldStyle(.roundedBorder)
                            .submitLabel(.go)
                            .onSubmit { Task { await register() } }

                        if let error {
                            Text(error)
                                .font(.caption)
                                .foregroundColor(.red)
                        }
                    }

                    Button {
                        Task { await register() }
                    } label: {
                        HStack {
                            if submitting {
                                ProgressView().tint(.white)
                            } else {
                                Text("はじめる 🍺")
                                    .fontWeight(.bold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(name.trimmingCharacters(in: .whitespaces).isEmpty ? Color.gray.opacity(0.4) : Color.beerAmber)
                        .foregroundColor(.white)
                        .cornerRadius(14)
                    }
                    .disabled(submitting || name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(24)
                .background(Color(.systemBackground))
                .cornerRadius(20)
                .shadow(radius: 16)

                Text("アカウント情報はこのデバイスにのみ保存されます")
                    .font(.caption2)
                    .foregroundColor(Color(.tertiaryLabel))
            }
            .padding(.horizontal, 24)
        }
    }

    private func register() async {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { error = "名前を入力してください"; return }
        submitting = true
        error = nil
        do {
            // UserService.register が UserRecord.setCurrent() (ActiveRecord) を呼ぶ
            _ = try await UserService.shared.register(name: trimmed)
            // 通知許可をリクエスト
            _ = await NotificationService.shared.requestPermission()
            onComplete()
        } catch {
            self.error = error.localizedDescription
            submitting = false
        }
    }
}
