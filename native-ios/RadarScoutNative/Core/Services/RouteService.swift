import CoreLocation
import Foundation
import MapKit

@MainActor
protocol RouteServing {
    func route(from origin: CLLocationCoordinate2D, to destination: CLLocationCoordinate2D) async throws -> MKRoute
}

@MainActor
final class MapKitRouteService: RouteServing {
    func route(from origin: CLLocationCoordinate2D, to destination: CLLocationCoordinate2D) async throws -> MKRoute {
        let request = MKDirections.Request()
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: origin))
        request.destination = MKMapItem(placemark: MKPlacemark(coordinate: destination))
        request.transportType = .automobile

        let response = try await MKDirections(request: request).calculate()
        guard let route = response.routes.first else {
            throw RouteServiceError.noRoute
        }

        return route
    }
}

enum RouteServiceError: Error {
    case noRoute
}
