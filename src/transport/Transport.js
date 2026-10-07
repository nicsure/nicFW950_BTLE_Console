/**
 * Small byte-stream transport contract used by the terminal UI.
 * Implementations call onData with received bytes and setState on transitions.
 */
export class Transport {
  constructor() {
    this.state = "disconnected";
    this.onData = null;
    this.onStateChange = null;
  }

  setState(state, message = "") {
    this.state = state;
    this.onStateChange?.(state, message);
  }

  async connect() {
    throw new Error("connect() is not implemented.");
  }

  async disconnect() {
    throw new Error("disconnect() is not implemented.");
  }

  async send(_data) {
    throw new Error("send() is not implemented.");
  }
}
