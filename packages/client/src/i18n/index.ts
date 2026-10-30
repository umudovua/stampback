import az from './az.json';
import en from './en.json';
import ru from './ru.json';
import tr from './tr.json';

export type Locale = 'az' | 'en' | 'tr' | 'ru';
export type MessageKey = keyof typeof az;

const catalogs: Record<Locale, Record<MessageKey, string>> = { az, en, tr, ru };

/** Brauzer ayarlarından ilk dəstəklənən dili seçir; tapılmasa ingilis dili. */
export function detectLocale(languages: readonly string[] = navigator.languages): Locale {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'az' || base === 'en' || base === 'tr' || base === 'ru') return base;
  }
  return 'en';
}

let current: Locale = detectLocale();

export function setLocale(locale: Locale): void {
  current = locale;
  document.documentElement.lang = locale;
}

export function getLocale(): Locale {
  return current;
}

/** Açarı tərcümə edir; `{name}` yer tutucuları `params`-dan doldurulur. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  const template = catalogs[current][key] ?? catalogs.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
