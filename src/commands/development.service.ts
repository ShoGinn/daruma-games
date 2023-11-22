// services/DevelopmentCommandService.ts
import { GuildChannel, inlineCode, Message, TextBasedChannel } from 'discord.js';

import dayjs from 'dayjs';
import { injectable } from 'tsyringe';

import { GameTypes } from '../enums/daruma-training.js';
import { DarumaTrainingManager } from '../manager/daruma-training.js';
import { AlgoNFTAssetService } from '../services/algo-nft-assets.js';
import { Algorand } from '../services/algorand.js';
import { BoostService } from '../services/boost-payout.js';
import { DarumaTrainingChannelService } from '../services/dt-channel.js';
import { GameAssets } from '../services/game-assets.js';
import { RewardsService } from '../services/rewards.js';
import { ChannelUtils } from '../utils/classes/channel-utils.js';

@injectable()
export class DevelopmentCommandService {
  constructor(
    private dtChannelService: DarumaTrainingChannelService,
    private waitingRoom: DarumaTrainingManager,
    private algoNftService: AlgoNFTAssetService,
    private rewardsService: RewardsService,
    private boostService: BoostService,
    private gameAssets: GameAssets,
    private algorand: Algorand,
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
  async deleteWaitingRoomMessage(channel: TextBasedChannel): Promise<Message<boolean> | undefined> {
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
    await this.algorand.unclaimedAutomated(walletsWithUnclaimedAssets, this.gameAssets.karmaAsset);
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
    const startDate = dayjs(start_date);
    const stopDate = dayjs(stop_date);
    // Check if the dates are valid
    if (!startDate.isValid() || !stopDate.isValid()) {
      throw new Error(
        `Invalid date format. ISO 8601 is required\n\n
        Server Timezone converted to UTC is used for the date\n
        Examples:\n
        ${inlineCode(dayjs().toISOString())}
        ${inlineCode(dayjs().format('YYYY-MM-DD HH:MM[Z]'))}
        \n\n A space is allowed between the date and time instead of the T`,
      );
    }
    await this.boostService.setTemporaryPayoutModifier(
      modifier,
      startDate.toDate(),
      stopDate.toDate(),
    );
    return `Setting the modifier for ${inlineCode(startDate.toString())} to ${inlineCode(
      stopDate.toString(),
    )} with modifier ${inlineCode(modifier + 'x')}`;
  }
}