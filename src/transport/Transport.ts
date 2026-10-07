export type ConnectionState = "disconnected" | "connecting" | "connected";

/** Byte-stream transport; the terminal only depends on this interface. */
export interface Transport {
  readonly state: ConnectionState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(data: Uint8Array): Promise<void>;
  /** Called with raw bytes as they arrive (not necessarily whole lines). */
  onData: ((data: Uint8Array) => void) | null;
  /** Called whenever the connection state changes. */
  onStateChange: ((state: ConnectionState, message?: string) => void) | null;
}
