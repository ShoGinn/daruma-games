import 'reflect-metadata';

import { Client, DIService, tsyringeDependencyRegistryEngine } from 'discordx';
import { container } from 'tsyringe';

import { Mock } from './Mock.js';
async function bootstrap(): Promise<void> {
    DIService.engine = tsyringeDependencyRegistryEngine.setInjector(container);
    const client = container.resolve(Mock).getClient();
    if (!container.isRegistered(Client)) {
        container.registerInstance(Client, client);
    }
    // orm = await setupDb();
}

bootstrap();
