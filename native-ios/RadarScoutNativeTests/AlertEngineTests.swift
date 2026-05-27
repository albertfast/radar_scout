import CoreLocation
import XCTest
@testable import RadarScoutNative

final class AlertEngineTests: XCTestCase {
    func testNearestRadarCreatesAlertAndCooldownSuppressesDuplicate() async {
        let engine = AlertEngine(alertRadiusMeters: 500, urgentRadiusMeters: 150, cooldownSeconds: 60)
        let userLocation = CLLocation(latitude: 37.7879, longitude: -122.4075)
        let radar = RadarRecord(
            id: "nearby-speed",
            kind: .speedCamera,
            coordinate: Coordinate(latitude: 37.7882, longitude: -122.4075),
            title: "Nearby Speed"
        )

        let first = await engine.evaluate(
            userLocation: userLocation,
            radars: [radar],
            now: Date(timeIntervalSince1970: 100)
        )
        let second = await engine.evaluate(
            userLocation: userLocation,
            radars: [radar],
            now: Date(timeIntervalSince1970: 120)
        )

        XCTAssertEqual(first?.radar.id, "nearby-speed")
        XCTAssertEqual(first?.level, .urgent)
        XCTAssertNil(second)
    }
}
