# Vocab Sync User Guide

## Before your first word

Open the [live app](https://bettercall-gautam.github.io/vocab-sync/). Press **Connect Drive**, sign in to the Google account that owns your Obsidian Vault, and choose the Markdown note you want from **The Shelf**. When its filename appears in the destination panel, the app has loaded the current table.

Then expand **Free browser setup** and enter an OpenRouter API key. The key is your personal connection to the free AI models. Keep it out of chat messages, screenshots, GitHub commits, and shared devices.

| Device situation | Recommended choice |
|---|---|
| Personal phone or laptop with a screen lock | Choose **Remember key** if you want the browser to retain it. |
| Shared, public, college, or borrowed device | Choose **Do not save the key**. Paste it again next time instead. |

## Add vocabulary

Use the Capture page. You can enter a single word, one word per line, or a comma-separated list. Press **Generate drafts** after adding the words. The generator creates a simple meaning and one short example for every valid word.

Read the draft cards before syncing. You can change the word, meaning, or example manually. This is useful for uncommon names, context-specific meanings, and words where you prefer your own tone.

> A generated draft is not in Google Drive until you press **Sync to Drive**.

## Work with your Library

The Library page shows the entries already present in the selected Markdown file. You can correct wording, revise a meaning, or remove an entry. Any Library edit or deletion makes **Sync to Drive** available, even if you did not generate a new draft.

Sync only when the Library state looks right. A deletion becomes permanent in both Google Drive and Obsidian after a successful sync. If you were only experimenting, reload the selected file before syncing to restore the version from Drive.

## Understand conflict protection

Obsidian can update the same note outside Vocab Sync. To prevent accidental overwrites, the app checks the Drive version and file content immediately before each sync. If a conflict appears, do not force it. Reload the file, review the new Drive version, repeat your intended edit, and sync again.

| Status | Meaning | Best action |
|---|---|---|
| Drive connected | You can choose a file or sync changes. | Continue normally. |
| No file selected | The app has no sync destination yet. | Choose a Markdown file from The Shelf. |
| Unsynced drafts | New reviewed entries are waiting locally. | Edit them or sync them. |
| Conflict detected | Drive changed after the file was loaded. | Reload, review, and make the change again. |
| Offline | AI generation and Drive sync cannot run. | Reconnect, then retry. |

## Keep your records tidy

Use short, concrete meanings. If a model produces an odd answer, edit it before syncing. Vocab Sync enforces concise output, but it cannot know every personal context. Your selected Markdown file is always the final record.

For a technical explanation of Google access, browser storage, and configuration, see [Google Drive and OpenRouter notes](google-drive-oauth-notes.md) and [browser-only architecture notes](browser-only-architecture-notes.md).
