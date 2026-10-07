# nicFW950 BLE Console

A minimal browser console for talking ASCII to a custom embedded device over Bluetooth Low Energy (Web Bluetooth). It is intentionally just a terminal: no radio programming, codeplug handling, binary protocols, firmware flashing, configuration screens or authentication.

## BLE details

| Item | Value |
| --- | --- |
| Service | `FFE0` (`0000ffe0-0000-1000-8000-00805f9b34fb`) |
| Characteristic | `FFE1` (`0000ffe1-0000-1000-8000-00805f9b34fb`) |
| Properties | Read, Write, Notify |

The same characteristic is used in both directions. The app calls `navigator.bluetooth.requestDevice()` (filtered on service FFE0), connects to GATT, gets service FFE0 and characteristic FFE1, and starts notifications. Notification bytes are decoded as ASCII and appended to the terminal as they arrive (no line framing is assumed). Commands are ASCII-encoded, followed by the line terminator, and written to FFE1 in 20-byte chunks.

## Requirements

- A browser with Web Bluetooth: Chrome, Edge or Opera (desktop/Android). Firefox and Safari do not support it.
- A secure context: `http://localhost` works for development; production deployment **must use HTTPS**.
- Node.js 18+ for building.

## Run locally

```sh
npm install
npm run dev
```

Open the printed `http://localhost:5173` URL in Chrome/Edge.

## Build for deployment

```sh
npm run build
```

Serve the contents of `dist/` from any static host over HTTPS. `npm run preview` serves the build locally.

## Limitations of Web Bluetooth

- Device selection needs a user gesture (the Connect button) and always shows the browser chooser; there is no silent auto-reconnect.
- No Bluetooth support in Firefox/Safari; iOS browsers are unsupported.
- Write size is limited by the negotiated MTU, so data is sent in small chunks; throughput is modest.
- BLE is not a true stream: notifications can split or merge lines.

## Line termination

Edit `LINE_TERMINATOR` in [`src/config.ts`](src/config.ts) (default `"\r"`; use `"\n"` for LF or `"\r\n"` for CRLF).

## Structure

- `src/transport/Transport.ts` – transport interface (`connect`, `disconnect`, `send`, `onData`, `onStateChange`, `state`).
- `src/transport/BleTransport.ts` – Web Bluetooth implementation. A Web Serial transport can implement the same interface later.
- `src/main.ts` – terminal UI; depends only on `Transport`.
