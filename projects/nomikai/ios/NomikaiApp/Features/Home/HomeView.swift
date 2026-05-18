import SwiftUI
import CoreLocation
import GoogleMaps
import Combine

// ─────────────────────────────────────────────────────────────────────────
//  HomeView
// ─────────────────────────────────────────────────────────────────────────

struct HomeView: View {
    @StateObject private var vm    = HomeViewModel()
    @StateObject private var locMgr = LocationManager()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    CreateInviteForm(locMgr: locMgr)
                }
                .padding()
                .padding(.bottom, 60)
            }
            .navigationTitle("🍺 飲みに行きたい！")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 16) {
                        // フレンド管理
                        NavigationLink(destination: FriendView()) {
                            Image(systemName: "person.badge.plus")
                        }
                        // 通知
                        NavigationLink(destination: NotificationsView()) {
                            ZStack(alignment: .topTrailing) {
                                Image(systemName: "bell")
                                    .font(.title3)
                                if vm.unreadCount > 0 {
                                    Text("\(min(vm.unreadCount, 99))")
                                        .font(.system(size: 9, weight: .bold))
                                        .foregroundColor(.white)
                                        .padding(3)
                                        .background(Color.red)
                                        .clipShape(Circle())
                                        .offset(x: 8, y: -8)
                                }
                            }
                        }
                    }
                }
            }
        }
        .task { await vm.loadUnreadCount() }
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  HomeViewModel
// ─────────────────────────────────────────────────────────────────────────

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var unreadCount = 0
    private var cancellables = Set<AnyCancellable>()

    init() { subscribeUnreadCount() }

    // NotificationRecord.observeUnreadCount で DB 変更を自動検知
    private func subscribeUnreadCount() {
        guard let user = try? UserRecord.findCurrent() else { return }
        NotificationRecord.observeUnreadCount(userId: user.id)
            .receive(on: DispatchQueue.main)
            .sink(receiveCompletion: { _ in },
                  receiveValue: { [weak self] in self?.unreadCount = $0 })
            .store(in: &cancellables)
    }

    func loadUnreadCount() async {
        guard let user = try? UserRecord.findCurrent() else { return }
        unreadCount = (try? NotificationRecord.unreadCount(userId: user.id)) ?? 0
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  CreateInviteForm
// ─────────────────────────────────────────────────────────────────────────

struct CreateInviteForm: View {
    @ObservedObject var locMgr: LocationManager
    @StateObject private var formVM = CreateInviteFormViewModel()

    var body: some View {
        VStack(spacing: 16) {

            // ① 日時
            SectionCard(title: "📅 日時") {
                DatePicker("日時", selection: $formVM.dateTime,
                           in: Date()..., displayedComponents: [.date, .hourAndMinute])
                    .datePickerStyle(.compact)
                    .labelsHidden()
            }

            // ② 募集人数
            SectionCard(title: "👥 募集人数") {
                HStack(spacing: 20) {
                    Button {
                        formVM.participantCount = max(2, formVM.participantCount - 1)
                    } label: {
                        Image(systemName: "minus.circle.fill")
                            .font(.title2)
                            .foregroundColor(formVM.participantCount <= 2 ? .gray : .beerAmber)
                    }
                    .disabled(formVM.participantCount <= 2)

                    Text("\(formVM.participantCount)人")
                        .font(.system(size: 28, weight: .bold))
                        .frame(minWidth: 64)

                    Button {
                        formVM.participantCount = min(20, formVM.participantCount + 1)
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title2)
                            .foregroundColor(.beerAmber)
                    }
                    .disabled(formVM.participantCount >= 20)

                    Spacer()

                    HStack(spacing: 6) {
                        ForEach([2, 3, 4, 5], id: \.self) { n in
                            Button("\(n)") { formVM.participantCount = n }
                                .font(.caption).fontWeight(.bold)
                                .frame(width: 32, height: 32)
                                .background(formVM.participantCount == n
                                    ? Color.beerAmber : Color(.systemGray5))
                                .foregroundColor(formVM.participantCount == n
                                    ? .white : Color(.label))
                                .clipShape(Circle())
                        }
                    }
                }
            }

            // ③ 場所（オプション）
            SectionCard(title: "📍 場所（任意）") {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        TextField("例：渋谷駅周辺", text: $formVM.locationName)
                            .textFieldStyle(.roundedBorder)
                        Button(formVM.showMap ? "閉じる" : "マップで選択") {
                            formVM.showMap.toggle()
                            if locMgr.coordinate == nil { locMgr.requestLocation() }
                        }
                        .font(.caption).fontWeight(.semibold)
                        .foregroundColor(.beerAmber)
                    }

                    if formVM.showMap {
                        if let center = locMgr.coordinate {
                            MapPickerView(
                                center: center,
                                selected: formVM.selectedCoordinate,
                                onSelect: { formVM.selectedCoordinate = $0 }
                            )
                            .frame(height: 240)
                            .cornerRadius(14)
                            .shadow(radius: 4)

                            if let sel = formVM.selectedCoordinate {
                                Label(
                                    String(format: "%.4f, %.4f", sel.latitude, sel.longitude),
                                    systemImage: "mappin.circle.fill"
                                )
                                .font(.caption).foregroundColor(.beerAmber)
                            }
                        } else {
                            VStack(spacing: 8) {
                                if let err = locMgr.error {
                                    Text(err).font(.caption).foregroundColor(.red)
                                }
                                Button("位置情報を許可する") { locMgr.requestLocation() }
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color(.systemGray6))
                                    .cornerRadius(12)
                            }
                        }
                    }
                }
            }

            // ④ メッセージ
            SectionCard(title: nil) {
                VStack(alignment: .trailing, spacing: 4) {
                    TextField("一言メッセージ（任意）例：今夜飲もう！",
                              text: $formVM.message, axis: .vertical)
                        .lineLimit(3, reservesSpace: true)
                    Text("\(formVM.message.count)/200")
                        .font(.caption2).foregroundColor(Color(.tertiaryLabel))
                }
            }

            // エラー・成功
            if let err = formVM.sendError {
                errorBanner(err)
            }
            if let res = formVM.sendResult {
                successBanner(res)
            }

            // ⑤ 送信ボタン
            Button { Task { await formVM.sendInvite() } } label: {
                HStack {
                    if formVM.sending {
                        ProgressView().tint(.white)
                    } else {
                        Text("🍺 飲みに行きたい！")
                            .font(.system(size: 20, weight: .black))
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 60)
                .background(Color.beerAmber)
                .foregroundColor(.white)
                .cornerRadius(16)
                .shadow(color: Color.beerAmber.opacity(0.4), radius: 8, y: 4)
            }
            .disabled(formVM.sending)

            // ⑥ おすすめ飲食店
            restaurantsSection
        }
        // locMgr.coordinate の変化を formVM に正しく伝える
        .onChange(of: locMgr.coordinate?.latitude) { _ in
            formVM.updateLocation(locMgr.coordinate)
        }
        .onAppear {
            formVM.updateLocation(locMgr.coordinate)
        }
    }

    // ─── サブビュー ───────────────────────────────────────────────────

    @ViewBuilder
    private func errorBanner(_ msg: String) -> some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill").foregroundColor(.red)
            Text(msg).font(.caption)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.red.opacity(0.08))
        .cornerRadius(12)
    }

    @ViewBuilder
    private func successBanner(_ res: CreateInviteResponse) -> some View {
        HStack {
            Image(systemName: "checkmark.circle.fill").foregroundColor(.green)
            Text("\(res.notifiedCount.total)人の友達に通知しました！🎉")
                .font(.subheadline).fontWeight(.semibold)
        }
        .padding()
        .background(Color.green.opacity(0.1))
        .cornerRadius(12)
    }

    @ViewBuilder
    private var restaurantsSection: some View {
        if formVM.loadingRestaurants {
            HStack {
                ProgressView()
                Text("周辺のお店を検索中...").font(.subheadline).foregroundColor(.secondary)
            }
            .padding()
        }
        if !formVM.restaurants.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("🍻 おすすめのお店")
                    .font(.headline).fontWeight(.bold)
                ForEach(formVM.restaurants) { r in
                    RestaurantCard(restaurant: r)
                }
            }
        }
        if let err = formVM.restaurantError {
            Text(err).font(.caption).foregroundColor(.secondary)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  CreateInviteFormViewModel
// ─────────────────────────────────────────────────────────────────────────

@MainActor
final class CreateInviteFormViewModel: ObservableObject {
    @Published var dateTime         = Date().addingTimeInterval(7200)
    @Published var participantCount = 2
    @Published var locationName     = ""
    @Published var message          = ""
    @Published var showMap          = false
    @Published var selectedCoordinate: CLLocationCoordinate2D?
    @Published var currentLocation:    CLLocationCoordinate2D?
    @Published var restaurants:  [RestaurantDTO] = []
    @Published var loadingRestaurants = false
    @Published var restaurantError: String?
    @Published var sending    = false
    @Published var sendResult: CreateInviteResponse?
    @Published var sendError: String?

    /// LocationManager からの座標更新を受け取る（View 経由）
    func updateLocation(_ coord: CLLocationCoordinate2D?) {
        if currentLocation == nil, let coord { currentLocation = coord }
    }

    var searchCoordinate: CLLocationCoordinate2D? { selectedCoordinate ?? currentLocation }

    func sendInvite() async {
        sending   = true
        sendError = nil
        sendResult = nil
        do {
            let res = try await InviteService.shared.createInvite(
                dateTime:         dateTime,
                location:         searchCoordinate,
                locationName:     locationName.trimmed,
                participantCount: participantCount,
                message:          message.trimmed
            )
            sendResult = res

            // 送信成功後に周辺飲食店を検索
            if let coord = searchCoordinate {
                loadingRestaurants = true
                restaurantError    = nil
                do {
                    restaurants = try await APIClient.shared.getNearbyRestaurants(
                        lat: coord.latitude, lng: coord.longitude
                    )
                } catch {
                    restaurantError = "お店の検索に失敗しました: \(error.localizedDescription)"
                }
                loadingRestaurants = false
            }
        } catch {
            sendError = error.localizedDescription
        }
        sending = false
    }
}

private extension String {
    var trimmed: String? {
        let s = trimmingCharacters(in: .whitespaces)
        return s.isEmpty ? nil : s
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  MapPickerView - Google Maps ベースの場所選択
// ─────────────────────────────────────────────────────────────────────────

struct MapPickerView: UIViewRepresentable {
    let center: CLLocationCoordinate2D
    var selected: CLLocationCoordinate2D?
    var onSelect: (CLLocationCoordinate2D) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onSelect: onSelect) }

    func makeUIView(context: Context) -> GMSMapView {
        let camera = GMSCameraPosition.camera(
            withLatitude: center.latitude, longitude: center.longitude, zoom: 15
        )
        let mapView = GMSMapView(frame: .zero, camera: camera)
        mapView.isMyLocationEnabled = true
        mapView.settings.myLocationButton = true
        mapView.delegate = context.coordinator

        let marker = GMSMarker(position: selected ?? center)
        marker.isDraggable = true
        marker.map = mapView
        context.coordinator.marker = marker

        return mapView
    }

    func updateUIView(_ mapView: GMSMapView, context: Context) {
        if let sel = selected {
            context.coordinator.marker?.position = sel
        }
    }

    final class Coordinator: NSObject, GMSMapViewDelegate {
        var marker: GMSMarker?
        var onSelect: (CLLocationCoordinate2D) -> Void

        init(onSelect: @escaping (CLLocationCoordinate2D) -> Void) {
            self.onSelect = onSelect
        }

        func mapView(_ mapView: GMSMapView, didTapAt coordinate: CLLocationCoordinate2D) {
            marker?.position = coordinate
            onSelect(coordinate)
        }

        func mapView(_ mapView: GMSMapView, didEndDragging marker: GMSMarker) {
            onSelect(marker.position)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  SectionCard
// ─────────────────────────────────────────────────────────────────────────

struct SectionCard<Content: View>: View {
    let title: String?
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let title {
                Text(title).font(.subheadline).fontWeight(.bold)
            }
            content()
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground))
        .cornerRadius(16)
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  RestaurantCard
// ─────────────────────────────────────────────────────────────────────────

struct RestaurantCard: View {
    let restaurant: RestaurantDTO

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if !restaurant.photo.isEmpty, let url = URL(string: restaurant.photo) {
                AsyncImage(url: url) { img in
                    img.resizable().scaledToFill()
                } placeholder: { Color(.systemGray5) }
                .frame(height: 150).clipped()
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    Text(restaurant.name)
                        .font(.headline).fontWeight(.bold).lineLimit(1)
                    Spacer()
                    Text(restaurant.genre)
                        .font(.caption).fontWeight(.semibold)
                        .foregroundColor(Color(.systemOrange))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Color(.systemOrange).opacity(0.12))
                        .cornerRadius(8)
                }

                if !restaurant.catchCopy.isEmpty {
                    Text(restaurant.catchCopy)
                        .font(.caption).foregroundColor(Color(.secondaryLabel))
                        .lineLimit(2)
                }

                HStack(spacing: 12) {
                    if !restaurant.budget.isEmpty {
                        Label(restaurant.budget, systemImage: "yensign.circle")
                            .font(.caption).foregroundColor(Color(.secondaryLabel))
                    }
                    if !restaurant.access.isEmpty {
                        Label(restaurant.access, systemImage: "tram")
                            .font(.caption).foregroundColor(Color(.secondaryLabel))
                            .lineLimit(1)
                    }
                }

                if let url = URL(string: restaurant.affiliateUrl) {
                    Link(destination: url) {
                        Label("詳細・予約はこちら", systemImage: "arrow.up.right.square")
                            .font(.subheadline).fontWeight(.bold)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Color.beerAmber)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                }
            }
            .padding()
        }
        .background(Color(.secondarySystemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.07), radius: 6, y: 2)
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  Color extension
// ─────────────────────────────────────────────────────────────────────────

extension Color {
    static let beerAmber = Color(red: 245/255, green: 158/255, blue: 11/255)
}
