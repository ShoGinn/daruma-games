import 'reflect-metadata';

import { Client, DIService, tsyringeDependencyRegistryEngine } from 'discordx';

import jestFetchMock from 'jest-fetch-mock';
import { container } from 'tsyringe';

import { Mock } from '../mocks/mock-discord.js';

jestFetchMock.enableMocks();

function bootstrap(): void {
  DIService.engine = tsyringeDependencyRegistryEngine.setInjector(container);
  const client = container.resolve(Mock).getClient();
  if (!container.isRegistered(Client)) {
    container.registerInstance(Client, client);
  }
}
function setFakeMnemonic(): void {
  const mnemonic =
    'liberty type bullet vintage fitness calm allow stage parent chimney burden nurse stuff napkin phone banner august item napkin mean ahead total airport abandon replace';
  process.env['CLAWBACK_TOKEN_MNEMONIC'] = mnemonic;
}
setFakeMnemonic();
bootstrap();
jest.restoreAllMocks();
