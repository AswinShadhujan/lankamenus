/** Suggested portion names for the admin UI dropdown (mirrors API `portions.constants.ts`). */
export const PREDEFINED_PORTION_NAMES = [
  'Mini',
  'Small',
  'Regular',
  'Normal',
  'Medium',
  'Large',
  'Full',
  'Half',
  'Quarter',
  'Family',
] as const;

export type PredefinedPortionName = (typeof PREDEFINED_PORTION_NAMES)[number];

export const PORTION_NAME_CUSTOM = '__custom__';
