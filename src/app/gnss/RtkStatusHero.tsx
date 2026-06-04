'use client';

import type {GnssSample} from '@/stores/schemas';
import {correctionAgeColor, SOLUTION_STEPS, solutionStep} from '@/lib/gnss';
import {GpsFixed, GpsNotFixed, GpsOff, SatelliteAlt} from '@mui/icons-material';
import {Box, Chip, Step, StepLabel, Stepper, Typography, useTheme} from '@mui/material';

interface RtkStatusHeroProps {
  sample: GnssSample | undefined;
}

const PALETTE = {success: '#2e7d32', warning: '#f9a825', error: '#e53935', default: '#9e9e9e'} as const;

function Stat({label, value, unit}: {label: string; value: string; unit?: string}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={700}>
        {value}
        {unit && (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ml: 0.5}}>
            {unit}
          </Typography>
        )}
      </Typography>
    </Box>
  );
}

export default function RtkStatusHero({sample}: RtkStatusHeroProps) {
  const theme = useTheme();
  const has = sample !== undefined;
  const step = has ? solutionStep({sol: sample!.sol, rtk: sample!.rtk, ft: sample!.ft}) : 0;
  const fixed = step >= 4;
  const float = step === 3;

  const statusColor = fixed ? 'success' : step >= 2 ? 'warning' : 'error';
  const StatusIcon = fixed ? GpsFixed : step >= 2 ? GpsNotFixed : GpsOff;

  // Correction age: undefined (field not sent) shows "—"; 0 = not reported.
  const age = has ? sample!.age : undefined;
  const ageColor = correctionAgeColor(age);
  const ageText = age === undefined || age <= 0 ? '—' : `${age.toFixed(1)} s`;

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
      <Box sx={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: {xs: 2, md: 4}}}>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5}}>
          <StatusIcon color={statusColor} sx={{fontSize: 40}} />
          <Box>
            <Chip
              label={SOLUTION_STEPS[step]}
              color={statusColor}
              size="small"
              icon={<SatelliteAlt sx={{fontSize: 16}} />}
              sx={{fontWeight: 700}}
            />
            <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 0.5}}>
              {fixed ? 'Centimetre-level fix' : float ? 'Converging to fix…' : 'No RTK solution'}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            gap: {xs: 2, md: 4},
            flexWrap: 'wrap',
            borderLeft: {md: `1px solid ${theme.palette.divider}`},
            pl: {md: 4},
          }}
        >
          <Stat label="Satellites used / visible" value={has ? `${sample!.used} / ${sample!.vis}` : '—'} />
          <Stat label="Horizontal acc." value={has ? sample!.hacc.toFixed(2) : '—'} unit="m" />
          <Stat label="Vertical acc." value={has ? sample!.vacc.toFixed(2) : '—'} unit="m" />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>
              Correction age
            </Typography>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 0.75}}>
              <Box sx={{width: 12, height: 12, borderRadius: '50%', bgcolor: PALETTE[ageColor]}} />
              <Typography variant="h6" fontWeight={700}>
                {ageText}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Solution stepper: how close to RTK-Fixed the receiver is. */}
      <Stepper activeStep={step} alternativeLabel sx={{'& .MuiStepLabel-label': {mt: 0.5, fontSize: 12}}}>
        {SOLUTION_STEPS.map((label, i) => (
          <Step key={label} completed={i < step}>
            <StepLabel
              sx={{
                '& .MuiStepIcon-root.Mui-active': {color: theme.palette[statusColor].main},
                '& .MuiStepIcon-root.Mui-completed': {color: theme.palette.success.main},
              }}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}
