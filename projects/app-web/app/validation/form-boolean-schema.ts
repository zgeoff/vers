import { z } from 'zod';

// base-ui erroneously submits 'off' values from our unchecked checkbox
// fields rather than omitting them so we need to transform our string values
// to booleans
export const FormBooleanSchema = z.string().transform((value) => value === 'on');
