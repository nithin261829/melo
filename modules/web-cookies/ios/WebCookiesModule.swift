import ExpoModulesCore
import WebKit

// Reads cookies from the WebView's cookie store (including HttpOnly ones, which page
// JavaScript can't see) so a sign-in done on Google's own page can be reused by the app.
public class WebCookiesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WebCookies")

    // Returns a Cookie header ("a=1; b=2") of every cookie whose domain matches `domain`.
    AsyncFunction("getCookieHeader") { (domain: String, promise: Promise) in
      WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cookies in
        let header = cookies
          .filter { $0.domain == domain || $0.domain == ".\(domain)" || $0.domain.hasSuffix(".\(domain)") }
          .map { "\($0.name)=\($0.value)" }
          .joined(separator: "; ")
        promise.resolve(header)
      }
    }.runOnQueue(.main)

    // Removes all WebView cookies and site data (used on sign-out).
    AsyncFunction("clearAll") { (promise: Promise) in
      WKWebsiteDataStore.default().removeData(
        ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
        modifiedSince: .distantPast
      ) {
        promise.resolve(nil)
      }
    }.runOnQueue(.main)
  }
}
