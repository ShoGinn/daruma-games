import { GuildMember } from 'discord.js';

import { SendTransactionResult } from '@algorandfoundation/algokit-utils/types/transaction';

export type WebhookFunction = (
  claimStatus: SendTransactionResult,
  receiver?: GuildMember,
  sender?: GuildMember,
) => void;

enum EmbedColor {
  CLAIM = 0xff_d7_00,
  TIP = 0x00_00_ff,
  ARTIFACT = 0x00_ff_00,
  ENLIGHTENMENT = 0xff_00_ff,
  ELIXIR = 0x00_80_00,
  SENT = 0x00_00_00,
}
export enum WebhookType {
  CLAIM = 'Claimed',
  TIP = 'Tipped',
  ARTIFACT = 'Artifact Claimed',
  ENLIGHTENMENT = 'Enlightenment Claimed',
  ELIXIR = 'Elixir Claimed',
  SENT = 'Monk Send',
}
export const embedColorByWebhookType = {
  [WebhookType.CLAIM]: EmbedColor.CLAIM,
  [WebhookType.TIP]: EmbedColor.TIP,
  [WebhookType.ARTIFACT]: EmbedColor.ARTIFACT,
  [WebhookType.ENLIGHTENMENT]: EmbedColor.ENLIGHTENMENT,
  [WebhookType.ELIXIR]: EmbedColor.ELIXIR,
  [WebhookType.SENT]: EmbedColor.SENT,
};
