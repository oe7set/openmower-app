'use client';

import {Page, PageContent, PageHeader} from '@/components/page';
import {useToast} from '@/hooks/useToast';
import {useSelectedMower} from '@/stores/mowersStore';
import JsonSchemaDereferencer from '@json-schema-tools/dereferencer';
import {ExpandMore as ExpandMoreIcon, Save as SaveIcon} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Switch,
  Typography,
} from '@mui/material';
import {createHeadlessForm} from '@remoteoss/json-schema-form';
import type {ValidationResult} from '@remoteoss/json-schema-form';
import mergeAllOf from 'json-schema-merge-allof';
import merge from 'lodash.merge';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormProvider, useForm, useFormContext, useWatch} from 'react-hook-form';
import {parse as parseYaml} from 'yaml';
import {buildEnvVarMap, buildEnvVarReverseMap, flattenToEnvVars, unflattenFromEnvVars} from './envVarMapping';
import {FieldsetField} from './fields/FieldsetField';
import {aggregateRestart, collectLeafIndex, routeChanges, unflattenSnapshots, type LeafInfo} from './paramRouting';
import RestartServiceButton from './RestartServiceButton';
import {SettingsContext} from './SettingsContext';
import {StickyBreadcrumb} from './StickyBreadcrumb';
import {deepMergeNoArrayMerge, getNestedValue, setNestedValue} from './settingsUtils';
import type {Field, FieldsetField as FieldsetFieldType} from './types';
import {jsonSchemaResolver} from './validationResolver';

// Defaults files that the backend's meta.config.defaults() may return. The
// xbot_monitoring patch only ever populates defaults.yaml (the others are
// empty stubs) but we keep the merge order stable in case a future deployment
// ships board- or mower-specific overrides.
const RELEVANT_DEFAULTS = ['defaults.yaml', 'boards/v1.yaml', 'mowers/YardForce500.yaml'];

interface FormState {
  fields: Field[];
  defaults: Record<string, unknown>;
  handleValidation: (value: Record<string, unknown>) => ValidationResult;
  envVarMap: Record<string, string>;
  leafIndex: Map<string, LeafInfo>;
}

export function SettingsForm() {
  const [formState, setFormState] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rpc = useSelectedMower((s) => s?.rpc);

  useEffect(() => {
    async function initializeForm() {
      if (!rpc) {
        setError('No mower selected');
        return;
      }
      setError(null);

      try {
        // get() may not be available on older backends — tolerate failure so
        // the form still renders against YAML defaults.
        const [schema, defaultsFiles, currentRaw] = await Promise.all([
          rpc.meta.config.schema(),
          rpc.meta.config.defaults(),
          (rpc.meta.config.get() as Promise<unknown>).catch((e) => {
            console.warn('meta.config.get() failed; falling back to YAML defaults only:', e);
            return {} as Record<string, string>;
          }),
        ]);
        const yamlDefaults = RELEVANT_DEFAULTS.reduce<Record<string, unknown>>((acc, path) => {
          const yaml = defaultsFiles[path];
          if (!yaml) return acc;
          const parsed = parseYaml(yaml);
          merge(acc, parsed);
          return acc;
        }, {});

        const parsedSchema = JSON.parse(schema);
        const dereferencer = new JsonSchemaDereferencer(parsedSchema, {
          recursive: true,
        });
        const dereferencedSchema = await dereferencer.resolve();
        if (typeof dereferencedSchema !== 'object') {
          throw new Error('Dereferenced schema is not an object');
        }
        const mergedSchema = mergeAllOf(dereferencedSchema);
        const {fields: formFields, handleValidation} = createHeadlessForm(mergedSchema);

        // Build the property-path → env-var map from the dereferenced schema
        // so save-time flattening can resolve every leaf without re-walking
        // the form structure.
        const envVarMap = buildEnvVarMap(mergedSchema);

        // Schema-driven leaf index — covers env / yaml-* / ros sources with
        // the new x-* annotations. Used for source-aware save routing and
        // the live ROS-param snapshot fetched below.
        const leafIndex = collectLeafIndex(mergedSchema);

        // …and the reverse map so we can take the live env-var snapshot from
        // mower_config.sh (rpc.meta.config.get) and rebuild the nested values
        // tree the form is rendered against.
        const reverseMap = buildEnvVarReverseMap(mergedSchema);
        const envSnapshot = (currentRaw ?? {}) as Record<string, unknown>;
        const liveValues = unflattenFromEnvVars(envSnapshot, reverseMap);

        // Pull the live values for every ROS-sourced leaf in one shot.
        // Capability-gate on the new RPC so older backends don't break: a
        // missing params.get_many is equivalent to "no live ROS values yet".
        const rosNames: string[] = [];
        for (const leaf of leafIndex.values()) {
          if (leaf.source === 'ros' && leaf.rosParam) rosNames.push(leaf.rosParam);
        }
        let rosSnapshot: Record<string, unknown> = {};
        if (rosNames.length > 0) {
          try {
            const result = await (
              rpc.params.get_many({names: rosNames}) as Promise<{values?: Record<string, unknown>}>
            );
            rosSnapshot = (result?.values ?? {}) as Record<string, unknown>;
          } catch (e) {
            console.warn('params.get_many() failed; ROS-sourced settings will fall back to schema defaults:', e);
          }
        }

        const schemaDrivenLive = unflattenSnapshots(envSnapshot, rosSnapshot, leafIndex);

        // Live values win over YAML defaults — that's what the user actually
        // configured. The "Reset to default" affordance still compares against
        // YAML so the user sees what's diverged from the system baseline.
        // Order: yaml defaults → legacy env-var-derived live values →
        // schema-driven live values (which includes ROS-sourced fields the
        // legacy reverse map cannot resolve).
        const defaults = merge({}, yamlDefaults, liveValues, schemaDrivenLive);

        const newFormState = {
          fields: formFields as unknown as Field[],
          defaults,
          handleValidation: handleValidation as (value: Record<string, unknown>) => ValidationResult,
          envVarMap,
          leafIndex,
        };
        setFormState(newFormState);
      } catch (err) {
        console.error('Failed to initialize form:', err);
        setError('Failed to load settings schema');
      }
    }

    initializeForm();
  }, [rpc]);

  if (error) {
    return (
      <Page>
        <PageHeader title="Settings" subtitle="Configure your mower" />
        <PageContent>
          <Typography color="error" sx={{p: 3}}>
            {error}
          </Typography>
        </PageContent>
      </Page>
    );
  }

  if (!formState) {
    return (
      <Page>
        <PageHeader title="Settings" subtitle="Configure your mower" />
        <PageContent>
          <Box sx={{display: 'flex', justifyContent: 'center', py: 6}}>
            <CircularProgress />
          </Box>
        </PageContent>
      </Page>
    );
  }

  return <SettingsFormContent formState={formState} />;
}

function SettingsFormContent({formState}: {formState: FormState}) {
  const toast = useToast();
  const rpc = useSelectedMower((s) => s?.rpc);
  const [saving, setSaving] = useState(false);

  const methods = useForm({
    defaultValues: formState.defaults,
    resolver: jsonSchemaResolver(formState.handleValidation),
    mode: 'onChange',
  });

  const confirmedFieldsRef = useRef(new Set<string>());
  const [confirmedFields, setConfirmedFields] = useState(new Set<string>());

  const onFieldChange = useCallback((path: string) => {
    confirmedFieldsRef.current.add(path);
    setConfirmedFields((prev) => {
      if (prev.has(path)) return prev;
      return new Set(prev).add(path);
    });
  }, []);

  const onFieldReset = useCallback(
    (path: string) => {
      confirmedFieldsRef.current.delete(path);
      setConfirmedFields((prev) => {
        if (!prev.has(path)) return prev;
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      const defaultValue = formState ? getNestedValue(formState.defaults, path) : undefined;
      methods.resetField(path as never, {defaultValue: defaultValue as never});
    },
    [formState, methods],
  );

  function getConfirmedValues(): Record<string, unknown> {
    const allValues = methods.getValues() as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const path of confirmedFieldsRef.current) {
      setNestedValue(result, path, getNestedValue(allValues, path));
    }
    return result;
  }

  const topLevelFieldsets = formState.fields.filter((field) => field.type === 'fieldset') as FieldsetFieldType[];
  const hasChanges = confirmedFields.size > 0;
  const {isValid} = methods.formState;

  return (
    <SettingsContext.Provider
      value={{
        defaults: formState.defaults,
        confirmedFields,
        onFieldChange,
        onFieldReset,
      }}
    >
      <FormProvider {...methods}>
        <Page>
          <PageHeader title="Settings" subtitle="Configure your mower">
            {hasChanges && (
              <Chip
                label={`${confirmedFields.size} change${confirmedFields.size !== 1 ? 's' : ''}`}
                color="secondary"
                size="small"
              />
            )}
          </PageHeader>
          <PageContent>
            <RestartHint confirmedFields={confirmedFields} leafIndex={formState.leafIndex} />
            <Box sx={{display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2}}>
              <RestartServiceButton />
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                disabled={!hasChanges || !isValid || saving || !rpc}
                onClick={async () => {
                  if (!rpc) return;
                  const confirmedValues = getConfirmedValues();
                  // New routing path covers ROS + YAML simultaneously.
                  const {yamlChanges, rosChanges, skipped} = routeChanges(
                    confirmedValues,
                    formState.leafIndex,
                  );
                  // Legacy fallback: any leaf the schema-walker didn't see
                  // (older deployments shipped a schema without x-source)
                  // is still routed through the OM_*-based flatten so older
                  // mowers keep working even before they're updated.
                  const legacyEnvChanges = flattenToEnvVars(confirmedValues, formState.envVarMap);
                  const mergedYamlChanges: Record<string, unknown> = {...legacyEnvChanges, ...yamlChanges};

                  const totalChanges = Object.keys(mergedYamlChanges).length + Object.keys(rosChanges).length;
                  if (totalChanges === 0) {
                    toast.warning('No saveable changes detected');
                    return;
                  }

                  setSaving(true);
                  try {
                    let yamlReportedSkipped: string[] = [];
                    if (Object.keys(mergedYamlChanges).length > 0) {
                      const result = (await rpc.meta.config.set({changes: mergedYamlChanges as never})) as {
                        skipped_keys?: string[];
                      };
                      yamlReportedSkipped = result?.skipped_keys ?? [];
                    }

                    const rosResults = await Promise.allSettled(
                      Object.entries(rosChanges).map(([name, value]) =>
                        rpc.params.set({name, value: value as never}),
                      ),
                    );
                    const rosFailures = rosResults.filter((r) => r.status === 'rejected').length;

                    const totalSkipped = skipped.length + yamlReportedSkipped.length;
                    if (rosFailures > 0) {
                      toast.error(`Saved ${totalChanges - rosFailures} of ${totalChanges} — ${rosFailures} ROS update(s) failed`);
                    } else if (totalSkipped > 0) {
                      toast.warning(
                        `Saved ${totalChanges} setting(s); ${totalSkipped} read-only key(s) skipped`,
                      );
                    } else {
                      const restart = aggregateRestart(confirmedFieldsRef.current, formState.leafIndex);
                      const suffix =
                        restart === 'service'
                          ? ' Restart the mower service to apply YAML-backed changes.'
                          : restart === 'stack'
                            ? ' Restart the full Compose stack to apply.'
                            : '';
                      toast.success(`Saved ${totalChanges} setting(s).${suffix}`);
                    }
                    confirmedFieldsRef.current.clear();
                    setConfirmedFields(new Set());
                  } catch (err) {
                    toast.error(`Save failed: ${(err as Error).message}`);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </Box>

            <StickyBreadcrumb />

            {topLevelFieldsets.map((fieldset) => (
              <SettingsAccordion key={fieldset.name} fieldset={fieldset} />
            ))}

            <ConfirmedValuesDebug
              confirmedFieldsRef={confirmedFieldsRef}
              getConfirmedValues={getConfirmedValues}
              defaults={formState.defaults}
            />
          </PageContent>
        </Page>
      </FormProvider>
    </SettingsContext.Provider>
  );
}

function SettingsAccordion({fieldset}: {fieldset: FieldsetFieldType}) {
  const {confirmedFields} = useSettingsContext();

  const changedCount = useMemo(() => {
    let count = 0;
    for (const path of confirmedFields) {
      if (path.startsWith(fieldset.name + '.')) count++;
    }
    return count;
  }, [confirmedFields, fieldset.name]);

  return (
    <Accordion
      disableGutters
      sx={{
        mb: 1.5,
        '&:before': {display: 'none'},
        borderRadius: '12px !important',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
        '&.Mui-expanded': {
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          borderColor: 'primary.light',
        },
      }}
      defaultExpanded={false}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        data-section-marker=""
        data-section-level="0"
        data-section-label={fieldset.label}
        sx={{
          bgcolor: 'background.paper',
          '&:hover': {bgcolor: 'action.hover'},
          minHeight: 56,
          '& .MuiAccordionSummary-content': {
            margin: '14px 0',
          },
        }}
      >
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, width: '100%'}}>
          <Typography variant="subtitle1" fontWeight={600}>
            {fieldset.label}
          </Typography>
          {changedCount > 0 && <Chip label={changedCount} size="small" color="primary" sx={{height: 22, minWidth: 22}} />}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{pt: 2, pb: 3}}>
        {fieldset.description && (
          <Typography variant="body2" color="text.secondary" sx={{mb: 2.5}}>
            {fieldset.description}
          </Typography>
        )}
        <FieldsetField field={fieldset} level={0} pathPrefix={fieldset.name} />
      </AccordionDetails>
    </Accordion>
  );
}

import {useSettingsContext} from './SettingsContext';

function RestartHint({
  confirmedFields,
  leafIndex,
}: {
  confirmedFields: Set<string>;
  leafIndex: Map<string, LeafInfo>;
}) {
  const level = useMemo(() => aggregateRestart(confirmedFields, leafIndex), [confirmedFields, leafIndex]);
  if (level === 'none' || confirmedFields.size === 0) return null;
  const message =
    level === 'stack'
      ? 'Some pending changes are stored in the Docker Compose .env file. After saving you must restart the full Compose stack on the host (e.g. via dockge or `docker compose up -d`) for them to take effect.'
      : 'Some pending changes are stored in YAML on the host. After saving, restart the openmower service for them to take effect.';
  return (
    <Box
      sx={{
        mb: 2,
        p: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: level === 'stack' ? 'error.light' : 'warning.light',
        bgcolor: level === 'stack' ? 'error.main' : 'warning.main',
        backgroundColor: level === 'stack' ? 'rgba(244, 67, 54, 0.06)' : 'rgba(237, 108, 2, 0.06)',
      }}
    >
      <Typography variant="body2">{message}</Typography>
    </Box>
  );
}

interface ConfirmedValuesDebugProps {
  confirmedFieldsRef: React.RefObject<Set<string>>;
  getConfirmedValues: () => Record<string, unknown>;
  defaults: Record<string, unknown>;
}

function ConfirmedValuesDebug({confirmedFieldsRef, getConfirmedValues, defaults}: ConfirmedValuesDebugProps) {
  useWatch({});
  const {
    formState: {errors},
  } = useFormContext();

  const [showMerged, setShowMerged] = useState(false);

  const confirmed = getConfirmedValues();
  const isEmpty = confirmedFieldsRef.current.size === 0;

  const merged = deepMergeNoArrayMerge(defaults, confirmed);
  const displayed = showMerged ? merged : confirmed;

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        mt: 4,
        p: 2,
        bgcolor: 'background.default',
        borderRadius: 3,
      }}
    >
      <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1}}>
        <Typography variant="subtitle2" color="text.secondary">
          Config to be persisted
        </Typography>
        <FormControlLabel
          control={<Switch size="small" checked={showMerged} onChange={(e) => setShowMerged(e.target.checked)} />}
          label={<Typography variant="caption">Show merged with defaults</Typography>}
          labelPlacement="start"
          sx={{m: 0, gap: 1}}
        />
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          color: isEmpty ? 'text.disabled' : 'text.primary',
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          maxHeight: 400,
          overflow: 'auto',
        }}
      >
        {isEmpty && !showMerged ? '(no changes)' : JSON.stringify(displayed, null, 2)}
      </Box>
      {hasErrors && (
        <Box sx={{mt: 2}}>
          <Typography variant="subtitle2" color="error" gutterBottom>
            Validation errors
          </Typography>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1.5,
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: 'error.main',
              bgcolor: 'error.main',
              borderRadius: 2,
              // Use semi-transparent background for error
              backgroundColor: 'rgba(244, 67, 54, 0.04)',
              border: '1px solid',
              borderColor: 'error.light',
              maxHeight: 300,
              overflow: 'auto',
            }}
          >
            {JSON.stringify(errors, null, 2)}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
