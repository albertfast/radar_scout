import CoreLocation
import Foundation

struct RadarAlert: Identifiable, Equatable, Sendable {
    let id: String
    let radar: RadarRecord
    let distanceMeters: CLLocationDistance
    let level: RadarAlertLevel

    init(radar: RadarRecord, distanceMeters: CLLocationDistance, level: RadarAlertLevel) {
        self.id = radar.id
        self.radar = radar
        self.distanceMeters = distanceMeters
        self.level = level
    }
}

enum RadarAlertLevel: Equatable, Sendable {
    case advisory
    case urgent
}

actor AlertEngine {
    private let alertRadiusMeters: CLLocationDistance
    private let urgentRadiusMeters: CLLocationDistance
    private let cooldownSeconds: TimeInterval
    private var lastAlertDatesByRadarID: [String: Date] = [:]

    init(
        alertRadiusMeters: CLLocationDistance = 700,
        urgentRadiusMeters: CLLocationDistance = 220,
        cooldownSeconds: TimeInterval = 45
    ) {
        self.alertRadiusMeters = alertRadiusMeters
        self.urgentRadiusMeters = urgentRadiusMeters
        self.cooldownSeconds = cooldownSeconds
    }

    func evaluate(userLocation: CLLocation, radars: [RadarRecord], now: Date = Date()) -> RadarAlert? {
        let nearest = radars
            .map { radar -> (radar: RadarRecord, distance: CLLocationDistance) in
                let radarLocation = CLLocation(
                    latitude: radar.coordinate.latitude,
                    longitude: radar.coordinate.longitude
                )
                return (radar, userLocation.distance(from: radarLocation))
            }
            .filter { $0.distance <= alertRadiusMeters }
            .sorted { $0.distance < $1.distance }
            .first

        guard let nearest else {
            return nil
        }

        if let lastAlertDate = lastAlertDatesByRadarID[nearest.radar.id],
           now.timeIntervalSince(lastAlertDate) < cooldownSeconds {
            return nil
        }

        lastAlertDatesByRadarID[nearest.radar.id] = now
        let level: RadarAlertLevel = nearest.distance <= urgentRadiusMeters ? .urgent : .advisory
        return RadarAlert(radar: nearest.radar, distanceMeters: nearest.distance, level: level)
    }
}
