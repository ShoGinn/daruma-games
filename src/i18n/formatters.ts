import type { Formatters, Locales } from './i18n-types';
import type { FormattersInitializer } from 'typesafe-i18n';

export const initFormatters: FormattersInitializer<Locales, Formatters> = (
  _locale: Locales,
) => {
  const formatters: Formatters = {
    // add your formatter functions here
  };

  return formatters;
};
