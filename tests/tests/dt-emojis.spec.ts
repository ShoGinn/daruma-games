import { describe, expect, it } from '@jest/globals';
import { Collection, GuildEmoji } from 'discord.js';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import {
    emojiConvert,
    emojis,
    gatherEmojis,
    getGameEmoji,
} from '../../src/utils/functions/dt-emojis.js';

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
describe('Emojis gathering with mocks', () => {
    const emojisInCache = new Collection<string, GuildEmoji>();
    let client_local: Client;
    const defaultEmojis = new Map<string, string>(emojis);

    function setCache(): void {
        emojisInCache.set('Ct', {
            id: '123',
            name: 'Ct',
            toString: () => '<:Ct:123>',
        } as GuildEmoji);
        emojisInCache.set('HB', {
            id: '456',
            name: 'HB',
            toString: () => '<:HB:456>',
        } as GuildEmoji);
        emojisInCache.set('Rm', {
            id: '789',
            name: 'Rm',
            toString: () => '<:Rm:789>',
        } as GuildEmoji);
        emojisInCache.set('PH', {
            id: '101112',
            name: 'PH',
            toString: () => '<:PH:101112>',
        } as GuildEmoji);
        emojisInCache.set('roll', {
            id: '131415',
            name: 'roll',
            toString: () => '<:roll:131415>',
        } as GuildEmoji);
    }
    beforeEach(() => {
        for (const [key, value] of defaultEmojis.entries()) {
            emojis.set(key, value);
        }
    });
    afterEach(() => {
        emojis.clear();
    });
    describe('getGameEmoji', () => {
        describe('check the catch for missing emojis', () => {
            it('should return the correct placeholder emoji for undefined', () => {
                //@ts-expect-error - testing the catch
                emojis.set('ph', null);
                const result = getGameEmoji();
                expect(result).toEqual(defaultEmojis.get('ph'));
            });

            it('should return the correct placeholder emoji', () => {
                //@ts-expect-error - testing the catch
                emojis.set('ph', null);
                const result = getGameEmoji('ph');
                expect(result).toEqual(defaultEmojis.get('ph'));
            });
            it('should return the correct placeholder for roll', () => {
                //@ts-expect-error - testing the catch
                emojis.set('roll', null);
                const result = getGameEmoji('roll');
                expect(result).toEqual(defaultEmojis.get('roll'));
            });
        });
        describe('no guild cache results using default emojis', () => {
            it('should return the correct emoji for the damage', () => {
                const damage = 1;
                const expectedResult = ':one:';
                const result = getGameEmoji(damage);
                expect(result).toEqual(expectedResult);
            });
            it('should return the correct emoji for the damage', () => {
                const damage = 2;
                const expectedResult = ':two:';
                const result = getGameEmoji(damage);
                expect(result).toEqual(expectedResult);
            });
            it('should return the correct emoji for the damage', () => {
                const damage = 3;
                const expectedResult = ':three:';
                const result = getGameEmoji(damage);
                expect(result).toEqual(expectedResult);
            });
            it('should return the correct emoji for the damage', () => {
                const damage = 4;
                const expectedResult = ':four:';
                const result = getGameEmoji(damage);
                expect(result).toEqual(expectedResult);
            });
        });
        describe('guild cache results using custom emojis', () => {
            beforeEach(() => {
                setCache();
                client_local = {
                    emojis: {
                        cache: emojisInCache,
                    },
                } as unknown as Client;
                gatherEmojis(client_local);
            });
            it('should return the correct emoji for the damage', () => {
                const damage = 1;
                const expectedResult = '<:Rm:789>';

                const result = getGameEmoji(damage);
                expect(result).toEqual(expectedResult);
            });
            it('should return the correct emoji for the damage', () => {
                const damage = 2;
                const expectedResult = '<:HB:456>';
                const result = getGameEmoji(damage);
                expect(result).toEqual(expectedResult);
            });
            it('should return the correct emoji for the damage', () => {
                const damage = 3;
                const expectedResult = '<:Ct:123>';
                const result = getGameEmoji(damage);
                expect(result).toEqual(expectedResult);
            });
            it('should return the correct emoji for the damage', () => {
                const damage = 4;
                const expectedResult = ':four:';
                const result = getGameEmoji(damage);
                expect(result).toEqual(expectedResult);
            });
            it('should return the correct placeholder emoji', () => {
                const expectedResult = '<:PH:101112>';
                const result = getGameEmoji('ph');
                expect(result).toEqual(expectedResult);
            });
            it('should return the correct roll emoji', () => {
                const expectedResult = '<:roll:131415>';
                const result = getGameEmoji('roll');
                expect(result).toEqual(expectedResult);
            });
        });
    });
    describe('gatherEmojis', () => {
        const client = container.resolve(Client);
        // Test if the default emojis are used when the required emojis are not available in cache
        it('Default emojis are used when required emojis are not available in cache', () => {
            gatherEmojis(client);
            expect(emojis.get('3png')).toBe(':three:');
            expect(emojis.get('2png')).toBe(':two:');
            expect(emojis.get('1png')).toBe(':one:');
            expect(emojis.get('ph')).toBe('🔴');
            expect(emojis.get('roll')).toBe('🎲');
        });
        describe('mock the emojis before running the tests', () => {
            beforeEach(() => {
                setCache();
                client_local = {
                    emojis: {
                        cache: emojisInCache,
                    },
                } as unknown as Client;
            });
            it('should use default emojis when some emojis are missing', () => {
                jest.resetModules();
                emojisInCache.delete('HB');
                emojisInCache.delete('roll');
                gatherEmojis(client_local);
                expect(emojis.get('3png')).toBe('<:Ct:123>');
                expect(emojis.get('2png')).toBe(':two:');
                expect(emojis.get('1png')).toBe('<:Rm:789>');
                expect(emojis.get('ph')).toBe('<:PH:101112>');
                expect(emojis.get('roll')).toBe('🎲');
            });

            it('Required emojis are used when available in cache', () => {
                gatherEmojis(client_local);
                expect(emojis.get('3png')).toBe('<:Ct:123>');
                expect(emojis.get('2png')).toBe('<:HB:456>');
                expect(emojis.get('1png')).toBe('<:Rm:789>');
                expect(emojis.get('ph')).toBe('<:PH:101112>');
                expect(emojis.get('roll')).toBe('<:roll:131415>');
            });
        });
    });
});
