import 'reflect-metadata';

import { MetadataStorage } from '@mikro-orm/core';
import { Client, DIService, tsyringeDependencyRegistryEngine } from 'discordx';
import { container } from 'tsyringe';

import { Mock } from '../mocks/mock-discord.js';
function bootstrap(): void {
    DIService.engine = tsyringeDependencyRegistryEngine.setInjector(container);
    const client = container.resolve(Mock).getClient();
    if (!container.isRegistered(Client)) {
        container.registerInstance(Client, client);
    }
}
bootstrap();
MetadataStorage.clear();
jest.restoreAllMocks();
