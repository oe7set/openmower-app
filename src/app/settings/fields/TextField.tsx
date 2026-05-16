import {Box, TextField as MuiTextField} from '@mui/material';
import {SettingsFieldWrapper} from '../SettingsFieldWrapper';
import type {TextField as TextFieldType} from '../types';
import {useSettingsField} from '../useSettingsField';

interface TextFieldProps {
  field: TextFieldType;
  path: string;
}

export function TextField({field, path}: TextFieldProps) {
  const readOnly = !!field['x-readonly-via-ui'];
  const {controllerField, hasError, onChange} = useSettingsField(path, '', readOnly);

  return (
    <SettingsFieldWrapper path={path} currentValue={controllerField.value} field={field}>
      <Box sx={{mb: 2}}>
        <MuiTextField
          fullWidth
          type="text"
          name={field.name}
          label={field.label}
          value={controllerField.value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          error={hasError}
          disabled={readOnly}
          helperText={field.description}
          slotProps={{
            formHelperText: {
              sx: {whiteSpace: 'pre-wrap'},
            },
          }}
        />
      </Box>
    </SettingsFieldWrapper>
  );
}
