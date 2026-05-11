// eslint-config-next 16 ships native flat-config arrays. Importing them
// directly avoids @eslint/eslintrc's FlatCompat shim, which crashes with
// "Converting circular structure to JSON" when validating the legacy-style
// plugin metadata exposed by next/typescript.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
];

export default eslintConfig;
