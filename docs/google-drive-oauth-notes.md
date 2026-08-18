# Google Drive OAuth integration notes

The app will use Google’s server-side OAuth 2.0 authorization-code flow. Google’s official guidance indicates that a server-side application should create a **Web application** OAuth client, register its exact callback URL, and keep the client secret out of source control. The application will store per-user authorization data server-side and use refresh-token access to update the selected Drive file after the user has left the app.

For the first version, the user will authorize access only when they explicitly connect Google Drive. The app will request the narrowest practical Drive scope and will always write to the user-selected file named `vocab.md`. It will not use hardcoded Drive credentials or a service account.

## Sources

1. [Google OAuth 2.0 for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
2. [Google Drive API scope guide](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
