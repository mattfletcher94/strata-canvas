---
"@mattfletcher94/strata-canvas": minor
---

Selection overhaul and group drag:

- **Click-to-select now works on content-filled panels.** Previously selection only fired when clicking a panel's bare root element, so any panel with content/handles never selected.
- **New `select()` control** with a configurable additive modifier (`select({ additive: ['shift'] })`, default shift) that toggles membership. Added to `defaultControls()`.
- **Selecting on drag/resize start** — grabbing a panel selects it; grabbing one panel of a multi-selection keeps the whole selection so it can be dragged as a group.
- **Group drag** — dragging any selected panel moves every selected panel (descendants of a selected panel ride along rather than double-moving). Each panel re-runs its own constraints independently.
- **Default selection outline** via overridable CSS variables `--strata-selection-outline` and `--strata-selection-outline-offset`. Set to `none` to opt out.
- **New `onBackgroundPointerDown(cb)` and `clearSelectionOnBackground()` controls** for "click empty canvas" behaviour, built on a shared DOM-containment hit-test (`ctx.panelAt` / `ctx.isOnPanel`).
