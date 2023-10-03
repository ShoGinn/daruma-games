import { EntityManager, MikroORM } from '@mikro-orm/core';

import { User, UserRepository } from '../../../../src/entities/user.entity.js';
import { initORM } from '../../../utils/bootstrap.js';
import { createRandomUser } from '../../../utils/test-funcs.js';

describe('Simple User tests that require db', () => {
	let orm: MikroORM;
	let database: EntityManager;
	let userRepo: UserRepository;

	beforeAll(async () => {
		orm = await initORM();
	});
	afterAll(async () => {
		await orm.close(true);
	});
	beforeEach(async () => {
		await orm.schema.clearDatabase();
		database = orm.em.fork();
		userRepo = database.getRepository(User);
	});
	describe('Pre-token function tests', () => {
		let user: User;
		beforeEach(async () => {
			user = await createRandomUser(database);
		});
		describe('User Artifacts', () => {
			it('should increase the user artifact count by 1', async () => {
				const artifactIncrement = await userRepo.updateUserPreToken(user.id, 1);
				const userAfter = await userRepo.getUserById(user.id);
				expect(userAfter.preToken).toBe(1);
				expect(artifactIncrement).toBe('1');
			});
			it('should increase the user artifact count by 1000', async () => {
				const artifactIncrement = await userRepo.updateUserPreToken(
					user.id,
					1000,
				);
				const userAfter = await userRepo.getUserById(user.id);
				expect(userAfter.preToken).toBe(1000);
				expect(artifactIncrement).toBe('1,000');
			});
			it('should decrease the user artifact count by 1', async () => {
				await userRepo.updateUserPreToken(user.id, 1000);
				const testAmount = 5;
				const artifactIncrement = await userRepo.updateUserPreToken(
					user.id,
					-testAmount,
				);
				const userAfter = await userRepo.getUserById(user.id);
				expect(userAfter.preToken).toBe(995);
				expect(artifactIncrement).toBe('995');
			});
			it('should throw an error because you cannot have less than 0 artifacts', async () => {
				try {
					await userRepo.updateUserPreToken(user.id, -1);
				} catch (error) {
					expect(error).toHaveProperty(
						'message',
						'Not enough artifacts. You have 0 artifacts.',
					);
				}
			});
		});
	});
});
