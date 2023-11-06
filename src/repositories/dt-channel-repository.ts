import { Collection, Guild } from 'discord.js';

import { darumaTrainingChannel, IDarumaTrainingChannel } from '../entities/dt-channel.mongo.js';
import { GameTypes } from '../enums/daruma-training.js';

export async function getAllChannels(): Promise<IDarumaTrainingChannel[]> {
  return await darumaTrainingChannel.find().exec();
}

export async function getAllChannelsInGuild(guildId: string): Promise<IDarumaTrainingChannel[]> {
  return await darumaTrainingChannel.find({ guild: guildId }).exec();
}
export async function getAllChannelsInDB(
  guilds: Collection<string, Guild>,
): Promise<IDarumaTrainingChannel[]> {
  const channels = await Promise.all(
    [...guilds.values()].map((guild) => getAllChannelsInGuild(guild.id)),
  );
  return channels.flat();
}
export async function getChannel(channelId: string): Promise<IDarumaTrainingChannel | null> {
  return await darumaTrainingChannel.findById(channelId);
}

export async function addChannelToDatabase(
  channelId: string,
  gameType: GameTypes,
  guildId: string,
): Promise<IDarumaTrainingChannel> {
  const existingChannel = await darumaTrainingChannel.findById(channelId);
  if (existingChannel) {
    return existingChannel;
  }

  const newChannel = new darumaTrainingChannel({ _id: channelId, gameType, guild: guildId });
  await newChannel.save();
  return newChannel;
}

export async function removeChannelFromDatabase(channelId: string): Promise<boolean> {
  const existingChannel = await darumaTrainingChannel.findById(channelId);
  if (!existingChannel) {
    return false;
  }

  await darumaTrainingChannel.deleteOne({ _id: channelId });
  return true;
}
