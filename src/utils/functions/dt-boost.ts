import { MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

import { Data } from '../../entities/data.entity.js';

export async function getTemporaryPayoutModifier(): Promise<
	number | undefined
> {
	const database = container.resolve(MikroORM).em.fork();
	const dataRepository = database.getRepository(Data);
	const karmaBoostStartString = await dataRepository.get('karmaBoostStart');
	const karmaBoostExpiryString = await dataRepository.get('karmaBoostExpiry');
	const karmaBoostModifier = await dataRepository.get('karmaBoostModifier');
	const timeNow = new Date(Date.now());
	const karmaBoostStart = new Date(karmaBoostStartString);
	const karmaBoostExpiry = new Date(karmaBoostExpiryString);
	if (
		karmaBoostStart &&
		karmaBoostExpiry &&
		karmaBoostStart < timeNow &&
		karmaBoostExpiry > timeNow
	) {
		return karmaBoostModifier;
	}
	return;
}
export async function setTemporaryPayoutModifier(
	modifier: number,
	start: Date,
	expiry: Date,
): Promise<void> {
	const database = container.resolve(MikroORM).em.fork();
	const dataRepository = database.getRepository(Data);
	await dataRepository.set('karmaBoostModifier', modifier);
	await dataRepository.set('karmaBoostStart', start);
	await dataRepository.set('karmaBoostExpiry', expiry);
	return;
}
