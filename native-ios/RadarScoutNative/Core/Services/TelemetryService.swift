import Foundation
import OSLog

@MainActor
protocol TelemetryServicing {
    func event(_ name: String, metadata: [String: String])
    func error(_ error: Error, metadata: [String: String])
}

@MainActor
final class OSLogTelemetryService: TelemetryServicing {
    private let logger = Logger(subsystem: "com.radarscout.native", category: "app")

    func event(_ name: String, metadata: [String: String] = [:]) {
        logger.info("\(name, privacy: .public) \(metadata.description, privacy: .public)")
    }

    func error(_ error: Error, metadata: [String: String] = [:]) {
        logger.error("\(String(describing: error), privacy: .public) \(metadata.description, privacy: .public)")
    }
}
