import Foundation

protocol SubscriptionServicing {
    var hasPremiumAccess: Bool { get }
}

final class NativeSubscriptionService: SubscriptionServicing {
    var hasPremiumAccess: Bool {
        false
    }
}
