import SwiftUI

enum AppTab: Hashable {
    case home
    case drive
    case settings
}

struct AppRootView: View {
    @EnvironmentObject private var environment: AppEnvironment

    var body: some View {
        TabView(selection: $environment.selectedTab) {
            HomeView()
                .tabItem {
                    Label("Home", systemImage: "gauge.with.dots.needle.67percent")
                }
                .tag(AppTab.home)

            DrivingView()
                .tabItem {
                    Label("Drive", systemImage: "location.north.line")
                }
                .tag(AppTab.drive)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "slider.horizontal.3")
                }
                .tag(AppTab.settings)
        }
        .tint(AppTheme.accent)
    }
}
