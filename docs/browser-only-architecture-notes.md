# Browser-only Vocab Sync notes

## Confirmed constraints

- The first version is single-user, browser-only, and stores unsynced drafts locally.
- Google Identity Services obtains Drive authorization in the browser; no server-side OAuth secret is used.
- Drive access should use the user-selected-file model and the narrow `drive.file` scope.
- The selected Markdown file remains the source of truth. The app checks the Drive version and content fingerprint before every update, and blocks a changed file rather than overwriting it.
- AI calls use OpenRouter's `openrouter/free` model router only. The UI treats free model unavailability as an error and must not fall back to a paid model.
- The existing vocabulary document format has exactly three columns: `Word or Phrase`, `Simple Meaning`, and `Example`.

## Product direction

- The visual language is a warm editorial personal language desk, using paper surfaces, ink navy, restrained teal, literary display headings, and compact mono labels.
- The primary rhythm is capture, review, then manual Drive sync. Secondary settings should remain visually subordinate.
- The app is intentionally responsive and browser-first so it can be used on phones, tablets, and desktop computers.

## Deferred scope

- MongoDB Atlas, shared accounts, recurring automation, spaced repetition, notifications, and audio are not part of the first version.
