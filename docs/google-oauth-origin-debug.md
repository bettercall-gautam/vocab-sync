# Google OAuth Origin Debugging

The first live Drive authorization attempt from `https://bettercall-gautam.github.io/vocab-sync/` returned Google OAuth error `401: invalid_client` with the message `no registered origin`.

Google's Identity setup guidance states that an authorized JavaScript origin contains the scheme and fully qualified hostname only. The expected production value is therefore `https://bettercall-gautam.github.io`, without the GitHub Pages project path or a trailing slash. Google also states that the scheme, domain, and port of the JavaScript origin must match one of the configured authorized JavaScript origins for the OAuth client.

The next diagnosis step is to re-open the existing `Vocab Sync Web` client in the `vocab-sync-506014` project, verify the exact stored origin and allow configuration propagation before retrying the live connection.

The client page was reopened in the correct `Vocab Sync` project and confirms the same web OAuth client ID used by the deployment. Its JavaScript-origin controls are rendered dynamically, so the stored values require direct page inspection rather than the initial text extraction.

## Root Cause and Correction

Direct inspection confirmed that the OAuth client had no persisted JavaScript-origin entries, despite the earlier attempted configuration. The exact production origin `https://bettercall-gautam.github.io` has now been re-added and saved. The client page now visibly retains that value. Google notes that client-setting propagation may take from five minutes to a few hours, so a live authorization retry should occur only after allowing a brief propagation interval.

After the propagation wait, the live Vocab Sync request reached Google's normal account-selection page for `https://bettercall-gautam.github.io` and then Google’s account verification prompt. This confirms that the prior `no registered origin` rejection was resolved.

The sandbox browser implementation closes the original Vocab Sync window when the Google popup flow returns, leaving only an `about:blank` popup target. Because the connection token exists only in React memory for the current application tab, the final connected-state and Picker verification must be observed from a normal user browser session rather than inferred from a reopened app page.

## Sources

- [Google Identity Services web setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [Google OAuth 2.0 for client-side web applications](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
