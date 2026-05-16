// GPS fix-type labels used by the sensors page header and the drive
// telemetry strip. Mirrors u-blox UBX-NAV-PVT fix types as exposed in
// xbot_monitoring's robot_state extension.

export function fixTypeShort(t: number | undefined): string {
  if (t === undefined) return '—';
  switch (t) {
    case 5:
      return 'RTK Fixed';
    case 4:
      return 'RTK Float';
    case 3:
      return 'DGPS';
    case 2:
      return '3D';
    case 1:
      return '2D';
    default:
      return 'No Fix';
  }
}
