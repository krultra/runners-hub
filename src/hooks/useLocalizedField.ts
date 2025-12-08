import { useTranslation } from 'react-i18next';

/**
 * Hook to get a localized field value from an object.
 * Looks for fieldName_<locale> first, then falls back to fieldName.
 * 
 * Example usage:
 *   const getLocalizedName = useLocalizedField();
 *   const name = getLocalizedName(raceDistance, 'displayName');
 *   // Returns displayName_no if locale is 'no' and field exists,
 *   // otherwise returns displayName
 */
export function useLocalizedField() {
  const { i18n } = useTranslation();
  const locale = i18n.language?.substring(0, 2) || 'no';

  return function getLocalizedField<T extends Record<string, any>>(
    obj: T,
    fieldName: keyof T & string
  ): string {
    if (!obj) return '';
    
    // Try locale-specific field first (e.g., displayName_no)
    const localizedKey = `${fieldName}_${locale}` as keyof T;
    if (obj[localizedKey] && typeof obj[localizedKey] === 'string') {
      return obj[localizedKey] as string;
    }
    
    // Fall back to base field (e.g., displayName)
    const baseValue = obj[fieldName];
    return typeof baseValue === 'string' ? baseValue : '';
  };
}

export default useLocalizedField;
