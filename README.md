# Vocab Sync

**Vocab Sync** is a personal, browser-only vocabulary desk. Paste words, generate brief meanings and short examples using OpenRouter free models, review the drafts, and sync them to an Obsidian-compatible Markdown file in Google Drive.

The live app is available at [bettercall-gautam.github.io/vocab-sync](https://bettercall-gautam.github.io/vocab-sync/).

> The selected Markdown file remains the source of truth. Vocab Sync never writes automatically. You review changes first, then explicitly choose **Sync to Drive**.

| Capability | What it does |
|---|---|
| Capture | Accepts one word, a pasted list, or comma-separated phrases. Duplicate words are removed before generation. |
| Generate | Uses only OpenRouter free models to create direct meanings with up to eight words and examples with up to ten words. One automatic retry handles an overlong response. |
| Review | Lets you edit generated drafts before writing anything to Drive. |
| Library | Parses the selected Markdown table so existing entries can be edited or deleted. |
| Sync | Adds reviewed drafts and writes Library edits or deletions back to Drive only after a conflict check. |

## Daily workflow

First, open the app and press **Connect Drive**. Approve Google access, then choose a Markdown file from **The Shelf**. The file picker is deliberately limited to Markdown files in that folder.

Next, open **Free browser setup** and paste your own OpenRouter API key. Use **Remember key** only on a private device with a screen lock. On a shared device, keep **Do not save the key** selected so the key disappears after the browser session.

Paste words in the capture box and press **Generate drafts**. Review each meaning and example. When the drafts are correct, press **Sync to Drive**. For Library changes, edit or delete an entry and the same Sync button becomes available even if there are no new drafts.

## Markdown format

The selected note should contain this three-column table:

```md
| Word or Phrase | Simple Meaning | Example |
|---|---|---|
| hypothesis | A testable idea. | We tested the hypothesis. |
```

## Privacy and safety

This is a static browser app with no Vocab Sync backend and no app database. Unsynced drafts are stored only in the current browser. If you opt to remember an OpenRouter key, it is stored only in that browser's local storage. Do not commit API keys, OAuth client secrets, or `.env` files to GitHub.

Google access uses the narrow `drive.file` permission. You select the file yourself through Google Picker, and the temporary browser token expires. Google documents this selected-file model and permission scope here: [Google Picker][1] and [Drive authorization scopes][2].

Before each write, Vocab Sync compares the current Drive version and a content fingerprint with the copy it originally loaded. If the file changed outside the app, sync is blocked so you can reload instead of overwriting a newer Obsidian change.

## Run locally

Install Node.js and pnpm, then run:

```bash
pnpm install
pnpm dev
```

Use the following local checks before changing or publishing the app:

```bash
pnpm check
pnpm test -- --run
pnpm build:static
```

The static deployment uses GitHub Pages. The build reads these GitHub Actions repository variables:

| Variable | Purpose |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Public OAuth browser client ID. |
| `VITE_GOOGLE_PICKER_API_KEY` | Restricted Google Picker and Drive browser key. |
| `VITE_THE_SHELF_FOLDER_ID` | The Google Drive folder opened by the Picker. |

The OpenRouter key is entered by the owner inside the app and must **not** be set as a repository variable.

## Troubleshooting

| Problem | What to do |
|---|---|
| Google Picker does not open | Reconnect Drive, wait a moment, then choose the file again. Confirm the browser is online. |
| A selected file will not load | Choose it again through the Picker. The `drive.file` permission is granted to files you explicitly select. |
| Sync button is inactive | Add one complete draft, or make an edit or deletion in Library. Connect Drive and choose the target file first. |
| Sync reports a conflict | Reload the file from Drive. Make your change again against the current version. |
| A free model is unavailable | Wait briefly and retry. The app only tries free models and never silently switches to paid models. |
| Generated copy is still too long | Generate again or edit the draft. The app rejects content above the concise limits after one repair attempt. |

## More documentation

Read the [user guide](docs/user-guide.md) for a detailed click-by-click flow. Technical decisions and deployment evidence are collected under [`docs/`](docs/).

## References

[1]: https://developers.google.com/workspace/drive/picker/guides/web-picker "Google Picker for web apps"
[2]: https://developers.google.com/workspace/drive/api/guides/api-specific-auth "Google Drive API authorization scopes"
