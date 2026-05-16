import SwiftUI

struct ContentView: View {
    // nil = 確認中, false = 未登録, true = 登録済み
    @State private var isLoggedIn: Bool? = nil

    var body: some View {
        Group {
            switch isLoggedIn {
            case nil:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(.systemBackground))

            case false:
                SetupView {
                    withAnimation { isLoggedIn = true }
                }

            case true:
                HomeView()

            default:
                EmptyView()
            }
        }
        .onAppear { checkLogin() }
    }

    private func checkLogin() {
        // UserRecord.findCurrent() (ActiveRecord) でログイン状態を確認
        isLoggedIn = (try? UserRecord.findCurrent()) != nil
    }
}
