import type { ConnectionState, Transport } from "./Transport";

// Web Bluetooth accepts 16-bit UUIDs as numbers (0xFFE0 -> full 128-bit form).
const SERVICE_UUID: BluetoothServiceUUID = 0xffe0;
const CHARACTERISTIC_UUID: BluetoothCharacteristicUUID = 0xffe1;
// Conservative chunk size (default ATT MTU 23 - 3 header bytes).
const WRITE_CHUNK = 20;

export class BleTransport implements Transport {
  state: ConnectionState = "disconnected";
  onData: ((data: Uint8Array) => void) | null = null;
  onStateChange: ((state: ConnectionState, message?: string) => void) | null = null;

  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  private setState(state: ConnectionState, message?: string) {
    this.state = state;
    this.onStateChange?.(state, message);
  }

  private readonly handleNotification = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (value) {
      this.onData?.(new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice());
    }
  };

  private readonly handleDisconnected = () => {
    this.cleanup();
    this.setState("disconnected", "Device disconnected");
  };

  private cleanup() {
    this.characteristic?.removeEventListener("characteristicvaluechanged", this.handleNotification);
    this.device?.removeEventListener("gattserverdisconnected", this.handleDisconnected);
    this.characteristic = null;
    this.device = null;
  }

  async connect(): Promise<void> {
    if (this.state !== "disconnected") return;
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth is not supported in this browser (or the page is not a secure context).");
    }

    let device: BluetoothDevice;
    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotFoundError") {
        throw new Error("Device selection cancelled.");
      }
      throw e;
    }

    this.setState("connecting");
    this.device = device;
    device.addEventListener("gattserverdisconnected", this.handleDisconnected);
    try {
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      this.characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      this.characteristic.addEventListener("characteristicvaluechanged", this.handleNotification);
      try {
        await this.characteristic.startNotifications();
      } catch (e) {
        throw new Error(`Failed to start notifications: ${errMsg(e)}`);
      }
    } catch (e) {
      const dev = this.device;
      this.cleanup();
      if (dev?.gatt?.connected) dev.gatt.disconnect();
      this.setState("disconnected");
      throw new Error(`Connection failed: ${errMsg(e)}`);
    }
    this.setState("connected");
  }

  async disconnect(): Promise<void> {
    const dev = this.device;
    if (!dev) return;
    this.cleanup();
    if (dev.gatt?.connected) dev.gatt.disconnect();
    this.setState("disconnected");
  }

  async send(data: Uint8Array): Promise<void> {
    const ch = this.characteristic;
    if (!ch || this.state !== "connected") throw new Error("Not connected.");
    try {
      for (let i = 0; i < data.length; i += WRITE_CHUNK) {
        await ch.writeValue(data.slice(i, i + WRITE_CHUNK));
      }
    } catch (e) {
      throw new Error(`Write failed: ${errMsg(e)}`);
    }
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
