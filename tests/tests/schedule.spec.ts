import { Schedule } from '../../src/decorators/schedule.js';

describe('Schedule', () => {
  test('throws an error for an invalid cron expression', () => {
    const cronExpression = 'invalid-expression';

    expect(() => {
      Schedule(cronExpression)(null, '', {});
    }).toThrow(`Invalid cron expression: ${cronExpression}`);
  });
});
