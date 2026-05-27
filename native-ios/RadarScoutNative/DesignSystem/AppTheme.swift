import SwiftUI

enum AppTheme {
    static let background = Color(red: 0.03, green: 0.04, blue: 0.05)
    static let surface = Color(red: 0.08, green: 0.10, blue: 0.12)
    static let elevated = Color(red: 0.12, green: 0.14, blue: 0.16)
    static let accent = Color(red: 0.20, green: 0.86, blue: 0.82)
    static let warning = Color(red: 1.00, green: 0.72, blue: 0.25)
    static let danger = Color(red: 1.00, green: 0.26, blue: 0.31)
    static let success = Color(red: 0.34, green: 0.86, blue: 0.47)
    static let textPrimary = Color.white
    static let textSecondary = Color.white.opacity(0.68)

    static let shellGradient = LinearGradient(
        colors: [
            Color(red: 0.02, green: 0.03, blue: 0.04),
            Color(red: 0.05, green: 0.09, blue: 0.10),
            Color(red: 0.10, green: 0.08, blue: 0.05)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}
