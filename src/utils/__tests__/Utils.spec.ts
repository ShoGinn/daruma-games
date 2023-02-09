import { DiscordUtils, ObjectUtil } from '../Utils.js';

describe('Object Utils', () => {
    describe('verifyMandatoryEnvs', () => {
        const mandatoryEnvs = {
            BOT_OWNER_ID: 'BOT_OWNER_ID',
            BOT_TOKEN: 'BOT_TOKEN',
            CLAWBACK_TOKEN_MNEMONIC: 'CLAWBACK_TOKEN_MNEMONIC',
            DB_SERVER: 'DB_SERVER',
            ALGO_API_TOKEN: 'ALGO_API_TOKEN',
            NODE_ENV: 'NODE_ENV',
        };

        beforeEach(() => {
            // mock the process.env object
            jest.resetModules();
            Object.assign(process.env, mandatoryEnvs);
        });

        it('should not throw an error if all mandatory environment variables are set', () => {
            process.env.MYSQL_URL = 'MYSQL_URL';
            expect(() => {
                ObjectUtil.verifyMandatoryEnvs();
            }).not.toThrow();
        });

        it('should throw an error if a mandatory environment variable is missing', () => {
            process.env.MYSQL_URL = '';
            expect(() => {
                ObjectUtil.verifyMandatoryEnvs();
            }).toThrow(/Missing key DB_SERVER in config.env/);
        });
    });
    describe('isValidFunctions', () => {
        describe('isValidObject', () => {
            it('should return true if the object is valid', () => {
                const obj = { key: 'value' };
                expect(ObjectUtil.isValidObject(obj)).toBe(true);
            });

            it('should return false if the object is not valid', () => {
                const obj: any = [];
                expect(ObjectUtil.isValidObject(obj)).toBe(false);
            });
        });

        describe('isValidArray', () => {
            it('should return true if the array is valid', () => {
                const arr = ['value'];
                expect(ObjectUtil.isValidArray(arr)).toBe(true);
            });

            it('should return false if the array is not valid', () => {
                const arr: any = {};
                expect(ObjectUtil.isValidArray(arr)).toBe(false);
            });
        });

        describe('isValidString', () => {
            it('should return true if the string is valid', () => {
                const str = 'value';
                expect(ObjectUtil.isValidString(str)).toBe(true);
            });

            it('should return false if the string is not valid', () => {
                const str: any = {};
                expect(ObjectUtil.isValidString(str)).toBe(false);
            });
            it('should return false if the string is length of 0', () => {
                expect(ObjectUtil.isValidString()).toBe(false);
            });
        });
    });
    describe('ellipseAddress', () => {
        it('should return the address if it is less than 10 characters', () => {
            const address = 'address';
            expect(ObjectUtil.ellipseAddress(address)).toBe(address);
        });

        it('should return an ellipses address if it is greater than 10 characters', () => {
            const address = '12345678910';
            expect(ObjectUtil.ellipseAddress(address)).toBe('12345...78910');
        });

        it('should return an ellipses address if it is less than 10 characters', () => {
            const address = 'address';
            expect(ObjectUtil.ellipseAddress(address, 2, 2)).toBe('ad...ss');
        });
        it('should not error out if null string', () => {
            const address = null;
            expect(ObjectUtil.ellipseAddress(address)).toBe('');
        });
    });
    describe('onlyDigits', () => {
        it('should return the string with only digits', () => {
            const str = '1234567890';
            expect(ObjectUtil.onlyDigits(str)).toBe(str);
        });

        it('should return the string with only digits', () => {
            const str = '1234567890';
            expect(ObjectUtil.onlyDigits(str)).toBe(str);
        });

        it('should return the string with only digits', () => {
            const str = '1234567890';
            expect(ObjectUtil.onlyDigits(str)).toBe(str);
        });
    });

    describe('Time Utils', () => {
        describe('timeAgo', () => {
            it('should return the time ago from the given date', () => {
                const date = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
                const timeAgo = ObjectUtil.timeAgo(date);
                expect(timeAgo).toBe('an hour ago');
            });
        });

        describe('moreThanTwentyFourHoursAgo', () => {
            it('should return true if date is more than 24 hours ago', () => {
                const date = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
                const result = ObjectUtil.moreThanTwentyFourHoursAgo(date);
                expect(result).toBe(true);
            });

            it('should return false if date is less than 24 hours ago', () => {
                const date = Date.now() - 23 * 60 * 60 * 1000; // 23 hours ago
                const result = ObjectUtil.moreThanTwentyFourHoursAgo(date);
                expect(result).toBe(false);
            });
        });

        describe('timeFromNow', () => {
            it('should return the time from now for the given milliseconds', () => {
                const date = Date.now() + 60 * 60 * 1000; // 1 hour
                const timeFromNow = ObjectUtil.timeFromNow(date);
                expect(timeFromNow).toBe('in an hour');
            });
        });

        describe('timeToHuman', () => {
            it('should return the human-readable duration for the given milliseconds', () => {
                const durationInMilliseconds = 60 * 1000; // 1 minute
                const humanDuration = ObjectUtil.timeToHuman(durationInMilliseconds);
                expect(humanDuration).toBe('a minute');
            });
        });
    });
    describe('singleFieldBuilder', () => {
        it('should return an array with a single APIEmbedField object with inline', () => {
            const name = 'Test name';
            const value = 'Test value';
            const inline = true;
            const result = ObjectUtil.singleFieldBuilder(name, value, inline);
            expect(result).toEqual([{ name, value, inline }]);
        });
        it('should return an array with a single APIEmbedField object without inline', () => {
            const name = 'Test name';
            const value = 'Test value';
            const result = ObjectUtil.singleFieldBuilder(name, value);
            expect(result).toEqual([{ name, value, inline: false }]);
        });
    });
    describe('delayFor', () => {
        it('should wait for the specified amount of time', async () => {
            const delayTime = 100;
            const startTime = Date.now();

            await ObjectUtil.delayFor(delayTime);

            expect(Date.now() - startTime).toBeGreaterThanOrEqual(delayTime);
        });
    });
    describe('chunkArray', () => {
        it('should return an array of arrays of given size', () => {
            const input = [1, 2, 3, 4, 5, 6, 7];
            const chunkSize = 3;
            const output = ObjectUtil.chunkArray(input, chunkSize);

            expect(output).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
        });

        it('should return an array of arrays of size 2 by default', () => {
            const input = [1, 2, 3, 4, 5];
            const output = ObjectUtil.chunkArray(input);

            expect(output).toEqual([[1, 2], [3, 4], [5]]);
        });

        it('should return an array with only one chunk if the input is smaller than chunk size', () => {
            const input = [1, 2];
            const chunkSize = 3;
            const output = ObjectUtil.chunkArray(input, chunkSize);

            expect(output).toEqual([[1, 2]]);
        });
    });
    describe('shuffle', () => {
        it('should shuffle the array', () => {
            const arr = [1, 2, 3, 4, 5];
            const shuffledArray = ObjectUtil.shuffle(arr);

            expect(shuffledArray).not.toEqual(arr);
            expect(shuffledArray).toHaveLength(arr.length);
            expect(new Set(shuffledArray)).toEqual(new Set(arr));
        });

        it('should return an empty array if the input array is empty', () => {
            const shuffledArray = ObjectUtil.shuffle([]);

            expect(shuffledArray).toEqual([]);
        });
    });
    describe('getRandomElement', () => {
        it('getRandomElement should return a random element from an array', () => {
            const arr = [1, 2, 3, 4, 5];
            const randomElement = ObjectUtil.getRandomElement(arr);
            expect(arr).toContain(randomElement);
        });

        it('getRandomElement should return null for an empty array', () => {
            const arr: number[] = [];
            const randomElement = ObjectUtil.getRandomElement(arr);
            expect(randomElement).toBeNull();
        });
    });
    describe('Discord Utils', () => {
        describe('Developer Commands', () => {
            describe('getDeveloperCommands', () => {
                it('should return an array of developer commands', () => {
                    const devs = DiscordUtils.getDevs();
                    expect(devs).toHaveLength(1);
                    expect(devs).toContain('BOT_OWNER_ID');
                    process.env.BOT_OWNER_ID = '123';
                    expect(DiscordUtils.getDevs()).toHaveLength(1);
                });
            });
        });
        describe('isDev', () => {
            it('should return true if the user is a developer', () => {
                process.env.BOT_OWNER_ID = '123';
                expect(DiscordUtils.isDev('123')).toBe(true);
            });
            it('should return false if the user is not a developer', () => {
                process.env.BOT_OWNER_ID = '123';
                expect(DiscordUtils.isDev('456')).toBe(false);
            });
        });
    });
});
