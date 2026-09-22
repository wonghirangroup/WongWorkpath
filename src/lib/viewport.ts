// Below Tailwind's `sm` breakpoint (640px). Used only to pick a sensible *initial* state (e.g. cards
// instead of a wide table) — layout itself is handled with responsive classes, not this.
export function isPhoneViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
}
