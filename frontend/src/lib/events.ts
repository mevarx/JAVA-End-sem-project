/** Cross-component browser events. Kept tiny and typed at the call site. */
export const RAISE_EMERGENCY_EVENT = 'haes:raise-emergency'

export function requestEmergencyDialog(): void {
  window.dispatchEvent(new Event(RAISE_EMERGENCY_EVENT))
}
