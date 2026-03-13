import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import de from './locales/de/ui.json';
import en from './locales/en/ui.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { ui: de },
      en: { ui: en },
    },
    fallbackLng: false,
    load: 'languageOnly',
    defaultNS: 'ui',
    ns: ['ui'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'vs_language',
      caches: ['localStorage'],
    },
  });

export default i18n;
