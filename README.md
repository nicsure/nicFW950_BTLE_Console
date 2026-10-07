# nicFW950 BLE Console

A minimal browser terminal for sending ASCII commands to a custom embedded device over Bluetooth Low Energy (BLE). The interface stays focused on connecting, sending commands, and viewing device output.

## BLE connection

The device exposes one GATT service and one characteristic:

| Item | UUID | Use |
| --- | --- | --- |
| Service | `FFE0` | Device console service |
| Characteristic | `FFE1` | Write commands and receive notifications |

The app asks you to select a device advertising service FFE0, connects to its GATT server, finds FFE0/FFE1, and subscribes to notifications. The same FFE1 characteristic carries both outgoing writes and incoming notification data.

Notification bytes are decoded as ASCII and appended as they arrive. Notifications are not treated as complete lines or messages. Outgoing commands are ASCII-encoded and sent in small chunks.

## Browser requirements

Use a browser that implements Web Bluetooth, such as desktop Chrome or Edge. Web Bluetooth requires a secure context: `http://localhost` is allowed for local development, and production sites must use HTTPS. The device chooser opens only after you press Connect. The device must be advertising the FFE0 service to appear in the chooser.

Web Bluetooth is not available in Firefox or Safari, and iOS browsers do not support this app's BLE workflow.

## Run locally

No Node.js, package installation, or build step is needed. From the repository root, start a local static server:

**Windows**

```powershell
py -m http.server 8000
```

**macOS / Linux**

```sh
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a supported browser.

## Deploy

This is a static site. Publish the repository root (which contains `index.html`) on GitHub Pages or another static host that serves HTTPS. Stylesheets and JavaScript use relative paths so they work under the repository's GitHub Pages URL.

## Theme

The page follows the browser's system color preference by default. Use the **Light mode** and **Dark mode** buttons to choose a theme manually; the selection is saved in local storage.

## Command line termination

Edit the single `LINE_TERMINATOR` constant in [`src/config.js`](src/config.js). It is set to CRLF (`"\r\n"`) initially. Change it to `"\r"` for CR or `"\n"` for LF.

## Structure

- `index.html` – Page markup and relative static asset links.
- `src/main.js` – Terminal interface, theme controls, and form handling.
- `src/config.js` – Line terminator, UUIDs, and BLE write chunk size.
- `src/transport/Transport.js` – Small transport contract.
- `src/transport/BleTransport.js` – Web Bluetooth GATT connection and byte-stream handling.

Web Serial, radio programming, binary protocols, firmware updates, and device configuration are outside the scope of this console.
