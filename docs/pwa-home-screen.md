# Vocab Sync Home-Screen Installation

Vocab Sync is installable as a **Progressive Web App**. It opens in an app-style window from the phone or desktop home screen, uses the Vocab Sync book-and-sparkle icon, and keeps the existing Drive, local draft, and review behavior unchanged.

| Component | Implementation |
| --- | --- |
| App identity | `manifest.webmanifest` declares the Vocab Sync name, standalone display mode, warm cream background, and navy browser theme color. |
| Icons | Same-origin 192 px and 512 px PNG icons support PWA installation. An SVG version remains the browser favicon. |
| Updates | The service worker activates immediately but deliberately does not cache fetches. This avoids an old GitHub Pages release lingering after a new deployment. |
| In-app guidance | **Free browser setup** includes an install action. Supported Android browsers show their native install prompt. Other browsers receive the appropriate manual instructions. |

On Android, open Vocab Sync in Chrome or another compatible browser, then choose **Install app** or **Add to Home screen** from the browser menu. On iPhone, open the site in Safari, select **Share**, then select **Add to Home Screen**.

> The installed shortcut opens Vocab Sync quickly as an app. It is not a live Android or iOS home-screen widget that can show a word without opening the app. A true interactive widget needs native iOS or Android app code.

## Validation record

The implementation was checked locally with the full Vitest suite, TypeScript validation, a static production build, direct verification that the manifest, service worker, and both PNG icons were emitted, and responsive screenshots at desktop and 375 px mobile widths. The dedicated PWA asset tests protect the manifest values, icon declarations, and update-safe service-worker behavior.

The home-screen icon was later updated to the owner-selected Gene/Saul reading image. The 512 px source was visually checked for sharp focus, central subject placement, and a readable open book. Its 192 px variant was also checked at actual icon dimensions: the face, glasses, book, and high-contrast reading pose remain identifiable without the blur seen in the prior launch icon.
