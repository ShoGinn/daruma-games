import { Schedule } from '../../src/model/framework/decorators/schedule.js';

describe('Schedule', () => {
  test('throws an error for an invalid cron expression', () => {
    const cronExpression = 'invalid-expression';

    expect(() => {
      Schedule(cronExpression)(null, '', {});
    }).toThrowError(`Invalid cron expression: ${cronExpression}`);
  });
});
