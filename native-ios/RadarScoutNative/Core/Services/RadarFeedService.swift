import CoreLocation
import Foundation

@MainActor
protocol RadarFeedServing {
    func nearbyRadars(center: CLLocationCoordinate2D, radiusMeters: CLLocationDistance) async throws -> [RadarRecord]
}

enum RadarFeedError: Error, LocalizedError {
    case invalidResponse
    case serverStatus(Int)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Radar feed returned an invalid response."
        case .serverStatus(let statusCode):
            return "Radar feed returned HTTP \(statusCode)."
        }
    }
}

@MainActor
final class SupabaseRadarFeedService: RadarFeedServing {
    private let config: NativeConfig
    private let session: URLSession
    private let telemetry: TelemetryServicing

    init(
        config: NativeConfig,
        session: URLSession = .shared,
        telemetry: TelemetryServicing
    ) {
        self.config = config
        self.session = session
        self.telemetry = telemetry
    }

    func nearbyRadars(center: CLLocationCoordinate2D, radiusMeters: CLLocationDistance) async throws -> [RadarRecord] {
        guard config.hasSupabaseCredentials, let baseURL = config.supabaseURL, let anonKey = config.supabaseAnonKey else {
            telemetry.event("radar_feed_sample_mode", metadata: [:])
            return PreviewRadarFeedService.sampleRadars(near: center)
        }

        let strictPayload = NearbyRadarRequest(
            latitude: center.latitude,
            longitude: center.longitude,
            radiusMeters: radiusMeters,
            minConfidence: 0.35,
            verifiedOnly: true
        )

        let rows = try await fetchRows(
            baseURL: baseURL,
            anonKey: anonKey,
            functionName: "get_nearby_radars_v2",
            payload: strictPayload
        )

        if rows.isEmpty {
            let relaxedPayload = NearbyRadarRequest(
                latitude: center.latitude,
                longitude: center.longitude,
                radiusMeters: radiusMeters,
                minConfidence: 0,
                verifiedOnly: false
            )
            let relaxedRows = try await fetchRows(
                baseURL: baseURL,
                anonKey: anonKey,
                functionName: "get_nearby_radars_v2",
                payload: relaxedPayload
            )
            return RadarRecord.normalize(relaxedRows)
        }

        return RadarRecord.normalize(rows)
    }

    private func fetchRows(
        baseURL: URL,
        anonKey: String,
        functionName: String,
        payload: NearbyRadarRequest
    ) async throws -> [SupabaseRadarPayload] {
        let endpoint = baseURL.appendingPathComponent("rest/v1/rpc/\(functionName)")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(payload)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw RadarFeedError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw RadarFeedError.serverStatus(httpResponse.statusCode)
        }

        return try JSONDecoder().decode([SupabaseRadarPayload].self, from: data)
    }
}

private struct NearbyRadarRequest: Encodable {
    let latitude: Double
    let longitude: Double
    let radiusMeters: CLLocationDistance
    let minConfidence: Double
    let verifiedOnly: Bool

    enum CodingKeys: String, CodingKey {
        case latitude = "lat"
        case longitude = "long"
        case radiusMeters = "radius_meters"
        case minConfidence = "min_confidence"
        case verifiedOnly = "verified_only"
    }
}

enum PreviewRadarFeedService {
    static func sampleRadars(near center: CLLocationCoordinate2D) -> [RadarRecord] {
        [
            RadarRecord(
                id: "sample-speed-north",
                kind: .speedCamera,
                coordinate: Coordinate(latitude: center.latitude + 0.0035, longitude: center.longitude - 0.0018),
                title: "Speed Camera",
                confidence: 0.96
            ),
            RadarRecord(
                id: "sample-redlight-east",
                kind: .redLightCamera,
                coordinate: Coordinate(latitude: center.latitude - 0.0022, longitude: center.longitude + 0.0042),
                title: "Red Light Camera",
                confidence: 0.91
            )
        ]
    }
}
