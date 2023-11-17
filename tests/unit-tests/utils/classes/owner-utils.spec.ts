/* eslint-disable @typescript-eslint/unbound-method */
import { getConfig } from '../../../../src/config/config.js';
import {
  getDeveloperMentions,
  getDevelopers,
  isDeveloper,
} from '../../../../src/utils/functions/owner-utils.js';

const config = getConfig();
describe('Discord Utils', () => {
  const configCopy = config.getProperties();
  beforeEach(() => {
    config.load(configCopy);
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Developer/Owner Utils', () => {
    beforeEach(() => {
      config.set('botOwnerID', 'BOT_OWNER_ID');
    });
    describe('getDevelopers', () => {
      test('should return an array of developers', () => {
        const devs = getDevelopers();
        expect(devs).toHaveLength(1);
        expect(devs).toContain('BOT_OWNER_ID');
        config.set('botOwnerID', '123');
        expect(getDevelopers()).toHaveLength(1);
      });
    });
    describe('getDeveloperMentions', () => {
      test('should return a string of mentions', () => {
        const mentions = getDeveloperMentions();
        expect(mentions).toBe('<@BOT_OWNER_ID>');
        config.set('botOwnerID', '123');
        expect(getDeveloperMentions()).toBe('<@123>');
      });
    });
  });
  describe('isDev', () => {
    test('should return true if the user is a developer', () => {
      config.set('botOwnerID', '123');
      expect(isDeveloper('123')).toBe(true);
    });
    test('should return false if the user is not a developer', () => {
      config.set('botOwnerID', '123');
      expect(isDeveloper('456')).toBe(false);
    });
  });
});
