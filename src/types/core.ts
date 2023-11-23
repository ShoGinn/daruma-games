export type DiscordId = string & { readonly brand: unique symbol };
export type WalletAddress = string & { readonly brand?: unique symbol };
export type SenderWalletAddress = WalletAddress & { readonly senderBrand?: unique symbol };
export type ReceiverWalletAddress = WalletAddress & { readonly receiverBrand?: unique symbol };

export interface RewardTokenWallet<
  T extends WalletAddress | ReceiverWalletAddress | SenderWalletAddress,
> {
  convertedTokens: number;
  discordUserId: DiscordId;
  walletAddress: T;
  asaId: number;
  temporaryTokens: number;
}
