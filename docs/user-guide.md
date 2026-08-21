# Vocab Sync User Guide

Vocab Sync is a personal language desk. The selected Google Drive Markdown note is always the vocabulary source of truth. You decide when to sync, and the app blocks a sync when the Drive version has changed outside Vocab Sync.

## Before your first word

Open the [live app](https://bettercall-gautam.github.io/vocab-sync/). Press **Connect Drive**, sign in to the Google account that owns the configured vocabulary folder, and choose the Markdown note you want to update. On a previously connected personal device, the secure connection may restore automatically. If it cannot, use **Connect Drive** again.

The expected table format is:

```md
| Word or Phrase | Simple Meaning | Example |
|---|---|---|
| hypothesis | A testable idea. | We tested the hypothesis. |
```

Expand **Free browser setup** only if you want AI generation. The OpenRouter key stays in your browser when you choose **Remember key**. Keep it out of chat messages, screenshots, GitHub commits, and shared devices.

| Device situation | Recommended choice |
| --- | --- |
| Personal phone or laptop with a screen lock | Use **Remember key** if you want the browser to retain it. |
| Shared, public, college, or borrowed device | Use **Do not save the key** and paste it again only when needed. |

## Add vocabulary

On **Capture**, enter one word, one word per line, or a comma-separated list. Then select one of the three clearly labelled routes.

| Route | What happens |
| --- | --- |
| **Smart capture** | Recommended. An ordinary English word tries a public dictionary first. Phrases and dictionary misses use free-only AI if a key is available. If both fail, your text becomes an editable manual draft. |
| **Manual** | Creates an editable draft immediately without a lookup. |
| **Direct AI** | Skips dictionary lookup and uses the configured free-only OpenRouter models. |

Every draft can be edited before it reaches Drive. A draft is not in Google Drive until you select **Sync to Drive**.

## Review words

Open **Review** for a small five-word recall session. The app alternates between two prompt directions: word to meaning and meaning to word. After revealing the answer, select the response that best fits your recall.

| Choice | Meaning |
| --- | --- |
| **Forgot it** | The answer did not come back. |
| **Took effort** | You remembered, but not easily. |
| **Remembered** | You recalled it normally. |
| **Knew instantly** | You knew it immediately. |

These choices only decide when the word comes back for review. They do not change the text in `vocab.md`.

## Work with the Library

The **Library** shows entries from the selected Markdown file. Search, filter, correct wording, revise a meaning, or remove an entry. Any Library edit or deletion makes **Sync to Drive** available even if you did not generate a new draft.

You can also export Markdown or CSV for a local backup. Deleting an entry becomes permanent in both Drive and Obsidian only after a successful sync.

## Understand conflict protection

Obsidian can update the same note outside Vocab Sync. Immediately before each sync, the app checks the Drive version and content fingerprint. If a conflict appears, do not force it. Reload the file, review the current Drive copy, repeat your intended edit, and sync again.

| Status | Meaning | Best action |
| --- | --- | --- |
| Drive connected | You can choose a file or sync changes. | Continue normally. |
| No file selected | The app has no sync destination. | Connect Drive, then choose a Markdown file. |
| Unsynced drafts | New reviewed entries are waiting locally. | Edit them or sync them. |
| Conflict detected | Drive changed after the file was loaded. | Reload, review, and make the change again. |
| Offline | AI generation and Drive sync cannot run. | Reconnect, then retry. |

## Install Vocab Sync

On Android, open Vocab Sync in Chrome, then choose **Install app** or **Add to Home screen**. On iPhone, open it in Safari, choose **Share**, then choose **Add to Home Screen**.

The installed PWA is a fast app-style shortcut. It is not a native live widget.

## Keep your records tidy

Use short, concrete meanings. Edit a model result whenever its sense does not match the context in which you met the word. Vocab Sync enforces concise output, but your Markdown file remains the final record.

For implementation details, read the [PWA home-screen guide](pwa-home-screen.md), [persistent Drive design](cloudflare-persistent-drive-design.md), and [release validation](release-validation.md).
