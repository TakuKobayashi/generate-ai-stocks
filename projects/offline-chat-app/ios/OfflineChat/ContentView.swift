import SwiftUI

struct ContentView: View {
    @EnvironmentObject var viewModel: ChatViewModel

    var body: some View {
        NavigationStack {
            HomeView()
        }
    }
}
