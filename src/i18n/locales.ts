export const supportedLocales = ['en', 'no'] as const;
export type Locale = (typeof supportedLocales)[number];
export const defaultLocale: Locale = 'no';

export function isSupportedLocale(input: string | undefined | null): input is Locale {
  return !!input && supportedLocales.includes(input as Locale);
}

export const localeNames: Record<Locale, string> = {
  en: 'English',
  no: 'Norsk',
};
