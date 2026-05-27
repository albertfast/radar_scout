import CoreLocation
import SwiftUI

struct DrivingView: View {
    @EnvironmentObject private var environment: AppEnvironment

    var body: some View {
        DrivingContentView(
            locationEngine: environment.locationEngine,
            radarFeedService: environment.radarFeedService,
            alertEngine: environment.alertEngine,
            telemetryService: environment.telemetryService
        )
    }
}

private struct DrivingContentView: View {
    @ObservedObject var locationEngine: LocationEngine
    let radarFeedService: RadarFeedServing
    let alertEngine: AlertEngine
    let telemetryService: TelemetryServicing

    @State private var radars: [RadarRecord] = []
    @State private var activeAlert: RadarAlert?
    @State private var isLoadingRadars = false
    @State private var lastError: String?

    private let fallbackCoordinate = CLLocationCoordinate2D(latitude: 37.7879, longitude: -122.4075)

    var body: some View {
        ZStack(alignment: .top) {
            MapKitDrivingMapView(
                userCoordinate: locationEngine.currentLocation?.coordinate ?? fallbackCoordinate,
                radars: radars
            )
            .ignoresSafeArea()

            VStack(spacing: 12) {
                topBar

                if let activeAlert {
                    AlertBannerView(alert: activeAlert)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }

                Spacer()

                controlDock
            }
            .padding(CreativeStudioTokens.contentPadding)
        }
        .task {
            locationEngine.requestWhenInUseAuthorization()
            locationEngine.startDrivingMode()
            await refreshRadars()
        }
        .onReceive(locationEngine.$currentLocation) { _ in
            Task {
                await refreshRadars()
                await evaluateAlert()
            }
        }
    }

    private var topBar: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("DRIVING MODE")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(AppTheme.textSecondary)

                Text(locationEngine.isDrivingModeActive ? "Live MapKit session" : "Ready")
                    .font(CreativeStudioTokens.headingFont)
                    .foregroundStyle(AppTheme.textPrimary)
            }

            Spacer()

            if isLoadingRadars {
                ProgressView()
                    .tint(AppTheme.accent)
            }

            Button {
                Task {
                    await refreshRadars()
                    await evaluateAlert()
                }
            } label: {
                Image(systemName: "arrow.clockwise")
                    .frame(width: CreativeStudioTokens.iconButtonSize, height: CreativeStudioTokens.iconButtonSize)
            }
            .buttonStyle(.bordered)
            .tint(AppTheme.accent)
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: CreativeStudioTokens.cornerRadius))
    }

    private var controlDock: some View {
        VStack(spacing: 10) {
            if let lastError {
                Text(lastError)
                    .font(.footnote)
                    .foregroundStyle(AppTheme.warning)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack(spacing: 10) {
                metricTile(title: "Radars", value: "\(radars.count)")
                metricTile(title: "Speed", value: currentSpeedText)
                metricTile(title: "Mode", value: locationEngine.isDrivingModeActive ? "ON" : "OFF")

                Button {
                    if locationEngine.isDrivingModeActive {
                        locationEngine.stopDrivingMode()
                    } else {
                        locationEngine.startDrivingMode()
                    }
                } label: {
                    Image(systemName: locationEngine.isDrivingModeActive ? "pause.fill" : "play.fill")
                        .frame(width: CreativeStudioTokens.iconButtonSize, height: CreativeStudioTokens.iconButtonSize)
                }
                .buttonStyle(.borderedProminent)
                .tint(locationEngine.isDrivingModeActive ? AppTheme.warning : AppTheme.success)
            }
        }
        .padding(12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: CreativeStudioTokens.cornerRadius))
    }

    private func metricTile(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(AppTheme.textSecondary)

            Text(value)
                .font(CreativeStudioTokens.metricFont)
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, minHeight: 58, alignment: .leading)
        .padding(.horizontal, 10)
        .background(AppTheme.surface.opacity(0.76), in: RoundedRectangle(cornerRadius: CreativeStudioTokens.compactRadius))
    }

    private var currentSpeedText: String {
        guard let speed = locationEngine.currentLocation?.speed, speed >= 0 else {
            return "--"
        }

        return "\(Int((speed * 2.23694).rounded()))"
    }

    private func refreshRadars() async {
        guard !isLoadingRadars else {
            return
        }

        await MainActor.run {
            isLoadingRadars = true
            lastError = nil
        }

        let center = locationEngine.currentLocation?.coordinate ?? fallbackCoordinate

        do {
            let fetched = try await radarFeedService.nearbyRadars(center: center, radiusMeters: 4_000)
            await MainActor.run {
                radars = fetched
                isLoadingRadars = false
            }
        } catch {
            telemetryService.error(error, metadata: ["screen": "driving"])
            await MainActor.run {
                lastError = error.localizedDescription
                isLoadingRadars = false
            }
        }
    }

    private func evaluateAlert() async {
        guard let location = locationEngine.currentLocation else {
            return
        }

        let alert = await alertEngine.evaluate(userLocation: location, radars: radars)
        await MainActor.run {
            withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) {
                activeAlert = alert
            }
        }
    }
}
