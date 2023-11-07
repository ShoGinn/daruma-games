import { Client } from 'discordx';

import { singleton } from 'tsyringe';

import logger from './logger-factory.js';

export enum EmojiConfig {
  Ct = '3',
  HB = '2',
  Rm = '1',
  PH = 'ph',
  Roll = 'roll',
}
type EmojisMap = Map<string, string>;

@singleton()
export class GameEmojis {
  public static readonly emojis: EmojisMap = GameEmojis.getDefaultEmojis();
  private static readonly defaultEmojis: EmojisMap = GameEmojis.getDefaultEmojis();
  /**
   * Grabs all necessary emojis from discord cache and makes available for easy use throughout game
   *
   * @param {Client} client
   */
  public static gatherEmojis(client: Client): void {
    const missingEmojis: Set<string> = new Set();
    for (const [key, value] of Object.entries(EmojiConfig)) {
      const emoji = client.emojis.cache.find(
        (emoji) => emoji.name?.toLowerCase() === key.toLowerCase(),
      );
      if (emoji) {
        GameEmojis.emojis.set(value, emoji.toString());
      } else {
        missingEmojis.add(value);
      }
    }
    if (missingEmojis.size > 0) {
      logger.warn(
        `Missing emojis: ${[...missingEmojis].join(', ')}. Using default emojis instead.`,
      );
      return;
    }
    logger.debug(`Emojis gathered successfully. ${JSON.stringify([...GameEmojis.emojis])}`);
  }
  public static getGameEmoji(damageOrOther?: string | number): string {
    const placeHolder = EmojiConfig.PH.toLowerCase();
    const roll = EmojiConfig.Roll.toLowerCase();
    switch (typeof damageOrOther) {
      case 'string': {
        damageOrOther = damageOrOther.toLowerCase();
        if (damageOrOther.includes(placeHolder)) {
          return GameEmojis.getEmoji(EmojiConfig.PH);
        }
        if (damageOrOther.includes(roll)) {
          return GameEmojis.getEmoji(EmojiConfig.Roll);
        }
        break;
      }
      case 'number': {
        return GameEmojis.getEmoji(damageOrOther.toString());
      }
    }
    return GameEmojis.getEmoji(EmojiConfig.PH);
  }
  private static getEmoji(emojiName: string): string {
    return GameEmojis.emojis.get(emojiName) || this.defaultEmojis.get(emojiName) || '';
  }
  static getDefaultEmojis(): EmojisMap {
    return new Map([
      [EmojiConfig.Ct, ':three:'],
      [EmojiConfig.HB, ':two:'],
      [EmojiConfig.Rm, ':one:'],
      [EmojiConfig.PH, ':red_circle:'],
      [EmojiConfig.Roll, ':game_die:'],
    ]);
  }
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
