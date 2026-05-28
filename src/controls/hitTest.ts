/** Single source of truth for the panel marker attribute. */
export const PANEL_SELECTOR = "[data-canvas-panel]";

/**
 * Nearest panel element to an event's target, walking the DOM subtree. This is
 * the authoritative "did this land on a panel?" check — DOM containment, not
 * geometry, so panel chrome drawn outside the rect (handles) still counts as
 * the panel, and passthrough content inside the subtree counts too.
 */
export function nearestPanelEl(e: Event): HTMLElement | null {
  const target = e.target as Element | null;
  return (target?.closest(PANEL_SELECTOR) as HTMLElement | null) ?? null;
}

/** Id of the nearest (innermost) panel to an event's target, or null. */
export function nearestPanelId(e: Event): string | null {
  return nearestPanelEl(e)?.dataset.panelId ?? null;
}
