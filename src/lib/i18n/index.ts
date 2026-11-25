import { derived, writable } from 'svelte/store';
import { english } from './messages';

export type Language = 'ru' | 'en';
export const language = writable<Language>('ru');
export type Translate = (message: string, values?: Record<string, string | number>) => string;
export const t = derived(
	language,
	(locale): Translate =>
		(message, values) => {
			const text = locale === 'en' ? (english[message] ?? message) : message;
			return values
				? text.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match))
				: text;
		}
);
export const fmt = derived(
	language,
	(locale) => new Intl.NumberFormat(locale, { maximumSignificantDigits: 4 }).format
);

// Keep a decimal comma together inside a typeset number.
export const mathNumber = derived(
	fmt,
	(format) => (value: number) => format(value).replace(',', '{,}')
);
