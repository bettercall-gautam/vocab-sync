# Drive App ID Diagnosis

## Observed Failure

The live app successfully completed Google Drive authorization and displayed the restricted Picker. After a user selected a Markdown file, the first Drive API metadata request failed, leaving the destination unselected.

## Confirmed Cause

Google's Picker web-app guide requires `PickerBuilder.setAppId` with the Google Cloud **project number** so a `drive.file` app can access the user-selected file. The app already supplied the OAuth token and browser key but omitted this App ID. The OAuth client ID begins with the same project number, so the app safely derives it locally and passes it to the Picker builder.

## Validation

The change has focused unit coverage for deriving the project number from the OAuth client ID. The full local suite passed with 15 tests, and TypeScript plus the static production build also passed.

GitHub Actions deployment run `90e7659` completed successfully. The live bundle now contains the Picker `setAppId` configuration.

### Final Live Validation

On August 20, 2026, the owner reconnected Drive in the deployed GitHub Pages app, selected `vocab.md`, and reached the Library view without an error. The destination was `vocab.md`, and the app rendered **174 existing vocabulary entries** from that Drive file. The owner explicitly confirmed: `vocab.md selected, 174 Library entries loaded.` This verifies the selected-file metadata read, content download, Markdown parsing, and Library rendering path in the live browser app.

## References

1. [Google Picker integration guide](https://developers.google.com/workspace/drive/picker/guides/web-picker)
2. [Google Drive API scopes guide](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
