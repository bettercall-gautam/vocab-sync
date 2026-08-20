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

GitHub Pages run 18 completed successfully for commit `406cf9c`. The release includes the mobile Capture and Library switcher plus free-only retries for malformed, fenced, empty, or incomplete model responses.

The local setup panel now exposes a standard **Remember key on this device** checkbox and explains that it is appropriate only on an owner-controlled locked device. It also states that Drive access reconnects after a browser restart for safety.

Commit `f41ca42` published the clearer key-persistence control. GitHub Pages workflow run 19 completed successfully.

Commit `022e387` changed the returning-user Drive token request to use Google’s empty prompt behavior. GitHub Pages workflow run 20 completed successfully, while Drive tokens remain session-only and unstored.

The selected Markdown destination restore implementation stores only a file ID and display name. On an explicit future Drive reconnect, it loads a new snapshot using the newly issued short-lived token rather than persisting a token or file content.

GitHub Pages workflow run 22 completed successfully for commit `7e0d0f7`, which restores the remembered Markdown destination after a fresh Drive reconnect.

In the local restart simulation, persisted `library` view state and the remembered `vocab.md` destination reappeared after reload. The header exposed a single **Resume vocab.md** action and the Library view remained active. No Drive token, file content, or live Drive data was placed in local storage.

The persistent connection release was published through GitHub Pages workflow run `32378299052` after correcting a confirmed duplicate pnpm-version setup error in the workflow. The live app loaded at the production URL, and its production bundle contained only the public Cloudflare Worker origin. A direct live-bundle check found no `GOOGLE_CLIENT_SECRET` value or refresh-token literal. The deployed Worker separately verified exact-origin CORS, rejected a request without a device session, and returned the expected Google authorization-code redirect with offline Drive scope.

The first live persistent Drive connection reached Google’s account verification checkpoint for the approved owner account. Google requested a device confirmation before showing the Drive permission screen. No Google Drive permission, refresh token, browser session handle, file content, or verification code was captured by the validation record.

After the missing D1 tables were created and verified, the restarted authorization flow reached Google’s expected warning for an OAuth application in testing. The screen identifies the user as the developer and offers **Continue** or **Back to safety**. The pending next step is the final owner-controlled Drive consent screen.

The testing warning then progressed to Google’s owner-email consent checkpoint. The screen discloses only the owner email address and asks whether the Worker may read it to enforce the single-owner connection rule. The user approved that narrowly scoped identity check; the Drive permission remains a separate pending consent.

The final Google consent summary disclosed the `drive.file` restriction exactly as intended: **“See, edit, create, and delete only the specific Google Drive files you use with this app.”** The flow remains paused before the owner chooses the final **Continue** button.

After the owner approved the final consent action, the browser remained on the same consent page rather than returning to the Worker callback. No successful connection record has yet been observed, so no access token or persistent session is assumed to exist.

The final Google consent control was confirmed enabled and a controlled submission was issued after the standard browser click did not navigate. Authorization success remains pending until the Worker callback and encrypted connection metadata are independently verified.

The final consent completed successfully. The live app returned with a **Drive connected** state plus explicit **Forget this device** and **Disconnect Drive everywhere** controls. The database contains one connection metadata row with `drive.file`, `userinfo.email`, and `openid` scopes and one non-revoked browser-session row. The browser local-storage key list contains only the opaque device-session handle, local drafts, and workspace-view state. It does not contain a named Google access-token key.
