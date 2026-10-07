import {
  BLE_CHARACTERISTIC_UUID,
  BLE_SERVICE_UUID,
  BLE_WRITE_CHUNK_SIZE,
} from "../config.js";
import { Transport } from "./Transport.js";

export class BleTransport extends Transport {
  constructor() {
    super();
    this.device = null;
    this.characteristic = null;
    this.handleNotification = this.handleNotification.bind(this);
    this.handleDisconnected = this.handleDisconnected.bind(this);
  }

  handleNotification(event) {
    const value = event.target?.value;
    if (!value) return;

    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    this.onData?.(bytes.slice());
  }

  handleDisconnected() {
    this.cleanup();
    this.setState("disconnected", "Device disconnected. Select Connect to reconnect.");
  }

  cleanup() {
    this.characteristic?.removeEventListener("characteristicvaluechanged", this.handleNotification);
    this.device?.removeEventListener("gattserverdisconnected", this.handleDisconnected);
    this.characteristic = null;
    this.device = null;
  }

  async connect() {
    if (this.state !== "disconnected") return;

    // Change state before opening the chooser so repeated clicks are blocked immediately.
    this.setState("connecting", "Waiting for Bluetooth device selection…");

    if (!navigator.bluetooth) {
      const message = "Web Bluetooth is unavailable. Use a supported browser over HTTPS or localhost.";
      this.setState("disconnected", message);
      throw new Error(message);
    }

    let device;
    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [BLE_SERVICE_UUID] }],
      });
    } catch (error) {
      const cancelled = error?.name === "NotFoundError" || error?.name === "AbortError";
      const message = cancelled
        ? "Device selection cancelled. Select Connect to try again."
        : `Bluetooth device selection failed: ${errorMessage(error)}`;
      this.setState("disconnected", message);
      throw new Error(message);
    }

    this.device = device;
    device.addEventListener("gattserverdisconnected", this.handleDisconnected);

    try {
      if (!device.gatt) throw new Error("The selected device does not expose a GATT server.");

      this.setState("connecting", `${device.name || "Bluetooth device"} selected. Connecting to GATT server…`);
      const server = await device.gatt.connect();

      this.setState("connecting", "GATT connected. Discovering service FFE0…");
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);

      this.setState("connecting", "Service FFE0 found. Looking up characteristic FFE1…");
      this.characteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);
      this.characteristic.addEventListener("characteristicvaluechanged", this.handleNotification);

      this.setState("connecting", "Characteristic FFE1 found. Enabling notifications…");
      await this.characteristic.startNotifications();

      this.setState(
        "connected",
        `Connected to ${device.name || "Bluetooth device"}; notifications are active.`,
      );
    } catch (error) {
      const failedDevice = this.device;
      this.cleanup();
      if (failedDevice?.gatt?.connected) failedDevice.gatt.disconnect();

      const message = `Connection failed: ${errorMessage(error)}`;
      this.setState("disconnected", message);
      throw new Error(message);
    }
  }

  async disconnect() {
    const device = this.device;
    if (!device) {
      this.setState("disconnected", "Disconnected.");
      return;
    }

    this.cleanup();
    if (device.gatt?.connected) device.gatt.disconnect();
    this.setState("disconnected", "Disconnected. Select Connect to connect to a device.");
  }

  async send(data) {
    const characteristic = this.characteristic;
    if (!characteristic || this.state !== "connected") {
      throw new Error("Not connected.");
    }

    try {
      for (let offset = 0; offset < data.length; offset += BLE_WRITE_CHUNK_SIZE) {
        const chunk = data.slice(offset, offset + BLE_WRITE_CHUNK_SIZE);
        await characteristic.writeValue(chunk);
      }
    } catch (error) {
      throw new Error(`Write failed: ${errorMessage(error)}`);
    }
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
