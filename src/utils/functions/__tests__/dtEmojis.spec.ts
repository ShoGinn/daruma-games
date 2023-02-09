import { describe, expect, it } from '@jest/globals';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { emojiConvert, emojis, gatherEmojis } from '../dtEmojis.js';
import logger from '../LoggerFactory.js';
jest.mock('../LoggerFactory.js', () => {
    return {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    };
});

beforeEach(() => {
    (logger.error as jest.Mock).mockReset();
    (logger.warn as jest.Mock).mockReset();
    (logger.info as jest.Mock).mockReset();
});

describe('Emoji Convert', () => {
    it('should convert a string to emoji format', () => {
        const content = 'hello';
        const expectedResult =
            ':regional_indicator_h::regional_indicator_e::regional_indicator_l::regional_indicator_l::regional_indicator_o:';

        const result = emojiConvert(content);
        expect(result).toEqual(expectedResult);
    });

    it('should return the same string if it contains non-letter characters', () => {
        const content = 'hello, world!';
        const expectedResult =
            ':regional_indicator_h::regional_indicator_e::regional_indicator_l::regional_indicator_l::regional_indicator_o:,   :regional_indicator_w::regional_indicator_o::regional_indicator_r::regional_indicator_l::regional_indicator_d::grey_exclamation:';

        const result = emojiConvert(content);
        expect(result).toEqual(expectedResult);
    });

    it('should ignore uppercase or lowercase', () => {
        const content = 'HelLo, World!';
        const expectedResult =
            ':regional_indicator_h::regional_indicator_e::regional_indicator_l::regional_indicator_l::regional_indicator_o:,   :regional_indicator_w::regional_indicator_o::regional_indicator_r::regional_indicator_l::regional_indicator_d::grey_exclamation:';

        const result = emojiConvert(content);
        expect(result).toEqual(expectedResult);
    });

    it('should return the same string containing numbers and special characters', () => {
        const content = 'Hello, 123456!@#$%^*()';
        const expectedResult =
            ':regional_indicator_h::regional_indicator_e::regional_indicator_l::regional_indicator_l::regional_indicator_o:,   :one::two::three::four::five::six::grey_exclamation:@:hash::heavy_dollar_sign:%^:asterisk:()';

        const result = emojiConvert(content);
        expect(result).toEqual(expectedResult);
    });
});

describe('gatherEmojis', () => {
    const client = container.resolve(Client);
    // Test if the default emojis are used when the required emojis are not available in cache
    it('Default emojis are used when required emojis are not available in cache', () => {
        gatherEmojis(client);
        expect(emojis).toEqual({
            '3png': ':three:',
            '2png': ':two:',
            '1png': ':one:',
            ph: '🔴',
            roll: '🎲',
        });
    });
});
