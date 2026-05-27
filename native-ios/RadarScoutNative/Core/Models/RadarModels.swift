import CoreLocation
import Foundation

enum RadarKind: String, Codable, CaseIterable, Hashable, Sendable {
    case speedCamera = "speed_camera"
    case redLightCamera = "red_light_camera"

    static func normalize(_ rawValue: String?) -> RadarKind? {
        let normalized = rawValue?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "-", with: "_")
            .replacingOccurrences(of: " ", with: "_")

        switch normalized {
        case "speed", "speed_camera", "fixed_speed_camera", "fixed_camera", "radar":
            return .speedCamera
        case "red_light", "redlight", "red_light_camera", "traffic_light_camera":
            return .redLightCamera
        default:
            return nil
        }
    }
}

struct Coordinate: Codable, Equatable, Hashable, Sendable {
    let latitude: Double
    let longitude: Double

    var isValid: Bool {
        latitude.isFinite &&
            longitude.isFinite &&
            (-90...90).contains(latitude) &&
            (-180...180).contains(longitude)
    }

    var coreLocationCoordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

struct RadarMetadata: Codable, Equatable, Hashable, Sendable {
    let alertPolicy: String?
    let alertEligible: Bool?
    let sourceKey: String?

    var isAlertable: Bool {
        let policy = alertPolicy?.lowercased()
        return policy != "map_only" && policy != "ignore" && alertEligible != false
    }

    init(alertPolicy: String? = nil, alertEligible: Bool? = nil, sourceKey: String? = nil) {
        self.alertPolicy = alertPolicy
        self.alertEligible = alertEligible
        self.sourceKey = sourceKey
    }

    func withFallbackSourceKey(_ fallbackSourceKey: String?) -> RadarMetadata {
        guard sourceKey == nil || sourceKey?.isEmpty == true else {
            return self
        }

        return RadarMetadata(
            alertPolicy: alertPolicy,
            alertEligible: alertEligible,
            sourceKey: fallbackSourceKey
        )
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        alertPolicy = try container.decodeIfPresent(String.self, forKey: .alertPolicy)
            ?? container.decodeIfPresent(String.self, forKey: .alertPolicySnake)
        alertEligible = try container.decodeIfPresent(Bool.self, forKey: .alertEligible)
            ?? container.decodeIfPresent(Bool.self, forKey: .alertEligibleSnake)
        sourceKey = try container.decodeIfPresent(String.self, forKey: .sourceKey)
            ?? container.decodeIfPresent(String.self, forKey: .sourceKeySnake)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(alertPolicy, forKey: .alertPolicySnake)
        try container.encodeIfPresent(alertEligible, forKey: .alertEligibleSnake)
        try container.encodeIfPresent(sourceKey, forKey: .sourceKeySnake)
    }

    enum CodingKeys: String, CodingKey {
        case alertPolicy
        case alertPolicySnake = "alert_policy"
        case alertEligible
        case alertEligibleSnake = "alert_eligible"
        case sourceKey
        case sourceKeySnake = "source_key"
    }
}

struct SupabaseRadarPayload: Decodable, Equatable, Sendable {
    let id: String?
    let type: String?
    let latitude: Double?
    let longitude: Double?
    let title: String?
    let confidence: Double?
    let verified: Bool?
    let source: String?
    let speedLimit: Double?
    let distanceMeters: Double?
    let metadata: RadarMetadata?

    init(
        id: String?,
        type: String?,
        latitude: Double?,
        longitude: Double?,
        title: String? = nil,
        confidence: Double? = nil,
        verified: Bool? = nil,
        source: String? = nil,
        speedLimit: Double? = nil,
        distanceMeters: Double? = nil,
        metadata: RadarMetadata? = nil
    ) {
        self.id = id
        self.type = type
        self.latitude = latitude
        self.longitude = longitude
        self.title = title
        self.confidence = confidence
        self.verified = verified
        self.source = source
        self.speedLimit = speedLimit
        self.distanceMeters = distanceMeters
        self.metadata = metadata
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        type = try container.decodeIfPresent(String.self, forKey: .type)
        latitude = try container.decodeIfPresent(Double.self, forKey: .latitude)
            ?? container.decodeIfPresent(Double.self, forKey: .lat)
        longitude = try container.decodeIfPresent(Double.self, forKey: .longitude)
            ?? container.decodeIfPresent(Double.self, forKey: .lng)
            ?? container.decodeIfPresent(Double.self, forKey: .lon)
        title = try container.decodeIfPresent(String.self, forKey: .title)
            ?? container.decodeIfPresent(String.self, forKey: .name)
        confidence = try container.decodeIfPresent(Double.self, forKey: .confidence)
        verified = try container.decodeIfPresent(Bool.self, forKey: .verified)
        source = try container.decodeIfPresent(String.self, forKey: .source)
        speedLimit = try container.decodeIfPresent(Double.self, forKey: .speedLimit)
            ?? container.decodeIfPresent(Double.self, forKey: .speedLimitSnake)
        distanceMeters = try container.decodeIfPresent(Double.self, forKey: .distanceMeters)
            ?? container.decodeIfPresent(Double.self, forKey: .distanceMetersSnake)
        metadata = try container.decodeIfPresent(RadarMetadata.self, forKey: .metadata)
    }

    enum CodingKeys: String, CodingKey {
        case id
        case type
        case latitude
        case longitude
        case lat
        case lng
        case lon
        case title
        case name
        case confidence
        case verified
        case source
        case speedLimit
        case speedLimitSnake = "speed_limit"
        case distanceMeters
        case distanceMetersSnake = "dist_meters"
        case metadata
    }
}

struct RadarRecord: Identifiable, Codable, Equatable, Hashable, Sendable {
    let id: String
    let kind: RadarKind
    let coordinate: Coordinate
    let title: String
    let confidence: Double
    let sourceKey: String?
    let speedLimit: Double?
    let distanceMeters: Double?
    let metadata: RadarMetadata

    init(
        id: String,
        kind: RadarKind,
        coordinate: Coordinate,
        title: String,
        confidence: Double = 1,
        sourceKey: String? = nil,
        speedLimit: Double? = nil,
        distanceMeters: Double? = nil,
        metadata: RadarMetadata = RadarMetadata()
    ) {
        self.id = id
        self.kind = kind
        self.coordinate = coordinate
        self.title = title
        self.confidence = confidence
        self.sourceKey = sourceKey
        self.speedLimit = speedLimit
        self.distanceMeters = distanceMeters
        self.metadata = metadata
    }

    init?(payload: SupabaseRadarPayload) {
        let sourceKey = payload.metadata?.sourceKey ?? payload.source
        let metadata = (payload.metadata ?? RadarMetadata()).withFallbackSourceKey(sourceKey)

        guard
            let kind = RadarKind.normalize(payload.type),
            metadata.isAlertable,
            RadarSourceRules.isAlertable(type: payload.type, sourceKey: sourceKey),
            let latitude = payload.latitude,
            let longitude = payload.longitude
        else {
            return nil
        }

        let coordinate = Coordinate(latitude: latitude, longitude: longitude)
        guard coordinate.isValid else {
            return nil
        }

        self.id = payload.id ?? "\(kind.rawValue)-\(latitude)-\(longitude)"
        self.kind = kind
        self.coordinate = coordinate
        self.title = payload.title ?? kind.displayName
        self.confidence = payload.confidence ?? 1
        self.sourceKey = sourceKey
        self.speedLimit = payload.speedLimit
        self.distanceMeters = payload.distanceMeters
        self.metadata = metadata
    }

    var coreLocationCoordinate: CLLocationCoordinate2D {
        coordinate.coreLocationCoordinate
    }

    static func normalize(_ payloads: [SupabaseRadarPayload]) -> [RadarRecord] {
        payloads.compactMap(RadarRecord.init(payload:))
    }
}

enum RadarSourceRules {
    private static let mapOnlySources: Set<String> = [
        "traffic_camera",
        "traffic_cameras",
        "cctv",
        "webcam",
        "map_only",
        "gov_api",
        "generic_camera",
        "gov_ca_san_francisco_traffic",
        "gov_dc_cctv",
        "gov_wa_wsdot_cctv",
        "gov_us_data",
        "gov_ca_open",
        "gov_uk_data",
        "gov_ca_los_angeles_speed_safety_planned"
    ]

    static func isAlertable(type: String?, sourceKey: String?) -> Bool {
        let rawType = type?.normalizedRadarKey()
        let rawSource = sourceKey?.normalizedRadarKey()

        if let rawType, mapOnlySources.contains(rawType) {
            return false
        }

        if let rawSource, mapOnlySources.contains(rawSource) {
            return false
        }

        return true
    }
}

extension RadarKind {
    var displayName: String {
        switch self {
        case .speedCamera:
            return "Speed Camera"
        case .redLightCamera:
            return "Red Light Camera"
        }
    }
}

private extension String {
    func normalizedRadarKey() -> String {
        trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "-", with: "_")
            .replacingOccurrences(of: " ", with: "_")
    }
}
