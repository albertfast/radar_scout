import SwiftUI

struct AlertBannerView: View {
    let alert: RadarAlert

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: alert.level == .urgent ? "exclamationmark.triangle.fill" : "camera.metering.center.weighted")
                .foregroundStyle(alert.level == .urgent ? AppTheme.danger : AppTheme.warning)
                .frame(width: 28, height: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(alert.radar.title)
                    .font(.headline)
                    .foregroundStyle(AppTheme.textPrimary)

                Text("\(Int(alert.distanceMeters.rounded())) m ahead")
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.textSecondary)
            }

            Spacer()
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: CreativeStudioTokens.cornerRadius))
        .overlay(
            RoundedRectangle(cornerRadius: CreativeStudioTokens.cornerRadius)
                .stroke((alert.level == .urgent ? AppTheme.danger : AppTheme.warning).opacity(0.65), lineWidth: 1)
        )
    }
}
