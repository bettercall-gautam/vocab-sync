# Product Improvement Audit

## Current strengths

The current capture flow is clear, responsive, and visually coherent. Smart, Manual, and AI are visible on desktop and mobile. The review desk makes the draft-first workflow understandable, while the Drive destination and conflict protection are visibly separate from capture. The warm paper, navy ink, teal action, and editorial typography create a distinctive personal-language-desk direction.

## Current constraints

The local production build emits a 593 KB JavaScript bundle before compression. This is acceptable for a personal app but is the primary measurable speed opportunity. Live free AI response time remains provider-dependent and cannot be eliminated through UI code alone. The largest learning gap is that entries are collected but not yet surfaced for review, recall, or progress.

## Desktop and mobile observations

The desktop page has a good two-column balance, but several small labels, helper paragraphs, and information cards compete for attention. The mobile layout is clean and has no horizontal overflow, but the Drive and sync panels appear after the review desk and push the main action context down a long screen. The visual direction would benefit from stricter color roles and fewer micro-labels, as suggested by the independent screenshot review.

## Guardrails

Recommendations must remain browser-friendly, mobile-first, local-first before Drive sync, conflict-safe, and free. They must not add a paid dependency, fake a dictionary result, or imply a translation or AI result is more reliable than it is.

## Evidence-backed learning opportunity

The current app succeeds at capture but stops before practice. A lightweight review queue should be the highest-impact next feature. A 2022 review in *Nature Reviews Psychology* identifies both spacing and retrieval practice as strategies that enhance learning across settings. A 2024 mini review of mobile assisted vocabulary learning similarly reports that digital flashcards with spaced repetition and feedback can support retention, engagement, and learner autonomy. The proposed Vocab Sync feature should stay deliberately small: one daily review button, self-ratings of `Again`, `Hard`, `Good`, and `Easy`, and deterministic next-review intervals stored alongside the entry.

## Candidate improvements

| Opportunity | Primary benefit | Cost and risk |
|---|---|---|
| Daily recall review | Turns collected vocabulary into retained vocabulary through spaced retrieval. | Free and local-first. Requires entry metadata and a focused review screen. |
| Capture shortcut | Fewer taps to paste, create, and return to the phone home screen. | Free. Requires a small interaction redesign only. |
| Draft quality controls | Let the user quickly replace a bad meaning, retry an example only, or report the source used. | Free. Avoids full regeneration and protects quota. |
| Real search and filters | Find an entry by word, meaning, source, or review state. | Free. Useful once the library grows. |
| Import and export | Backup as Markdown or CSV and restore a local backup. | Free. Requires careful conflict-safe handling. |
| Bundle split | Load Drive picker and setup code only when opened. | Free. Reduces initial JavaScript work, but needs measured implementation. |
| UI hierarchy pass | Reduce micro-label noise, clarify color roles, and tighten the language-desk visual system. | Free. Improves calmness, not core learning. |

## References

[1] [Carpenter, Pan, and Butler, The science of effective learning with spacing and retrieval practice](https://www.nature.com/articles/s44159-022-00089-1)

[2] [Teymouri, Recent developments in mobile-assisted vocabulary learning](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2024.1496578/full)

## Recommended order

| Priority | Improvement | Why it belongs here | What should wait |
|---|---|---|---|
| 1 | Daily recall review | It addresses the central gap between collecting a word and remembering it. It works without AI, a key, or extra hosting. | Do not begin with streaks, badges, or complex gamification. |
| 2 | Source and quality controls | Users need a simple way to see whether a result came from Dictionary or AI, correct a bad field, and retry only the broken part. | Do not add more model fallbacks before user control is clear. |
| 3 | Library search and filters | The current library will become difficult to use after sustained capture. Search and filters have a high benefit with low reliability risk. | Do not build tags, folders, or a second database yet. |
| 4 | Capture and mobile focus pass | Add a one-tap focus on the input, make the review queue more prominent, and compact secondary connection information on phones. | Do not redesign the whole visual language. The current direction is already good. |
| 5 | Measured bundle split | Defer Google Picker and setup code until the user opens those sections, then remeasure. This targets the present 593 KB initial bundle. | Do not chase artificial millisecond claims or remove useful safety states. |
| 6 | Backup and export | Give the owner an explicit Markdown and CSV backup, complementing Google Drive sync. | Do not write directly to Drive without existing conflict checks. |

## Features deliberately not recommended now

Translation infrastructure should remain deferred until the owner explicitly chooses the free Workers AI tradeoff. Push notifications are not necessary for an occasional personal tool and would create more configuration than learning value. Social features, public sharing, arbitrary gamification, dashboards full of charts, and bulk AI rewriting would make the app louder, slower, and more expensive without serving the current study habit.
