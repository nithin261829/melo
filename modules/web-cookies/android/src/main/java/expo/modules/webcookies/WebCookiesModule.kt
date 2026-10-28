package expo.modules.webcookies

import android.webkit.CookieManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Reads cookies from the WebView's cookie store (including HttpOnly ones, which page
// JavaScript can't see) so a sign-in done on Google's own page can be reused by the app.
class WebCookiesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WebCookies")

    AsyncFunction("getCookieHeader") { domain: String ->
      CookieManager.getInstance().getCookie("https://$domain") ?: ""
    }

    AsyncFunction("clearAll") { promise: Promise ->
      CookieManager.getInstance().removeAllCookies { promise.resolve(null) }
    }
  }
}
