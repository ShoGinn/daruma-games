import { userMention } from 'discord.js';

import { getConfig } from '../../config/config.js';

/**
 * Get the list of devs
 *
 * @returns {*}  {Array<string>}
 */
export function getDevelopers(): string[] {
  const botOwnerId = getConfig().get('botOwnerID');
  return [...new Set([botOwnerId])];
}

export function getDeveloperMentions(): string {
  const botOwnerIds = getDevelopers();
  // join the ids with a discord mention format
  return botOwnerIds.map((id) => userMention(id)).join(' ');
}
/**
 * Check if the user is a dev
 *
 * @param {string} id
 * @returns {*}  {boolean}
 */
export function isDeveloper(id: string): boolean {
  return getDevelopers().includes(id);
}
