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
    this.setState("disconnected", "Device disconnected. Select Connect to reconnect.");
  };

  private cleanup() {
    this.characteristic?.removeEventListener("characteristicvaluechanged", this.handleNotification);
    this.device?.removeEventListener("gattserverdisconnected", this.handleDisconnected);
    this.characteristic = null;
    this.device = null;
  }

  async connect(): Promise<void> {
    if (this.state !== "disconnected") return;

    // Set connecting before opening the browser picker so repeated clicks are blocked
    // and the user can see that the request is waiting for device selection.
    this.setState("connecting", "Waiting for Bluetooth device selection…");
    if (!navigator.bluetooth) {
      const message = "Web Bluetooth is unavailable. Use Chrome or Edge in a secure context (HTTPS or localhost).";
      this.setState("disconnected", message);
      throw new Error(message);
    }

    let device: BluetoothDevice;
    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
      });
    } catch (e) {
      const cancelled = e instanceof DOMException && e.name === "NotFoundError";
      const message = cancelled
        ? "Device selection cancelled. Select Connect to try again."
        : `Bluetooth device selection failed: ${errMsg(e)}`;
      this.setState("disconnected", message);
      throw new Error(message);
    }

    this.device = device;
    device.addEventListener("gattserverdisconnected", this.handleDisconnected);
    try {
      this.setState("connecting", `${device.name || "Bluetooth device"} selected. Connecting to GATT server…`);
      const server = await device.gatt!.connect();

      this.setState("connecting", "GATT connected. Discovering service FFE0…");
      const service = await server.getPrimaryService(SERVICE_UUID);

      this.setState("connecting", "Service FFE0 found. Looking up characteristic FFE1…");
      this.characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      this.characteristic.addEventListener("characteristicvaluechanged", this.handleNotification);

      this.setState("connecting", "Characteristic FFE1 found. Enabling notifications…");
      await this.characteristic.startNotifications();

      this.setState("connected", `Connected to ${device.name || "Bluetooth device"}; notifications are active.`);
    } catch (e) {
      const dev = this.device;
      this.cleanup();
      if (dev?.gatt?.connected) dev.gatt.disconnect();
      const message = `Connection failed: ${errMsg(e)}`;
      this.setState("disconnected", message);
      throw new Error(message);
    }
  }

  async disconnect(): Promise<void> {
    const dev = this.device;
    if (!dev) return;
    this.cleanup();
    if (dev.gatt?.connected) dev.gatt.disconnect();
    this.setState("disconnected", "Disconnected. Select Connect to connect to a device.");
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
