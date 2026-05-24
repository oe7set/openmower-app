// Action IDs published on `<prefix>action`. xbot_monitoring registers each
// behavior under its own node_prefix and re-publishes them as
// `<node_prefix>/<action_id>` (xbot_monitoring.cpp publish_actions). The
// behavior `handle_action` switches on the same composite string, so flat
// IDs like `mower_logic/start_recording` are silently ignored.
//
// `resetEmergency` and `setEmergency` are the documented exceptions —
// mower_logic.cpp catches them in actionReceived before dispatching to the
// current behavior, so they stay prefix-less.
export const MOWER_ACTIONS = {
  resetEmergency: 'mower_logic/reset_emergency',
  setEmergency: 'mower_logic/set_emergency',

  startMowing: 'mower_logic:idle/start_mowing',
  startAreaRecording: 'mower_logic:idle/start_area_recording',

  pause: 'mower_logic:mowing/pause',
  continueMowing: 'mower_logic:mowing/continue',
  abortMowing: 'mower_logic:mowing/abort_mowing',
  skipArea: 'mower_logic:mowing/skip_area',
  skipPath: 'mower_logic:mowing/skip_path',

  arStartRecording: 'mower_logic:area_recording/start_recording',
  arStopRecording: 'mower_logic:area_recording/stop_recording',
  arExit: 'mower_logic:area_recording/exit_recording_mode',
  arRecordDock: 'mower_logic:area_recording/record_dock',
  arFinishMow: 'mower_logic:area_recording/finish_mowing_area',
  arFinishNav: 'mower_logic:area_recording/finish_navigation_area',
  arFinishDiscard: 'mower_logic:area_recording/finish_discard',
  arCollect: 'mower_logic:area_recording/collect_point',
  arAutoOn: 'mower_logic:area_recording/auto_point_collecting_enable',
  arAutoOff: 'mower_logic:area_recording/auto_point_collecting_disable',
  arManualMowOn: 'mower_logic:area_recording/start_manual_mowing',
  arManualMowOff: 'mower_logic:area_recording/stop_manual_mowing',

  abortDocking: 'mower_logic:docking/abort_docking',
  abortUndocking: 'mower_logic:undocking/abort_undocking',
} as const;

export type MowerActionId = (typeof MOWER_ACTIONS)[keyof typeof MOWER_ACTIONS];
