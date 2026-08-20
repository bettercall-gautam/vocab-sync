# Release validation record

| Check | Result | Evidence |
|---|---|---|
| Plain production route | Passed | `https://bettercall-gautam.github.io/vocab-sync/` loaded the Vocab Sync capture workspace without a route error. |
| Mobile layout, initial state | Passed | Local responsive rendering at 375 by 812 pixels kept capture, review, destination, sync, and setup sections readable and reachable without horizontal overflow. |
| Mobile layout, Drive-connected state | Passed | Owner-supplied production screenshot showed the selected `vocab.md` destination and safe-sync card on a 720 by 1600 phone display. |
| Desktop layout, initial state | Passed | Local 1280 by 720 rendering kept the navigation, capture, review, destination, safe-sync, and setup sections visible with a two-column workspace. |
| Desktop layout, Library state | Passed | Owner-supplied production screenshot showed the readable vocabulary table and Library count of 174 entries. |
| Google Drive selected-file access | Passed | The deployed Google Picker selected `vocab.md`; its selected-file metadata and content loaded. |
| Markdown library parsing | Passed | Owner confirmation: `vocab.md selected, 174 Library entries loaded.` |
| Automated regression suite | Passed | Vitest: 5 test files and 15 tests passed. |

The validated release uses GitHub Pages. Cloudflare Pages configuration was considered during planning but is not part of the delivered architecture.

During the concise-generation follow-up on August 20, 2026, the configured Git credential returned HTTP 403 for a push to the public repository. The owner approved use of the already authenticated GitHub web interface as the alternative release path.

The approved browser release path created commit `7dcd922` for the concise-output validator and commit `fe725ec` for the strict prompt plus one automatic concise-output retry. The GitHub Pages workflow is the deployment verification source for these commits.

The initial browser edit in `fe725ec` truncated the message immediately before `generateEntries`, causing the static build to fail with an unterminated string error. The cause was confirmed in GitHub Actions before applying a targeted correction. Commit `a4eb444` added the Library-change sync helper and commit `f623f74` restored the complete message, repaired the generation boundary, and added the tested change tracking that keeps Drive sync enabled after a Library edit or deletion. GitHub Pages run 14 is the verification run for the combined correction.

GitHub Pages run 14 completed successfully for commit `f623f74`. The live release includes both the concise-output enforcement and the corrected Library edit and deletion sync path.

The owner completed a live end-to-end verification after deployment. A Library deletion activated Sync to Drive, the sync completed, and the same deletion appeared in Obsidian. This verifies the Drive write path for a Library-only change without any new draft entries.

Repository documentation publication began with commit `4798846`, which added and rendered the root README on GitHub. The README links to the companion user guide under `docs/user-guide.md`.

At a 375 pixel mobile viewport, Vocab Sync now shows a two-button navigation control directly below the header. Both **Capture** and **Library** are visible without relying on the desktop sidebar.
