import { Client } from 'discordx';

import logger from './logger-factory.js';

export enum EmojiConfig {
  Ct = '3',
  HB = '2',
  Rm = '1',
  PH = 'ph',
  Roll = 'roll',
}
type EmojisMap = Map<string, string>;
export const emojis: EmojisMap = getDefaultEmojis();
const defaultEmojis: EmojisMap = getDefaultEmojis();

export function gatherEmojis(client: Client): void {
  const missingEmojis = new Set<string>();
  for (const [key, value] of Object.entries(EmojiConfig)) {
    const emoji = client.emojis.cache.find(
      (emoji) => emoji.name?.toLowerCase() === key.toLowerCase(),
    );
    if (emoji) {
      emojis.set(value, emoji.toString());
    } else {
      missingEmojis.add(value);
    }
  }
  if (missingEmojis.size > 0) {
    logger.warn(`Missing emojis: ${[...missingEmojis].join(', ')}. Using default emojis instead.`);
    return;
  }
  logger.debug(`Emojis gathered successfully. ${JSON.stringify([...emojis])}`);
}
export function getGameEmoji(damageOrOther?: string | number): string {
  const placeHolder = EmojiConfig.PH.toLowerCase();
  const roll = EmojiConfig.Roll.toLowerCase();
  switch (typeof damageOrOther) {
    case 'string': {
      damageOrOther = damageOrOther.toLowerCase();
      if (damageOrOther.includes(placeHolder)) {
        return getEmoji(EmojiConfig.PH);
      }
      if (damageOrOther.includes(roll)) {
        return getEmoji(EmojiConfig.Roll);
      }
      break;
    }
    case 'number': {
      return getEmoji(damageOrOther.toString());
    }
  }
  return getEmoji(EmojiConfig.PH);
}
function getEmoji(emojiName: string): string {
  return emojis.get(emojiName) ?? defaultEmojis.get(emojiName) ?? '';
}
export function getDefaultEmojis(): EmojisMap {
  return new Map([
    [EmojiConfig.Ct, ':three:'],
    [EmojiConfig.HB, ':two:'],
    [EmojiConfig.Rm, ':one:'],
    [EmojiConfig.PH, ':red_circle:'],
    [EmojiConfig.Roll, ':game_die:'],
  ]);
}

export function emojiConvert(content: string): string {
  const contentArray = [...content.toLowerCase()];

  const newContent = contentArray.map((letter) => {
    if (/[a-z]/g.test(letter)) {
      return `:regional_indicator_${letter}:`;
    } else if (chars[letter]) {
      return chars[letter];
    } else {
      return letter;
    }
  });

  return newContent.join('');
}

const chars: Record<string, string> = {
  '0': ':zero:',
  '1': ':one:',
  '2': ':two:',
  '3': ':three:',
  '4': ':four:',
  '5': ':five:',
  '6': ':six:',
  '7': ':seven:',
  '8': ':eight:',
  '9': ':nine:',
  '#': ':hash:',
  '*': ':asterisk:',
  '?': ':grey_question:',
  '!': ':grey_exclamation:',
  '+': ':heavy_plus_sign:',
  '-': ':heavy_minus_sign:',
  '×': ':heavy_multiplication_x:',
  $: ':heavy_dollar_sign:',
  '/': ':heavy_division_sign:',
  ' ': '   ',
};
