import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var environment: AppEnvironment

    var body: some View {
        NavigationStack {
            List {
                Section("Native Stack") {
                    LabeledContent("Client", value: "SwiftUI")
                    LabeledContent("Map", value: "MapKit")
                    LabeledContent("Backend", value: environment.config.hasSupabaseCredentials ? "Supabase configured" : "Sample mode")
                }

                Section("V1 Scope") {
                    Label("Core Driving", systemImage: "checkmark.circle.fill")
                    Label("MapKit Radar Overlay", systemImage: "checkmark.circle.fill")
                    Label("Auth and Monetization next", systemImage: "clock")
                }
            }
            .navigationTitle("Settings")
            .scrollContentBackground(.hidden)
            .background(AppTheme.background)
        }
    }
}
