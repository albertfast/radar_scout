import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var environment: AppEnvironment

    var body: some View {
        ZStack {
            AppTheme.shellGradient.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("RadarScout")
                        .font(CreativeStudioTokens.titleFont)
                        .foregroundStyle(AppTheme.textPrimary)

                    Text("Native iOS foundation")
                        .font(CreativeStudioTokens.bodyFont)
                        .foregroundStyle(AppTheme.textSecondary)
                }

                VStack(spacing: 12) {
                    StatusRow(icon: "swift", title: "SwiftUI", detail: "App shell")
                    StatusRow(icon: "map", title: "MapKit", detail: "Driving map")
                    StatusRow(icon: "location.north", title: "CoreLocation", detail: "Driving mode")
                    StatusRow(icon: "bell.badge", title: "AlertEngine", detail: "Native radar alerts")
                }

                Spacer()

                Button {
                    environment.selectedTab = .drive
                } label: {
                    Label("Start Drive", systemImage: "location.north.line.fill")
                        .frame(maxWidth: .infinity, minHeight: CreativeStudioTokens.controlHeight)
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)
            }
            .padding(CreativeStudioTokens.contentPadding)
        }
    }
}

private struct StatusRow: View {
    let icon: String
    let title: String
    let detail: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.headline)
                .foregroundStyle(AppTheme.accent)
                .frame(width: 32, height: 32)

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(AppTheme.textPrimary)

                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.textSecondary)
            }

            Spacer()
        }
        .padding(14)
        .background(AppTheme.surface.opacity(0.88), in: RoundedRectangle(cornerRadius: CreativeStudioTokens.cornerRadius))
    }
}
