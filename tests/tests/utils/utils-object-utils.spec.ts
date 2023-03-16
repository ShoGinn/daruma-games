import { ObjectUtil } from '../../../src/utils/utils.js';

describe('Object Utils', () => {
    describe('verifyMandatoryEnvs', () => {
        const mandatoryEnvironments = {
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
            Object.assign(process.env, mandatoryEnvironments);
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
                const object = { key: 'value' };
                expect(ObjectUtil.isValidObject(object)).toBe(true);
            });

            it('should return false if the object is not valid', () => {
                const object: unknown = [];
                expect(ObjectUtil.isValidObject(object)).toBe(false);
            });
        });

        describe('isValidArray', () => {
            it('should return true if the array is valid', () => {
                const array = ['value'];
                expect(ObjectUtil.isValidArray(array)).toBe(true);
            });

            it('should return false if the array is not valid', () => {
                const array: unknown = {};
                expect(ObjectUtil.isValidArray(array)).toBe(false);
            });
        });

        describe('isValidString', () => {
            it('should return true if the string is valid', () => {
                const string_ = 'value';
                expect(ObjectUtil.isValidString(string_)).toBe(true);
            });

            it('should return false if the string is not valid', () => {
                const string_: unknown = {};
                expect(ObjectUtil.isValidString(string_)).toBe(false);
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
        it('should not error out if nothing is given', () => {
            expect(ObjectUtil.ellipseAddress()).toBe('');
        });
    });
    describe('onlyDigits', () => {
        it('should return the string with only digits', () => {
            const string_ = '1234567890';
            expect(ObjectUtil.onlyDigits(string_)).toBe(string_);
        });

        it('should return the string with only digits', () => {
            const string_ = '1234567890';
            expect(ObjectUtil.onlyDigits(string_)).toBe(string_);
        });

        it('should return the string with only digits', () => {
            const string_ = '1234567890';
            expect(ObjectUtil.onlyDigits(string_)).toBe(string_);
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

            expect(Date.now() - startTime).toBeGreaterThanOrEqual(delayTime - 10);
        });
    });
    describe('convertBigIntToNumber', () => {
        it('should return the same number if given a number input', () => {
            expect(ObjectUtil.convertBigIntToNumber(123, 2)).toEqual(123);
        });

        it('should convert a BigInt to a number with decimals', () => {
            expect(ObjectUtil.convertBigIntToNumber(BigInt(1_431_400_000_000), 8)).toEqual(14_314);
        });

        it('should convert a BigInt to a whole number if decimals is zero', () => {
            expect(ObjectUtil.convertBigIntToNumber(BigInt(123_456_789), 0)).toEqual(123_456_789);
        });
        it('should return 0 if given a bigint of 0', () => {
            expect(ObjectUtil.convertBigIntToNumber(BigInt(0), 2)).toEqual(0);
        });
        it('should throw a TypeError if given a string', () => {
            expect.assertions(1);
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            expect(() => ObjectUtil.convertBigIntToNumber('123', 2)).toThrow(Error);
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
});
