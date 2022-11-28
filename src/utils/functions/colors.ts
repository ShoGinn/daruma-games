import { colorsConfig } from '@config'
import { ColorResolvable } from 'discord.js'

/**
 * Get a color from the config
 * @param colorResolver The color to resolve
 * @returns
 */
export const getColor = (colorResolver: keyof typeof colorsConfig) => {
  return colorsConfig[colorResolver] as ColorResolvable
}
