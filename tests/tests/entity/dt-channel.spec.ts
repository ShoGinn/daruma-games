import { EntityManager, MikroORM } from '@mikro-orm/core';
import { GuildChannel } from 'discord.js';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import {
    DarumaTrainingChannel,
    DarumaTrainingChannelRepository,
} from '../../../src/entities/dt-channel.entity.js';
import { GameTypes } from '../../../src/enums/daruma-training.js';
import { initORM } from '../../utils/bootstrap.js';
import { addRandomGuild } from '../../utils/test-funcs.js';

describe('asset tests that require db', () => {
    let orm: MikroORM;
    let database: EntityManager;
    let dtChannelRepo: DarumaTrainingChannelRepository;
    let client: Client;
    let channel: GuildChannel;
    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    beforeEach(async () => {
        await orm.schema.clearDatabase();
        database = orm.em.fork();
        dtChannelRepo = database.getRepository(DarumaTrainingChannel);
        client = container.resolve(Client);
        channel = client.channels.cache.first() as GuildChannel;
    });
    // sourcery skip: avoid-function-declarations-in-blocks
    function refreshRepo(): void {
        database = orm.em.fork();
        dtChannelRepo = database.getRepository(DarumaTrainingChannel);
    }
    it('Get all channels -- Expect none', async () => {
        const channels = await dtChannelRepo.getAllChannels();
        expect(channels).toHaveLength(0);
    });
    it('Get all channels in guild -- Expect none', async () => {
        const guild = await addRandomGuild(database);
        const channels = await dtChannelRepo.getAllChannelsInGuild(guild.id);
        expect(channels).toHaveLength(0);
    });
    it('Add a channel then Get all channels in guild -- Expect one', async () => {
        const guild = await addRandomGuild(database, channel.guildId);
        const addedChannel = await dtChannelRepo.addChannel(channel, GameTypes.OneVsOne);
        const channels = await dtChannelRepo.getAllChannelsInGuild(guild.id);
        const singleChannel = await dtChannelRepo.getChannel(channel);
        expect(channels).toHaveLength(1);
        expect(channels[0]).toEqual(addedChannel);
        expect(singleChannel).toEqual(addedChannel);
    });
    it('Add a channel then then remove it -- Expect None', async () => {
        expect.assertions(4);
        const guild = await addRandomGuild(database, channel.guildId);
        await dtChannelRepo.addChannel(channel, GameTypes.OneVsOne);
        const removedChannel = await dtChannelRepo.removeChannel(channel);
        expect(removedChannel).toBeTruthy();
        const channels = await dtChannelRepo.getAllChannelsInGuild(guild.id);
        expect(channels).toHaveLength(0);
        const removedChannelAgain = await dtChannelRepo.removeChannel(channel);
        expect(removedChannelAgain).toBeFalsy();
        try {
            await dtChannelRepo.getChannel(channel);
        } catch (error) {
            expect(error).toBeTruthy();
        }
    });
    it('Add a channel then try and add it again -- Expect channel to be returned', async () => {
        expect.assertions(1);
        await addRandomGuild(database, channel.guildId);
        const origChannel = await dtChannelRepo.addChannel(channel, GameTypes.OneVsOne);
        let newChannel;
        try {
            newChannel = await dtChannelRepo.addChannel(channel, GameTypes.OneVsOne);
        } catch (error) {
            expect(error).toBeTruthy();
        }
        expect(origChannel).toEqual(newChannel);
    });

    describe('getChannelMessageId function', () => {
        it('expect undefined when no channel', async () => {
            const noMessage = await dtChannelRepo.getChannelMessageId(channel.id);
            expect(noMessage).toEqual('');
            const noChannelMessage = await dtChannelRepo.getChannelMessageId();
            expect(noChannelMessage).toEqual('');
        });
        it('expect message id when channel', async () => {
            await addRandomGuild(database, channel.guildId);
            const newChannel = await dtChannelRepo.addChannel(channel, GameTypes.OneVsOne);
            const channelMessage = await dtChannelRepo.getChannelMessageId(channel.id);
            expect(channelMessage).toEqual(newChannel.messageId);
        });
    });
    it('Add a channel then update the message id', async () => {
        await addRandomGuild(database, channel.guildId);
        const addedChannel = await dtChannelRepo.addChannel(channel, GameTypes.OneVsOne);
        addedChannel.messageId = 'new-message-id';
        await database.persistAndFlush(addedChannel);
        refreshRepo();
        const singleChannel = await dtChannelRepo.getChannel(channel);
        expect(singleChannel.messageId).toEqual('new-message-id');
        const updatedId = await dtChannelRepo.updateMessageId(channel.id, 'newer-message-id');
        expect(updatedId.messageId).toEqual('newer-message-id');
        const channelMessageID = await dtChannelRepo.getChannelMessageId(channel.id);
        expect(channelMessageID).toEqual('newer-message-id');
    });
    it('check all the ways getGuild works', async () => {
        expect.assertions(3);
        const guild = await addRandomGuild(database, channel.guildId);
        await dtChannelRepo.addChannel(channel, GameTypes.OneVsOne);
        const guildFromChannel = await dtChannelRepo.getGuild(channel);
        expect(guildFromChannel.id).toEqual(guild.id);
        const guildFromChannelId = await dtChannelRepo.getGuild(guild.id);
        expect(guildFromChannelId.id).toEqual(guild.id);
        try {
            await dtChannelRepo.getGuild();
        } catch (error) {
            expect(error).toBeTruthy();
        }
    });
});
