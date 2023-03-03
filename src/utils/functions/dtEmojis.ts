import { Client } from 'discordx';

import logger from './LoggerFactory.js';

const emojiConfig = {
    '3png': 'Ct',
    '2png': 'HB',
    '1png': 'Rm',
    ph: 'PH',
    roll: 'roll',
};
enum Emoji {
    'Ct' = ':three:',
    'HB' = ':two:',
    'Rm' = ':one:',
    'PH' = '🔴',
    'roll' = '🎲',
}
export const emojis: Record<string, string> = {};

/**
 * Grabs all necessary emojis from discord cache and makes available for easy use throughout game
 *
 * @param {Client} client
 */
export function gatherEmojis(client: Client): void {
    const missingEmojis: Array<string> = [];
    for (const [key, value] of Object.entries(emojiConfig)) {
        const emoji = client.emojis.cache.find(emoji => emoji.name === value);
        if (emoji) {
            emojis[key] = emoji.toString();
        } else {
            missingEmojis.push(value);
            emojis[key] = Emoji[value as keyof typeof Emoji];
        }
    }
    if (missingEmojis.length > 0) {
        logger.warn(`Missing emojis: ${missingEmojis.join(', ')}. Using default emojis instead.`);
    }
}

export function emojiConvert(content: string): string {
    const contentArr = content.toLowerCase().split('');

    const newContent = contentArr.map(letter => {
        if (/[a-z]/g.test(letter)) return `:regional_indicator_${letter}:`;
        else if (chars[letter]) return chars[letter];
        else return letter;
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
