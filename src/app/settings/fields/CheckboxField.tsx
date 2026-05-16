import {Box, Checkbox, FormControlLabel, FormHelperText} from '@mui/material';
import {SettingsFieldWrapper} from '../SettingsFieldWrapper';
import type {CheckboxField as CheckboxFieldType} from '../types';
import {useSettingsField} from '../useSettingsField';

interface CheckboxFieldProps {
  field: CheckboxFieldType;
  path: string;
}

export function CheckboxField({field, path}: CheckboxFieldProps) {
  const readOnly = !!field['x-readonly-via-ui'];
  const {controllerField, hasError, onChange} = useSettingsField(path, false, readOnly);

  return (
    <SettingsFieldWrapper path={path} currentValue={controllerField.value} field={field}>
      <Box sx={{mb: 2}}>
        <FormControlLabel
          control={
            <Checkbox
              checked={!!controllerField.value}
              onChange={(e) => onChange(e.target.checked)}
              name={field.name}
              color={hasError ? 'error' : 'primary'}
              disabled={readOnly}
            />
          }
          label={field.label}
        />
        {field.description && <FormHelperText sx={{ml: 4, mt: -1}}>{field.description}</FormHelperText>}
      </Box>
    </SettingsFieldWrapper>
  );
}
