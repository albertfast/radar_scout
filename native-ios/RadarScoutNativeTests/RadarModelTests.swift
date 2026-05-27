import XCTest
@testable import RadarScoutNative

final class RadarModelTests: XCTestCase {
    func testDropsTrafficCameraPayloads() {
        let payloads = [
            SupabaseRadarPayload(
                id: "traffic-1",
                type: "traffic_camera",
                latitude: 37.78,
                longitude: -122.40,
                metadata: RadarMetadata(sourceKey: "traffic_camera")
            ),
            SupabaseRadarPayload(
                id: "speed-1",
                type: "speed_camera",
                latitude: 37.79,
                longitude: -122.41
            )
        ]

        let normalized = RadarRecord.normalize(payloads)

        XCTAssertEqual(normalized.map(\.id), ["speed-1"])
        XCTAssertEqual(normalized.first?.kind, .speedCamera)
    }

    func testDropsMapOnlyAndInvalidCoordinates() {
        let payloads = [
            SupabaseRadarPayload(
                id: "map-only",
                type: "speed_camera",
                latitude: 37.78,
                longitude: -122.40,
                metadata: RadarMetadata(alertPolicy: "map_only")
            ),
            SupabaseRadarPayload(
                id: "invalid",
                type: "speed_camera",
                latitude: 120,
                longitude: -122.40
            ),
            SupabaseRadarPayload(
                id: "red-light",
                type: "red_light_camera",
                latitude: 37.78,
                longitude: -122.40
            )
        ]

        let normalized = RadarRecord.normalize(payloads)

        XCTAssertEqual(normalized.map(\.id), ["red-light"])
        XCTAssertEqual(normalized.first?.kind, .redLightCamera)
    }

    func testUsesSourceFallbackForMapOnlyRules() {
        let payloads = [
            SupabaseRadarPayload(
                id: "sf-traffic-source",
                type: "speed_camera",
                latitude: 37.78,
                longitude: -122.40,
                source: "gov_ca_san_francisco_traffic"
            ),
            SupabaseRadarPayload(
                id: "sf-red-light-source",
                type: "red_light_camera",
                latitude: 37.79,
                longitude: -122.41,
                source: "gov_ca_san_francisco_red_light"
            )
        ]

        let normalized = RadarRecord.normalize(payloads)

        XCTAssertEqual(normalized.map(\.id), ["sf-red-light-source"])
        XCTAssertEqual(normalized.first?.sourceKey, "gov_ca_san_francisco_red_light")
        XCTAssertEqual(normalized.first?.metadata.sourceKey, "gov_ca_san_francisco_red_light")
    }

    func testDropsUnknownGenericCameraTypes() {
        let payloads = [
            SupabaseRadarPayload(
                id: "generic-camera",
                type: "camera",
                latitude: 37.78,
                longitude: -122.40
            ),
            SupabaseRadarPayload(
                id: "webcam",
                type: "webcam",
                latitude: 37.79,
                longitude: -122.41
            ),
            SupabaseRadarPayload(
                id: "known-speed",
                type: "fixed_speed_camera",
                latitude: 37.80,
                longitude: -122.42
            )
        ]

        let normalized = RadarRecord.normalize(payloads)

        XCTAssertEqual(normalized.map(\.id), ["known-speed"])
        XCTAssertEqual(normalized.first?.kind, .speedCamera)
    }
}
