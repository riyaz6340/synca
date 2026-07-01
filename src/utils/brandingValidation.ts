export interface BrandingInput {
  logo_url?: string | null;
  primary_color?: string | null;
}

export interface BrandingValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
}

const LOGO_URL_MAX_LENGTH = 2048;
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export function validateBranding(input: BrandingInput): BrandingValidationResult {
  const errors: { field: string; message: string }[] = [];

  // Skip validation for undefined/null/empty string (these mean "clear the field")
  if (input.logo_url !== undefined && input.logo_url !== null && input.logo_url !== '') {
    if (input.logo_url.length > LOGO_URL_MAX_LENGTH) {
      errors.push({ field: 'logo_url', message: `Logo URL must not exceed ${LOGO_URL_MAX_LENGTH} characters` });
    }
    try {
      const url = new URL(input.logo_url);
      if (url.protocol !== 'https:') {
        errors.push({ field: 'logo_url', message: 'Logo URL must use HTTPS scheme' });
      }
    } catch {
      errors.push({ field: 'logo_url', message: 'Logo URL must be a valid URL' });
    }
  }

  // Skip validation for undefined/null/empty string (these mean "clear the field")
  if (input.primary_color !== undefined && input.primary_color !== null && input.primary_color !== '') {
    if (!HEX_COLOR_REGEX.test(input.primary_color)) {
      errors.push({ field: 'primary_color', message: 'Primary color must be in #RRGGBB format' });
    }
  }

  return { valid: errors.length === 0, errors };
}
