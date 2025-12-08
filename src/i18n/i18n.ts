import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './messages/en.json';
import no from './messages/no.json';

const LOCALE_STORAGE_KEY = 'runnershub_locale';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      no: { translation: no },
    },
    fallbackLng: 'no',
    supportedLngs: ['en', 'no'],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

export default i18n;
export { LOCALE_STORAGE_KEY };
