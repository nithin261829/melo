import { NativeModule, requireNativeModule } from 'expo';

declare class WebCookiesModule extends NativeModule<{}> {
  /** Cookie header ("a=1; b=2") for every WebView cookie on `domain` and its subdomains. */
  getCookieHeader(domain: string): Promise<string>;
  /** Clears all WebView cookies and website data. */
  clearAll(): Promise<void>;
}

export default requireNativeModule<WebCookiesModule>('WebCookies');
