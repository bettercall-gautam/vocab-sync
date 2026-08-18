# Project TODO

- [ ] Define a vocabulary-entry data model with word, simple meaning, example sentence, source state, and timestamps.
- [ ] Add secure Google OAuth configuration for Drive access without hardcoded credentials.
- [ ] Store encrypted OAuth tokens and the selected `vocab.md` Drive file reference per authenticated user.
- [ ] Add an LLM-backed generation procedure that returns concise meanings and short example sentences as structured data.
- [ ] Build an elegant, responsive dashboard layout for the vocabulary workflow.
- [ ] Build a paste area that accepts multiple words and clearly shows parsing status.
- [ ] Build a review screen that lets users edit generated meanings and examples before saving.
- [ ] Persist approved entries and display a searchable history list.
- [ ] Allow users to edit or delete an existing entry and reflect the change in the history.
- [ ] Generate Obsidian-compatible Markdown and push the full `vocab.md` file to Google Drive after each approved change.
- [ ] Show clear connection, sync, success, and error states throughout the product.
- [ ] Write Vitest coverage for entry formatting, generation input validation, and Drive sync behavior.
- [ ] Verify the app in desktop and mobile layouts, then save a release checkpoint.
- [x] Create a Google Drive folder named `The Shelf` outside the current Obsidian Vault.
- [x] Add Markdown files in `The Shelf` for the user’s watchlist, pending movies and series, books read, and books to read.
- [x] Move the existing `vocab.md` note from the Obsidian Vault into `The Shelf` without changing its content.
- [x] Move `The Shelf` from the Drive top level into the actual Obsidian Vault root and verify its contents remain intact.
- [ ] Add the user-provided watched movie and series titles to the `Watched` section of `watchlist.md` in The Shelf.
