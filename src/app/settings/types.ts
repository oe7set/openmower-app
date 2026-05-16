import type {Field as JsfField} from '@remoteoss/json-schema-form';

export type SettingSource = 'env' | 'yaml-user' | 'yaml-hw' | 'ros';
export type SettingRestart = 'none' | 'service' | 'stack';

export interface BaseField extends JsfField {
  'x-param'?: string;
  'x-unit'?: string;
  'x-source'?: SettingSource;
  'x-yaml-path'?: string;
  'x-ros-param'?: string;
  'x-environment-variable'?: string | null;
  'x-restart-required'?: SettingRestart;
  'x-readonly-via-ui'?: boolean;
}

export interface RadioField extends BaseField {
  type: 'radio';
  inputType: 'radio';
  options: FieldOption[];
}

export interface FieldOption {
  label: string;
  value: string;
  description?: string;
  'x-value'?: number;
}

export interface CheckboxField extends BaseField {
  type: 'checkbox';
  inputType: 'checkbox';
}

export interface NumberField extends BaseField {
  type: 'number';
  inputType: 'number';
  minimum?: number;
  maximum?: number;
  percentage?: boolean;
}

export interface TextField extends BaseField {
  type: 'text';
  inputType: 'text';
}

export interface SelectField extends BaseField {
  type: 'select';
  inputType: 'select';
  options: FieldOption[];
}

export interface FieldsetField extends BaseField {
  type: 'fieldset';
  inputType: 'fieldset';
  fields: Field[];
}

export type Field = RadioField | CheckboxField | NumberField | TextField | SelectField | FieldsetField;
