# Vocab Sync Comprehensive Product Audit

## Scope

This audit reviews the current live-equivalent workspace across capture, review, library, Drive sync, initial loading, mobile use, accessibility, and vocabulary-learning usefulness. It separates confirmed observations from improvements that require owner-device validation.

## Initial visual baseline

Desktop has a coherent warm-paper, navy, teal, and editorial-serif direction. Capture is visually dominant, the three capture modes remain easy to distinguish, and Drive controls are separated clearly. The product reads as calm and more crafted than a generic dashboard.

The phone layout is functional with no horizontal overflow at 375 px. The capture controls are tap-sized, the workspace tabs fit, and Drive controls appear after the core capture task. However, the phone screen is vertically dense before a user reaches the primary learning loop, and supporting cards compete more strongly than necessary for attention.

## Confirmed initial opportunities

1. Strengthen the visual system from pleasant dashboard to a distinctive personal language desk by applying a more consistent editorial and dictionary-card motif.
2. Simplify color roles. Reserve navy for structure, teal for primary progress, amber for caution, and reduce incidental purple emphasis.
3. Let mobile show the daily learning action sooner, with less setup and explanatory content ahead of it.
4. Confirm actual bundle and runtime costs rather than claiming speed improvements from visual inspection alone.

## Confirmed behavior, performance, and accessibility observations

The production build and all 55 automated tests pass. There are no recent failed network requests in the local audit logs. Two browser-console failures date from a previous hot-module-reload state before the current export was restored; the current TypeScript and production-build gates pass, so they are historical rather than an active production defect.

The current initial JavaScript output is 613.34 KB minified and 178.01 KB gzip-compressed. Vite reports a chunk above its 500 KB advisory threshold. Google Identity and Picker scripts are already deferred until their features are opened, which is a sound improvement. The most meaningful next performance work is splitting the large Capture, Review, and Library client code rather than chasing micro-optimizations.

Several workspace controls are under the WCAG 2.2 24 CSS pixel pointer-target minimum or use dense 10 px label text. The small Library filters, source pills, row action icons, and `Check` action deserve a target-size and focus-visible pass. The application uses native buttons and inputs in many key paths, which is a good foundation, but the workspace tabs and filter group should expose clearer selected-state semantics and keyboard behavior.

## Confirmed product-flow risks

1. The `Review` feature is local to one browser. This is private and inexpensive, but a phone and desktop do not share review scheduling, so the same word can be due differently on each device.
2. A newly loaded Library creates all unseen entries as due. This is correct for recall but can feel like a sudden assignment of 175 words rather than a gentle first-use plan.
3. Smart capture treats any single Latin-script word as a potential English dictionary lookup. A word such as `bonjour` first pays for a dictionary miss before reaching the AI fallback, adding avoidable delay.
4. Synced vocabulary content is safe behind version conflict checks, but local review history, source labels, and filters are not part of the Markdown file. They can disappear when browser data is cleared.
5. The three capture modes are clear but the decision still asks a beginner to choose an engine. Smart should become more dominant, with Manual and AI available as deliberate secondary routes.

## Evidence that guides prioritization

Google’s Core Web Vitals guidance treats LCP at or below 2.5 seconds, INP at or below 200 ms, and CLS at or below 0.1 as good at the 75th percentile. The current static build output cannot prove these field metrics, but the oversized initial client bundle is a credible reason to measure mobile load and interaction before adding more client-side features.[1]

W3C’s target-size guidance recommends pointer targets of at least 24 by 24 CSS pixels or equivalent spacing. Several compact controls in the current interface need a deliberate accessibility pass, particularly on phones.[2]

The learning-science review supports spacing and retrieval practice for durable learning. This supports improving the quality of the existing daily review rather than adding more decorative capture options.[3]

## References

[1] [web.dev: Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds)

[2] [W3C: WCAG 2.2 target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

[3] [Nature Reviews Psychology: spacing and retrieval practice](https://www.nature.com/articles/s44159-022-00089-1)

## Practical improvement ideas

| Idea | User value | Cost and risk | Recommendation |
|---|---|---|---|
| Gentle review ramp | Start an imported library with five due words, then unlock more after a rating. | Local-only logic; low risk. | Build first. |
| Review direction toggle | Alternate word-to-meaning recall with meaning-to-word recall. | Local-only; low risk. | Build after the ramp. |
| Source and confidence repair | Give every questionable draft an explicit `Fix` action with source details rather than ambiguous badges. | Low risk; saves AI calls. | Build early. |
| Smart first capture | Make Smart the clear primary action, hide Manual and direct AI under a compact `Other ways` control. | UI-only; low risk. | Build early. |
| Library command search | Use `/` to focus search and `Enter` to open the first matching word. | Local-only; low risk. | Build after accessibility pass. |
| True review export | Include source and review history in a separate JSON backup, while keeping Markdown unchanged. | Local-only; preserves current Drive schema. | Build when cross-device review sync is planned. |
| Performance split | Lazy-load Library and Review workspaces, keeping Capture light. | Medium refactor risk; measure before and after. | Build after baseline measurement. |
| Accessibility pass | Adopt consistent 44 px primary mobile targets, explicit focus rings, tab roles, selected state, and shortcut discoverability. | Low risk; benefits every use. | Build first. |

## Out-of-the-box ideas worth considering

### The encounter note

When you add a word, optionally capture where you met it: a book, film, conversation, YouTube video, or personal thought. During review, show the memory cue first, then the word. A personal encounter cue may be more memorable than another generic AI example.

### Use it today

After a successful review, offer one optional one-line challenge: write your own sentence using the word. This is user-generated practice, not fabricated content, and it gives the word a personal context without extra AI cost.

### Confusion pairs

When two library words are close in spelling or meaning, let the user mark them as a pair, for example `affect` and `effect`. A small contrast card can ask for the difference instead of reviewing both in isolation.

### The five-minute desk

Make the Review tab open with a single promise: `Five words. About two minutes.` The goal is to make return visits feel finite and guilt-free rather than like a backlog.

### Reading trail

If encounter notes are later added, the Library can become a private trail of words from a specific book, film, or month. This is more meaningful than a generic streak because it tells the story of what you were consuming and learning.
