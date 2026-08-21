# Full Upgrade Design

## Data model

The established `vocab.md` table remains exactly three columns and continues to be the canonical vocabulary content. New review and provenance information is stored locally by normalized word key so that the Markdown format, Drive conflict protection, and existing Obsidian workflow remain untouched.

| Field | Purpose |
|---|---|
| `source` | Records whether a local entry originated from Dictionary, AI, Manual, Imported, or Needs review. |
| `state` | Distinguishes `new`, `learning`, and `known` review states. |
| `nextReviewAt` | Millisecond UTC timestamp for the next local review. |
| `repetitions` | Number of successful recall ratings, used to extend review intervals. |
| `lastReviewedAt` | Millisecond UTC timestamp of the most recent rating. |

Local-first review metadata is deliberately not embedded in `vocab.md`, so a review feature cannot corrupt the user’s Obsidian note. The current upgrade does not claim cross-device review scheduling. Content still syncs across devices through Drive; review scheduling remains per browser until a deliberately designed companion-file sync is approved.

## Review rule

Each review reveals the meaning and example only after the user has tried to recall it. Ratings use deterministic intervals: `Again` schedules 10 minutes, `Hard` schedules one day, `Good` schedules an expanding interval starting at three days, and `Easy` schedules an expanding interval starting at seven days. The review queue shows at most five due entries at a time to prevent the app from becoming homework with an identity crisis.

## Backup rule

Exports are local downloads only. Markdown export includes the current Library plus complete unsynced drafts. CSV uses the same three fields. Neither action writes to Drive or bypasses a conflict check.

## Performance rule

Google client scripts should be loaded on demand when the user chooses a Drive action, rather than on every first page view. This is a safe initial loading improvement because the existing Worker path does not need those scripts until Drive connection or Picker use. The main JavaScript bundle will be measured after implementation; no artificial speed claim will be made.

## Visual verification

Desktop and 375 px mobile screenshots were reviewed after the Review tab and Library controls were added. The three-tab mobile navigation fits without horizontal overflow, Smart, Manual, and AI remain individually clear, and secondary Drive and sync information remain below the capture and review actions. The current paper, navy, teal, and editorial typography direction remains intact; no wholesale visual redesign is required.
