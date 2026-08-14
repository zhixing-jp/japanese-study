export const languages = {
  'zh': '简体中文',
  'zh-TW': '繁體中文',
  'en': 'English',
  'vi': 'Tiếng Việt',
  'ko': '한국어',
  'ja': '日本語'
};

export const defaultLang = 'zh';

export function getLangFromUrl(url) {
  const [, lang] = url.pathname.split('/');
  if (lang in languages) return lang;
  return defaultLang;
}

export function useTranslations(lang) {
  return function t(key) {
    return translations[lang]?.[key] ?? translations[defaultLang]?.[key] ?? key;
  }
}

export async function loadLocale(lang) {
  try {
    const locale = await import(`../../locales/${lang}.json`);
    return locale.default;
  } catch {
    const locale = await import(`../../locales/zh.json`);
    return locale.default;
  }
}