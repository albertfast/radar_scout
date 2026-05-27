import MapKit
import SwiftUI

struct MapKitDrivingMapView: UIViewRepresentable {
    let userCoordinate: CLLocationCoordinate2D?
    let radars: [RadarRecord]
    let annotationLimit: Int

    init(
        userCoordinate: CLLocationCoordinate2D?,
        radars: [RadarRecord],
        annotationLimit: Int = 120
    ) {
        self.userCoordinate = userCoordinate
        self.radars = radars
        self.annotationLimit = annotationLimit
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView(frame: .zero)
        mapView.delegate = context.coordinator
        mapView.showsUserLocation = true
        mapView.userTrackingMode = .followWithHeading
        mapView.pointOfInterestFilter = .excludingAll
        mapView.overrideUserInterfaceStyle = .dark
        mapView.preferredConfiguration = MKStandardMapConfiguration(elevationStyle: .flat)
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        context.coordinator.parent = self

        if let userCoordinate, !context.coordinator.didSetInitialRegion {
            let region = MKCoordinateRegion(
                center: userCoordinate,
                latitudinalMeters: 1_800,
                longitudinalMeters: 1_800
            )
            mapView.setRegion(region, animated: false)
            context.coordinator.didSetInitialRegion = true
        }

        context.coordinator.reconcileRadars(on: mapView)
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        var parent: MapKitDrivingMapView
        var didSetInitialRegion = false
        private var annotationsByID: [String: RadarAnnotation] = [:]

        init(_ parent: MapKitDrivingMapView) {
            self.parent = parent
        }

        func mapViewDidChangeVisibleRegion(_ mapView: MKMapView) {
            reconcileRadars(on: mapView)
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard let radarAnnotation = annotation as? RadarAnnotation else {
                return nil
            }

            let identifier = "RadarAnnotation"
            let view = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) as? MKMarkerAnnotationView
                ?? MKMarkerAnnotationView(annotation: radarAnnotation, reuseIdentifier: identifier)

            view.annotation = radarAnnotation
            view.canShowCallout = true
            view.glyphText = radarAnnotation.radar.kind == .speedCamera ? "S" : "R"
            view.markerTintColor = radarAnnotation.radar.kind == .speedCamera ? UIColor.systemRed : UIColor.systemOrange
            view.glyphTintColor = UIColor.white
            return view
        }

        func reconcileRadars(on mapView: MKMapView) {
            guard mapView.bounds.width > 0, mapView.bounds.height > 0 else {
                return
            }

            let visibleRect = expandedVisibleMapRect(for: mapView)
            let desiredRadars = parent.radars
                .filter { $0.coordinate.isValid }
                .filter { visibleRect.contains(MKMapPoint($0.coreLocationCoordinate)) }
                .prefix(parent.annotationLimit)

            let desiredIDs = Set(desiredRadars.map(\.id))
            let staleAnnotations = annotationsByID
                .filter { !desiredIDs.contains($0.key) }
                .map(\.value)

            if !staleAnnotations.isEmpty {
                mapView.removeAnnotations(staleAnnotations)
                staleAnnotations.forEach { annotationsByID.removeValue(forKey: $0.radar.id) }
            }

            let newAnnotations = desiredRadars.compactMap { radar -> RadarAnnotation? in
                guard annotationsByID[radar.id] == nil else {
                    return nil
                }

                let annotation = RadarAnnotation(radar: radar)
                annotationsByID[radar.id] = annotation
                return annotation
            }

            if !newAnnotations.isEmpty {
                mapView.addAnnotations(newAnnotations)
            }
        }

        private func expandedVisibleMapRect(for mapView: MKMapView) -> MKMapRect {
            let rect = mapView.visibleMapRect
            return rect.insetBy(dx: -rect.size.width * 0.30, dy: -rect.size.height * 0.30)
        }
    }
}

final class RadarAnnotation: NSObject, MKAnnotation {
    let radar: RadarRecord
    let coordinate: CLLocationCoordinate2D
    let title: String?
    let subtitle: String?

    init(radar: RadarRecord) {
        self.radar = radar
        coordinate = radar.coreLocationCoordinate
        title = radar.title
        subtitle = radar.kind.displayName
        super.init()
    }
}
