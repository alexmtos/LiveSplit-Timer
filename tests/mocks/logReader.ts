export class MockLogReader {
  state: string = 'idle';
  async init() { this.state = 'initialized'; }
  async start() { this.state = 'running'; }
  async stop() { this.state = 'stopped'; }
  async destroy() { this.state = 'destroyed'; }
}

export function createMockLogReader(): MockLogReader {
  return new MockLogReader();
}
