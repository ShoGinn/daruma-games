export type DiscordId = string & { readonly brand: unique symbol };
export type WalletAddress = string & { readonly brand?: unique symbol };
export type SenderWalletAddress = WalletAddress & { readonly senderBrand?: unique symbol };
export type ReceiverWalletAddress = WalletAddress & { readonly receiverBrand?: unique symbol };
/*
These are locally generated types
*/
