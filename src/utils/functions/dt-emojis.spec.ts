import { Collection, GuildEmoji } from 'discord.js';

import { Client } from 'discordx';

import { container } from 'tsyringe';

import { emojiConvert, GameEmojis } from './dt-emojis.js';

describe('Emojis gathering with mocks', () => {
  const { emojis } = GameEmojis;
  const emojisInCache = new Collection<string, GuildEmoji>();
  let clientLocal: Client;
  const defaultEmojis = new Map<string, string>(emojis);

  // sourcery skip: avoid-function-declarations-in-blocks
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
      test('should return the correct placeholder emoji for undefined', () => {
        emojis.delete('PH');
        const result = GameEmojis.getGameEmoji();
        expect(result).toEqual(defaultEmojis.get('ph'));
      });
      test('should return the correct placeholder emoji for empty string', () => {
        emojis.delete('PH');
        const result = GameEmojis.getGameEmoji('');
        expect(result).toEqual(defaultEmojis.get('ph'));
      });
      test('should return the correct placeholder emoji for nonsense string', () => {
        emojis.delete('PH');
        const result = GameEmojis.getGameEmoji('nonsense');
        expect(result).toEqual(defaultEmojis.get('ph'));
      });

      test('should return the correct placeholder emoji', () => {
        emojis.delete('PH');
        const result = GameEmojis.getGameEmoji('PH');
        expect(result).toEqual(defaultEmojis.get('ph'));
      });
      test('should return the correct placeholder for roll', () => {
        emojis.delete('Roll');
        const result = GameEmojis.getGameEmoji('Roll');
        expect(result).toEqual(defaultEmojis.get('roll'));
      });
    });
    describe('no guild cache results using default emojis', () => {
      test('should return the correct emoji for the damage', () => {
        const damage = 1;
        const expectedResult = ':one:';
        const result = GameEmojis.getGameEmoji(damage);
        expect(result).toEqual(expectedResult);
      });
      test('should return the correct emoji for the damage 2', () => {
        const damage = 2;
        const expectedResult = ':two:';
        const result = GameEmojis.getGameEmoji(damage);
        expect(result).toEqual(expectedResult);
      });
      test('should return the correct emoji for the damage 3', () => {
        const damage = 3;
        const expectedResult = ':three:';
        const result = GameEmojis.getGameEmoji(damage);
        expect(result).toEqual(expectedResult);
      });
      test('should return the correct emoji for the damage 4', () => {
        const damage = 4;
        const expectedResult = '';
        const result = GameEmojis.getGameEmoji(damage);
        expect(result).toEqual(expectedResult);
      });
    });
    describe('guild cache results using custom emojis', () => {
      beforeEach(() => {
        setCache();
        clientLocal = {
          emojis: {
            cache: emojisInCache,
          },
        } as unknown as Client;
        GameEmojis.gatherEmojis(clientLocal);
      });
      test('should return the correct emoji for the damage', () => {
        const damage = 1;
        const expectedResult = '<:Rm:789>';

        const result = GameEmojis.getGameEmoji(damage);
        expect(result).toEqual(expectedResult);
      });
      test('should return the correct emoji for the damage 2', () => {
        const damage = 2;
        const expectedResult = '<:HB:456>';
        const result = GameEmojis.getGameEmoji(damage);
        expect(result).toEqual(expectedResult);
      });
      test('should return the correct emoji for the damage 3', () => {
        const damage = 3;
        const expectedResult = '<:Ct:123>';
        const result = GameEmojis.getGameEmoji(damage);
        expect(result).toEqual(expectedResult);
      });
      test('should return the correct emoji for the damage 4', () => {
        const damage = 4;
        const expectedResult = '';
        const result = GameEmojis.getGameEmoji(damage);
        expect(result).toEqual(expectedResult);
      });
      test('should return the correct placeholder emoji', () => {
        const expectedResult = '<:PH:101112>';
        const result = GameEmojis.getGameEmoji('PH');
        expect(result).toEqual(expectedResult);
      });
      test('should return the correct roll emoji', () => {
        const expectedResult = '<:roll:131415>';
        const result = GameEmojis.getGameEmoji('Roll');
        expect(result).toEqual(expectedResult);
      });
    });
  });
  describe('gatherEmojis', () => {
    const client = container.resolve(Client);
    // Test if the default emojis are used when the required emojis are not available in cache
    test('Default emojis are used when required emojis are not available in cache', () => {
      GameEmojis.gatherEmojis(client);
      expect(emojis.get('3')).toBe(':three:');
      expect(emojis.get('2')).toBe(':two:');
      expect(emojis.get('1')).toBe(':one:');
      expect(emojis.get('ph')).toBe(':red_circle:');
      expect(emojis.get('roll')).toBe(':game_die:');
    });
    describe('mock the emojis before running the tests', () => {
      beforeEach(() => {
        setCache();
        clientLocal = {
          emojis: {
            cache: emojisInCache,
          },
        } as unknown as Client;
      });
      test('should use default emojis when some emojis are missing', () => {
        jest.resetModules();
        emojisInCache.delete('HB');
        emojisInCache.delete('roll');
        GameEmojis.gatherEmojis(clientLocal);
        expect(emojis.get('3')).toBe('<:Ct:123>');
        expect(emojis.get('2')).toBe(':two:');
        expect(emojis.get('1')).toBe('<:Rm:789>');
        expect(emojis.get('ph')).toBe('<:PH:101112>');
        expect(emojis.get('roll')).toBe(':game_die:');
      });

      test('Required emojis are used when available in cache', () => {
        GameEmojis.gatherEmojis(clientLocal);
        expect(emojis.get('3')).toBe('<:Ct:123>');
        expect(emojis.get('2')).toBe('<:HB:456>');
        expect(emojis.get('1')).toBe('<:Rm:789>');
        expect(emojis.get('ph')).toBe('<:PH:101112>');
        expect(emojis.get('roll')).toBe('<:roll:131415>');
      });
    });
  });
});
describe('Emoji Convert', () => {
  test('should convert a string to emoji format', () => {
    const content = 'hello';
    const expectedResult =
      ':regional_indicator_h::regional_indicator_e::regional_indicator_l::regional_indicator_l::regional_indicator_o:';

    const result = emojiConvert(content);
    expect(result).toEqual(expectedResult);
  });

  test('should return the same string if it contains non-letter characters', () => {
    const content = 'hello, world!';
    const expectedResult =
      ':regional_indicator_h::regional_indicator_e::regional_indicator_l::regional_indicator_l::regional_indicator_o:,   :regional_indicator_w::regional_indicator_o::regional_indicator_r::regional_indicator_l::regional_indicator_d::grey_exclamation:';

    const result = emojiConvert(content);
    expect(result).toEqual(expectedResult);
  });

  test('should ignore uppercase or lowercase', () => {
    const content = 'HelLo, World!';
    const expectedResult =
      ':regional_indicator_h::regional_indicator_e::regional_indicator_l::regional_indicator_l::regional_indicator_o:,   :regional_indicator_w::regional_indicator_o::regional_indicator_r::regional_indicator_l::regional_indicator_d::grey_exclamation:';

    const result = emojiConvert(content);
    expect(result).toEqual(expectedResult);
  });

  test('should return the same string containing numbers and special characters', () => {
    const content = 'Hello, 123456!@#$%^*()';
    const expectedResult =
      ':regional_indicator_h::regional_indicator_e::regional_indicator_l::regional_indicator_l::regional_indicator_o:,   :one::two::three::four::five::six::grey_exclamation:@:hash::heavy_dollar_sign:%^:asterisk:()';

    const result = emojiConvert(content);
    expect(result).toEqual(expectedResult);
  });
});
