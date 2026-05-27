import Foundation
import SwiftUI

@MainActor
final class AppEnvironment: ObservableObject {
    @Published var selectedTab: AppTab = .drive

    let config: NativeConfig
    let radarFeedService: RadarFeedServing
    let routeService: RouteServing
    let alertEngine: AlertEngine
    let locationEngine: LocationEngine
    let authService: AuthServicing
    let subscriptionService: SubscriptionServicing
    let telemetryService: TelemetryServicing

    init(
        config: NativeConfig,
        radarFeedService: RadarFeedServing,
        routeService: RouteServing,
        alertEngine: AlertEngine,
        locationEngine: LocationEngine,
        authService: AuthServicing,
        subscriptionService: SubscriptionServicing,
        telemetryService: TelemetryServicing
    ) {
        self.config = config
        self.radarFeedService = radarFeedService
        self.routeService = routeService
        self.alertEngine = alertEngine
        self.locationEngine = locationEngine
        self.authService = authService
        self.subscriptionService = subscriptionService
        self.telemetryService = telemetryService
    }

    static func bootstrap() -> AppEnvironment {
        let config = NativeConfig.live
        let telemetry = OSLogTelemetryService()

        return AppEnvironment(
            config: config,
            radarFeedService: SupabaseRadarFeedService(config: config, telemetry: telemetry),
            routeService: MapKitRouteService(),
            alertEngine: AlertEngine(),
            locationEngine: LocationEngine(),
            authService: NativeAuthService(),
            subscriptionService: NativeSubscriptionService(),
            telemetryService: telemetry
        )
    }
}
