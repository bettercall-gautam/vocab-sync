# Approved A through D Upgrade Architecture

## Scope

This release implements the approved accessibility and Smart-first improvements, a gentle five-word review ramp, bidirectional recall, measured client code splitting, and cross-device review progress. Experimental encounter notes, personal sentence prompts, confusion pairs, and reading trails remain intentionally out of scope.

## Vocabulary file contract

`vocab.md` remains the source of truth for words, meanings, and examples. Its three-column Markdown table is unchanged. Review progress is separate metadata and never changes the owner’s Obsidian vocabulary content.

## Review-state contract

The Cloudflare Worker will store a single owner-scoped review-state document in D1. The document has a monotonically increasing version and a JSON payload containing only validated review records. The browser sends an expected version whenever it saves. A stale save receives a conflict response, reloads the remote document, merges records, and retries once.

The merge rule is deterministic. For the same word key, the record with the newest `lastReviewedAt` wins. If neither record has a review time, the record with the later `nextReviewAt` wins. The highest repeat count only breaks an exact timestamp tie. This avoids losing a recent rating while allowing offline phone and desktop changes to converge.

## Review experience contract

The first daily session shows at most five due entries. Existing imported entries remain eligible but no longer overwhelm the user as a giant invisible homework backlog. Review alternates between word-to-meaning and meaning-to-word prompts. The user must reveal the answer before rating it.

## Accessibility and performance contract

Smart is the primary capture action. Manual and direct AI remain available, but become secondary. Compact action controls receive at least a 40 px mobile hit area, explicit selected state, and high-contrast visible focus treatment. Capture remains the initial route; Review and Library are lazy-loaded so users do not parse all workspace rendering code before they need it.
