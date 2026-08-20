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
