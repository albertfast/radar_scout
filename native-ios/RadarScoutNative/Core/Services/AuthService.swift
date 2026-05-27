import AuthenticationServices
import Foundation

protocol AuthServicing {
    var isSignedIn: Bool { get }
}

final class NativeAuthService: AuthServicing {
    var isSignedIn: Bool {
        false
    }
}
