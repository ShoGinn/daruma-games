import { Collection, GuildMember } from 'discord.js';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import {
    getWebhooks,
    karmaSendWebHook,
    karmaTipWebHook,
    txnWebHook,
    webHookQueue,
    WebhookType,
} from '../../src/utils/functions/web-hooks.js';
describe('webhook', () => {
    let client: Client;
    let member: GuildMember | undefined;
    let members: Collection<string, GuildMember> | undefined;
    beforeAll(() => {
        client = container.resolve(Client);
        // fetch members from the mock guild
        const guild = client.guilds.cache.first();
        members = guild?.members.cache;
        // set a member from the mock guild
        member = members?.first();
    });
    it('should get the webhooks', () => {
        getWebhooks(client);
    });
    it('should create a transaction webhook message', () => {
        if (!member) {
            throw new Error('Member not found');
        }
        txnWebHook(member, {}, WebhookType.CLAIM);
        expect(webHookQueue[0]).toHaveProperty('embeds');
    });

    it('should create a karma tip webhook message', () => {
        if (!member) {
            throw new Error('Member not found');
        }
        karmaTipWebHook(member, member, {});
        expect(webHookQueue[0]).toHaveProperty('embeds');
    });
    it('should create a karma send webhook message', () => {
        if (!member) {
            throw new Error('Member not found');
        }
        karmaSendWebHook(member, member, {});
        expect(webHookQueue[0]).toHaveProperty('embeds');
    });
});
