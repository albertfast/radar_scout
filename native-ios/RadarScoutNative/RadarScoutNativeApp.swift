import SwiftUI

@main
struct RadarScoutNativeApp: App {
    @StateObject private var environment = AppEnvironment.bootstrap()

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environmentObject(environment)
                .preferredColorScheme(.dark)
        }
    }
}
