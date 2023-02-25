import { describe, expect, it } from '@jest/globals';
import { Collection, GuildEmoji } from 'discord.js';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { emojiConvert, emojis, gatherEmojis } from '../../src/utils/functions/dtEmojis.js';

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
    describe('mock the emojis before running the tests', () => {
        const emojisInCache = new Collection<string, GuildEmoji>();

        emojisInCache.set('Ct', { id: '123', name: 'Ct' } as GuildEmoji);
        emojisInCache.set('HB', { id: '456', name: 'HB' } as GuildEmoji);
        emojisInCache.set('Rm', { id: '789', name: 'Rm' } as GuildEmoji);
        emojisInCache.set('PH', { id: '101112', name: 'PH' } as GuildEmoji);
        emojisInCache.set('roll', { id: '131415', name: 'roll' } as GuildEmoji);
        const client_local = {
            emojis: {
                cache: emojisInCache,
            },
        } as unknown as Client;

        it('Required emojis are used when available in cache', () => {
            gatherEmojis(client_local);
            expect(emojis).toEqual({
                '3png': '<:Ct:123>',
                '2png': '<:HB:456>',
                '1png': '<:Rm:789>',
                ph: '<:PH:101112>',
                roll: '<:roll:131415>',
            });
        });
        it('should use default emojis when some emojis are missing', () => {
            emojisInCache.delete('HB');
            emojisInCache.delete('roll');
            gatherEmojis(client_local);

            expect(emojis).toEqual({
                '3png': '<:Ct:123>',
                '2png': ':two:',
                '1png': '<:Rm:789>',
                ph: '<:PH:101112>',
                roll: '🎲',
            });
        });
    });
});
