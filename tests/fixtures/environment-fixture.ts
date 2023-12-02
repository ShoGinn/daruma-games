export const environmentResetFixture = (): { originalEnv: NodeJS.ProcessEnv } => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  return {
    originalEnv: OLD_ENV,
  };
};
