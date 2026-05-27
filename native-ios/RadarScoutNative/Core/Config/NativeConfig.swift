import Foundation

struct NativeConfig: Equatable {
    let supabaseURL: URL?
    let supabaseAnonKey: String?

    var hasSupabaseCredentials: Bool {
        supabaseURL != nil && supabaseAnonKey?.isEmpty == false
    }

    static var live: NativeConfig {
        let bundle = Bundle.main
        let rawURL = bundle.object(forInfoDictionaryKey: "SUPABASE_URL") as? String
        let rawKey = bundle.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String

        return NativeConfig(
            supabaseURL: rawURL.flatMap(URL.init(string:)),
            supabaseAnonKey: rawKey
        )
    }
}
