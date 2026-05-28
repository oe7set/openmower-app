'use client';

import {radToDeg} from '@/lib/quaternion';
import {useSelectedMower} from '@/stores/mowersStore';
import {useToast} from '@/hooks/useToast';
import {Compass} from 'lucide-react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Typography,
} from '@mui/material';
import {useEffect, useRef, useState} from 'react';

// Result shape mirrors what xbot_monitoring's imu.calibrate_level RPC
// returns. The generated rpc.ts type uses opaque alias names, so we
// redeclare the fields we actually consume here for readability — the
// runtime payload is a plain object either way.
interface CalibrationResult {
  mounting_roll_offset_rad: number;
  mounting_pitch_offset_rad: number;
  gyro_bias: {x: number; y: number; z: number};
  samples_count: number;
  accel_stddev?: number[];
  gyro_stddev?: number[];
}

interface RpcError {
  code?: number;
  message?: string;
  data?: {
    accel_stddev?: number[];
    gyro_stddev?: number[];
  };
}

const COUNTDOWN_TICK_MS = 50;
const COUNTDOWN_DURATION_MS = 2000;

export default function CalibrateButton() {
  const rpc = useSelectedMower((s) => s?.rpc);
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tear down the visual countdown if the dialog closes mid-flight or the
  // RPC settles early. The actual RPC promise is tracked separately.
  useEffect(() => {
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, []);

  function startProgress() {
    const start = Date.now();
    setProgress(0);
    tickerRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / COUNTDOWN_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100 && tickerRef.current) {
        clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    }, COUNTDOWN_TICK_MS);
  }

  function stopProgress() {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    setProgress(0);
  }

  async function handleConfirm() {
    if (!rpc) return;
    setRunning(true);
    startProgress();
    try {
      const res = (await rpc.imu.calibrate_level()) as unknown as CalibrationResult;
      const rollDeg = radToDeg(res.mounting_roll_offset_rad).toFixed(2);
      const pitchDeg = radToDeg(res.mounting_pitch_offset_rad).toFixed(2);
      toast.success(
        `Calibrated: roll ${rollDeg}°, pitch ${pitchDeg}° · gyro bias [${res.gyro_bias.x.toFixed(4)}, ${res.gyro_bias.y.toFixed(4)}, ${res.gyro_bias.z.toFixed(4)}] rad/s`,
      );
      setOpen(false);
    } catch (e) {
      const err = e as RpcError;
      const stddevHint = err.data?.accel_stddev
        ? ` (accel σ ≈ [${err.data.accel_stddev.map((v) => v.toFixed(3)).join(', ')}])`
        : '';
      toast.error(`Calibration failed: ${err.message ?? 'unknown error'}${stddevHint}`);
    } finally {
      stopProgress();
      setRunning(false);
    }
  }

  function handleClose() {
    if (running) return;
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<Compass size={16} />}
        onClick={() => setOpen(true)}
        disabled={!rpc}
        sx={{textTransform: 'none'}}
      >
        Set level position
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>Set as level position</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography variant="body2" sx={{mb: 1.5}}>
              Place the mower on a flat, level surface and keep it perfectly still. The IMU
              mounting offset (roll/pitch) and gyro bias will be sampled for 2 s and saved
              persistently.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Yaw is corrected continuously from GPS heading and does not need to be tared
              here.
            </Typography>
          </DialogContentText>

          {running && (
            <Box sx={{mt: 2}}>
              <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 0.5}}>
                Sampling…
              </Typography>
              <LinearProgress variant="determinate" value={progress} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={running}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleConfirm} disabled={running || !rpc}>
            Start calibration
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
