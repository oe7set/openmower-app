// Resolve the browser's IANA zone (e.g. 'Europe/Vienna'). Falls back to UTC on
// the rare engines that don't expose a name — the scheduler accepts that.
// TODO: this hard-wires the schedule/exceptions timezone to whatever zone the
// browser happens to be in when the value is created. That is fine for the
// common case (mower owner edits from home), but breaks for travelling owners
// and for headless edits. Move it to a per-mower config param or a picker so
// the choice is explicit instead of implicit.
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
