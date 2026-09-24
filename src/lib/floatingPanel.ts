// Shared placement math for any floating list that hangs off a trigger and renders through a portal
// with `position: fixed` (Dropdown, EmployeeMultiSelect). Living in one place means every such
// panel keeps the same rules: flip above the trigger when there isn't room below, never touch the
// viewport edge, and shrink to whatever room is left (the list scrolls inside) rather than running
// off-screen with the lower options unreachable.

export const PANEL_MAX_HEIGHT = 240; // 15rem — the tallest a dropdown list grows before it scrolls
const PANEL_MIN_HEIGHT = 96; // never shrink below ~3 rows, even on a very short viewport
const PANEL_EDGE_GAP = 12; // breathing room kept between the panel and the viewport edge
const PANEL_TRIGGER_GAP = 2; // the small gap between the trigger and the panel

export interface PanelPlacement {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  openUpward: boolean;
  maxHeight: number;
}

export function computePanelPlacement(trigger: DOMRect, desiredMaxHeight: number = PANEL_MAX_HEIGHT): PanelPlacement {
  const spaceBelow = window.innerHeight - trigger.bottom - PANEL_EDGE_GAP - PANEL_TRIGGER_GAP;
  const spaceAbove = trigger.top - PANEL_EDGE_GAP - PANEL_TRIGGER_GAP;
  const openUpward = spaceBelow < desiredMaxHeight && spaceAbove > spaceBelow;
  const room = openUpward ? spaceAbove : spaceBelow;
  const maxHeight = Math.min(desiredMaxHeight, Math.max(room, PANEL_MIN_HEIGHT));
  return openUpward
    ? { bottom: window.innerHeight - trigger.top + PANEL_TRIGGER_GAP, left: trigger.left, width: trigger.width, openUpward, maxHeight }
    : { top: trigger.bottom + PANEL_TRIGGER_GAP, left: trigger.left, width: trigger.width, openUpward, maxHeight };
}
