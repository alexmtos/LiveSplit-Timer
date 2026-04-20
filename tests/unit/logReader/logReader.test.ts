import { createMockLogReader } from '../../mocks/logReader';

describe('LogReader unit tests', () => {
  it('should perform lifecycle steps (scaffold)', async () => {
    const lr = createMockLogReader();
    await lr.init();
    // @ts-ignore
    expect(lr.state).toBe('initialized');
    await lr.start();
    // @ts-ignore
    expect(lr.state).toBe('running');
    await lr.stop();
    // @ts-ignore
    expect(lr.state).toBe('stopped');
    await lr.destroy();
    // @ts-ignore
    expect(lr.state).toBe('destroyed');
  });
});
