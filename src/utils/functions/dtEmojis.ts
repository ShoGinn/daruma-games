import { Client } from 'discordx';

const emojiConfig = {
    '3png': 'Ct',
    '2png': 'HB',
    '1png': 'Rm',
    ph: 'PH',
    roll: 'roll',
};
declare enum Emoji {
    'Ct' = ':three:',
    'HB' = ':two:',
    'Rm' = ':one:',
    'PH' = '🔴',
    'roll' = '🎲',
}
export let emojis: DarumaTrainingPlugin.Emojis = {};

/**
 * Grabs all necessary emojis from discord cache and makes available for easy use throughout game
 * @param client
 * @returns
 */
export function gatherEmojis(client: Client): void {
    let missingEmojis: string[] = [];
    Object.entries(emojiConfig).forEach(([key, value]) => {
        const emoji = client.emojis.cache.find(emoji => emoji.name === value);
        if (!emoji) {
            missingEmojis.push(value);
            emojis[key] = Emoji[value as keyof typeof Emoji];
        } else {
            emojis[key] = emoji.toString();
        }
    });
    if (missingEmojis.length > 0) {
        console.log(`Missing emojis: ${missingEmojis.join(', ')}. Using default emojis instead.`);
    }
}

export function emojiConvert(content: string): string {
    let contentArr = content.toLowerCase().split('');

    let newContent = contentArr.map(letter => {
        if (/[a-z]/g.test(letter)) return `:regional_indicator_${letter}:`;
        else if (chars[letter]) return chars[letter];
        else return letter;
    });

    return newContent.join('');
}

const chars = {
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
