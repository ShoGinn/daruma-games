// services/DevelopmentCommandService.ts
import { GuildChannel, inlineCode, Message, TextBasedChannel } from 'discord.js';

import { injectable } from 'tsyringe';

import { GameTypes } from '../enums/daruma-training.js';
import { DarumaTrainingManager } from '../manager/daruma-training.js';
import { AlgoNFTAssetService } from '../services/algo-nft-assets.js';
import { BoostService } from '../services/boost-payout.js';
import { DarumaTrainingChannelService } from '../services/dt-channel.js';
import { GameAssets } from '../services/game-assets.js';
import { RewardsService } from '../services/rewards.js';
import { ChannelUtils } from '../utils/classes/channel-utils.js';
import { ObjectUtil } from '../utils/classes/object-utils.js';

@injectable()
export class DevelopmentCommandService {
  constructor(
    private dtChannelService: DarumaTrainingChannelService,
    private waitingRoom: DarumaTrainingManager,
    private algoNftService: AlgoNFTAssetService,
    private rewardsService: RewardsService,
    private boostService: BoostService,
    private gameAssets: GameAssets,
  ) {}
  /**
   * Adds a channel to the database and joins the channel
   *
   * @param {GuildChannel} channel
   * @param {GameTypes} channelType
   * @returns {*}  {Promise<boolean>}
   * @memberof DevelopmentCommandService
   */
  async addAndJoinChannel(channel: GuildChannel, channelType: GameTypes): Promise<boolean> {
    await this.dtChannelService.upsertChannel(channel.id, channelType, channel.guildId);
    return await this.joinChannel(channel);
  }
  /**
   * Joins a channel to the waiting room
   *
   * @param {(GuildChannel | TextBasedChannel)} channel
   * @returns {*}  {Promise<boolean>}
   * @memberof DevelopmentCommandService
   */
  async joinChannel(channel: GuildChannel | TextBasedChannel): Promise<boolean> {
    return await this.waitingRoom.startWaitingRoomForChannel(channel);
  }
  /**
   * Deletes a channel from the database and leaves the channel
   *
   * @param {(GuildChannel | TextBasedChannel)} channel
   * @returns {*}  {Promise<boolean>}
   * @memberof DevelopmentCommandService
   */
  async deleteChannel(channel: GuildChannel | TextBasedChannel): Promise<boolean> {
    return await this.dtChannelService.deleteChannelById(channel.id);
  }
  /**
   * Deletes the waiting room message from the channel
   *
   * @param {TextBasedChannel} channel
   * @returns {*}  {(Promise<Message<boolean> | undefined>)}
   * @memberof DevelopmentCommandService
   */
  async deleteWaitingRoomMessage(channel: TextBasedChannel): Promise<Message | undefined> {
    const channelMessage = await ChannelUtils.getLatestEmbedMessageInChannelByTitle(
      channel,
      'Waiting Room',
    );
    await ChannelUtils.deleteMessage(channelMessage);
    return channelMessage;
  }
  // TODO: Add more commands here
  async syncUserAssets(): Promise<void> {
    await this.algoNftService.updateOwnerWalletsOnCreatorAssets();
  }
  /**
   * Clears the asset cooldowns for all users
   *
   * @returns {*}  {Promise<void>}
   * @memberof DevelopmentCommandService
   */
  async clearAssetCoolDownsForAllUsers(): Promise<void> {
    await this.algoNftService.clearAssetCoolDownsForAllUsers();
  }
  /**
   * Force claim rewards for all users
   *
   * @param {number} threshold
   * @returns {*}  {Promise<void>}
   * @memberof DevelopmentCommandService
   */
  async forceClaimOfRewardsForAllUsers(threshold: number): Promise<void> {
    const walletsWithUnclaimedAssets = await this.rewardsService.fetchWalletsWithUnclaimedAssets(
      threshold,
      this.gameAssets.karmaAsset,
    );
    await this.rewardsService.batchTransActionProcessor(
      walletsWithUnclaimedAssets,
      this.gameAssets.karmaAsset,
    );
  }
  /**
   * Set the karma modifier for a specific date range
   *
   * @param {string} start_date
   * @param {string} stop_date
   * @param {number} modifier
   * @returns {*}  {Promise<string>}
   * @memberof DevelopmentCommandService
   */
  async setKarmaModifier(start_date: string, stop_date: string, modifier: number): Promise<string> {
    // Check if the dates are valid
    const startDate = ObjectUtil.parseUTCDate(start_date);
    const stopDate = ObjectUtil.parseUTCDate(stop_date);
    await this.boostService.setTemporaryPayoutModifier(
      modifier,
      startDate.toDate(),
      stopDate.toDate(),
    );
    return `Setting the modifier for ${inlineCode(startDate.toString())} to ${inlineCode(
      stopDate.toString(),
    )} with modifier ${inlineCode(modifier.toString() + 'x')}`;
  }
}
