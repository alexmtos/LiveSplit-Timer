import { createMockLogReader } from '../../mocks/logReader';

describe('LogReader lifecycle scaffolding', () => {
  test('lifecycle transitions', async () => {
    const lr = createMockLogReader();
    await lr.init();
    // @ts-ignore
    expect(lr.state).toBe('initialized');
    await lr.start();
    // @ts-ignore
    expect(lr.state).toBe('running');
  });
});
