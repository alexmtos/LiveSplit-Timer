export class MockWebSocketServer {
  started = false;
  clients = [] as string[];
  start() {
    this.started = true;
    this.clients = ['client1'];
  }
  stop() {
    this.started = false;
    this.clients = [];
  }
}
