# Browser-only Google Drive configuration

Vocab Sync is a static browser application. It does **not** use a server-side OAuth callback, refresh token, service account, or OAuth client secret. A user explicitly presses **Connect Drive**, Google Identity Services issues a temporary browser token, and the app requests only the `drive.file` scope. That scope permits access to the file the user chooses through Google Picker. [1] [2]

| Setting | Stored where | Purpose |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | GitHub Actions repository variable | The public browser OAuth client ID: `357962225405-f0p9eu7vphtfc8nmbhs14qfdj4lrpa81.apps.googleusercontent.com`. |
| `VITE_GOOGLE_PICKER_API_KEY` | GitHub Actions repository variable | Browser key used only by Google Picker and Google Drive API. It is restricted to `https://bettercall-gautam.github.io/*` and those APIs. Do not treat it as a private password. |
| `VITE_THE_SHELF_FOLDER_ID` | GitHub Actions repository variable | The Shelf folder identifier: `1jc852fPUQsNzVM4bUIe_znLk1kKPFus6`. Picker opens in this folder and allows Markdown files only. |
| OpenRouter API key | The owner’s browser `localStorage`, only if they select Remember | The user-controlled key that calls OpenRouter’s free model route for meanings and examples. It is never committed to GitHub or sent to Vocab Sync infrastructure. |

The Google Cloud project must retain `https://bettercall-gautam.github.io` as an authorized JavaScript origin. The API key’s website restriction uses `https://bettercall-gautam.github.io/*` because API-key restrictions accept path wildcards, while OAuth origins do not. [3]

> **Security decision:** an OAuth **client secret is not used by this browser app and must never be committed or placed in a GitHub variable.** Any OAuth client secret previously pasted outside Google Cloud should be rotated in Google Cloud Console. The client ID is intentionally public.

The owner explicitly deferred the client-secret rotation on August 20, 2026. This does not block the deployed app because its Drive flow uses public client identification plus short-lived, user-approved browser tokens. The rotation remains an owner security follow-up and is not a functional release dependency.

## Everyday connection flow

Connect Drive, choose a Markdown file from The Shelf, and let the app read the current file snapshot. The app retains the selected file only for the active browser session. This manual choice is deliberate: it keeps `drive.file` access aligned with Google’s user-selected-file model and lets the owner select a different Markdown note whenever needed. [1] [2]

## Reconnecting after a browser restart

Vocab Sync does not store Google Drive access tokens. Google’s browser token model issues short-lived access tokens and requires a new token after a restart or expiry. The app therefore keeps **Connect Drive** as a deliberate user action. For a returning user who is already signed in to Google and has granted the same Drive scope, the app requests a new token with an empty prompt. Google can reuse the existing grant without forcing account selection or consent again. If Google cannot continue the session, its own account or consent dialog appears instead. [4]

## References

1. [Google Picker for web apps](https://developers.google.com/workspace/drive/picker/guides/web-picker)
2. [Google Drive API authorization scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
3. [Google OAuth 2.0 for web applications](https://developers.google.com/identity/protocols/oauth2/web-server)
4. [Google Identity Services token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
