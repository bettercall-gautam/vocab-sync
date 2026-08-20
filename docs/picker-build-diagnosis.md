# Picker Build Diagnosis

After live Drive authorization succeeded, the app displayed: `The Drive file picker needs the browser API key and The Shelf folder ID.`

The deployed JavaScript bundle at `https://bettercall-gautam.github.io/vocab-sync/assets/index-BPxV867s.js` was inspected without printing credentials. It contains the configured The Shelf folder identifier, and it contains no unresolved `VITE_THE_SHELF_FOLDER_ID` placeholder. A cache-control reload of the normal public URL points to that same current bundle.

Therefore the GitHub Pages build configuration is present and correct. The observed Picker message is consistent with the mobile browser retaining a pre-configuration JavaScript bundle in its existing tab. Opening the public URL with a new cache-busting query string loads the current bundle, after which Drive must be connected again because the authorization token is session-only.

## Confirmed Runtime Cause

The cache-busting test still showed the same message. A second bundle inspection confirmed that both the browser API-key-shaped value and The Shelf folder identifier are present in the production build. The actual defect was the Picker guard: it checked for `google.picker` before invoking `gapi.load("picker")`, even though `gapi.load` is the mechanism that loads that module. The guard now checks only the build values and the `gapi` loader, then reports a separate retryable error if the picker module fails to load after the loader callback. The focused Picker test suite, all application tests, TypeScript validation, and a static production build pass with this correction.

The same minimal guard correction has been prepared in the GitHub repository editor for deployment. It changes neither the Google configuration values nor Drive permissions.

GitHub Actions deployment run `4ab8f2e` completed successfully. The public bundle now contains the new post-load Picker error message and does not contain the obsolete pre-load module check, confirming that the corrected client code is live.
