import {InfoOutlined as InfoIcon} from '@mui/icons-material';
import {Box, Chip, Tooltip, Typography} from '@mui/material';
import {useState} from 'react';
import {EnvReadOnlyDialog} from './EnvReadOnlyDialog';
import type {BaseField} from './types';

interface SourceChipProps {
  field: BaseField;
}

interface SourceMeta {
  label: string;
  color: 'default' | 'primary' | 'warning' | 'info' | 'error';
  description: string;
  rootHint: string;
}

const SOURCE_META: Record<NonNullable<BaseField['x-source']>, SourceMeta> = {
  env: {
    label: 'ENV',
    color: 'warning',
    description: 'Stored in the Docker Compose environment file. Editing requires a stack restart.',
    rootHint: '/opt/stacks/openmower/.env',
  },
  'yaml-user': {
    label: 'YAML user',
    color: 'primary',
    description: 'User-editable YAML override. Saved on the host and merged on top of the image defaults.',
    rootHint: '~/params/mower_params.yaml',
  },
  'yaml-hw': {
    label: 'YAML HW',
    color: 'info',
    description:
      'Hardware-specific default baked into the image. Saving here writes a per-host override into mower_params.yaml that wins the merge.',
    rootHint: 'hardware_specific/<MOWER>/params_v2.yaml → mower_params.yaml',
  },
  ros: {
    label: 'ROS',
    color: 'default',
    description: 'Live ROS parameter. Changes take effect immediately via dynamic_reconfigure.',
    rootHint: 'ros::param',
  },
};

const RESTART_LABEL: Record<NonNullable<BaseField['x-restart-required']>, string> = {
  none: 'Takes effect immediately',
  service: 'Restart of the openmower service required',
  stack: 'Restart of the full Docker Compose stack required',
};

export function SourceChip({field}: SourceChipProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const source = field['x-source'];
  if (!source) return null;
  const meta = SOURCE_META[source];
  const path = field['x-yaml-path'] ?? field['x-ros-param'] ?? field['x-environment-variable'] ?? '';
  const restart = field['x-restart-required'];
  const readOnly = !!field['x-readonly-via-ui'];

  const tooltipBody = (
    <Box sx={{maxWidth: 320}}>
      <Typography variant="caption" sx={{display: 'block', fontWeight: 600, mb: 0.5}}>
        {meta.description}
      </Typography>
      <Typography variant="caption" sx={{display: 'block', mb: 0.5}}>
        <strong>Root:</strong> {meta.rootHint}
      </Typography>
      {path && (
        <Typography
          variant="caption"
          component="code"
          sx={{
            display: 'block',
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            wordBreak: 'break-all',
            mb: 0.5,
          }}
        >
          {path}
        </Typography>
      )}
      {restart && (
        <Typography variant="caption" sx={{display: 'block', color: 'text.secondary'}}>
          {RESTART_LABEL[restart]}
        </Typography>
      )}
      {readOnly && (
        <Typography variant="caption" sx={{display: 'block', color: 'warning.main', mt: 0.5}}>
          Read-only via the web UI. Click the chip for the CLI command.
        </Typography>
      )}
    </Box>
  );

  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0}}>
      <Chip
        label={meta.label}
        size="small"
        color={meta.color}
        variant={readOnly ? 'filled' : 'outlined'}
        onClick={readOnly ? () => setDialogOpen(true) : undefined}
        sx={{
          height: 20,
          fontSize: '0.65rem',
          fontWeight: 600,
          cursor: readOnly ? 'pointer' : 'default',
        }}
      />
      <Tooltip title={tooltipBody} placement="left" arrow>
        <InfoIcon sx={{fontSize: 14, color: 'text.disabled', cursor: 'help'}} />
      </Tooltip>
      {readOnly && (
        <EnvReadOnlyDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          field={field}
          rootHint={meta.rootHint}
        />
      )}
    </Box>
  );
}
