import "./style.css";
import { LINE_TERMINATOR } from "./config";
import { BleTransport } from "./transport/BleTransport";
import type { ConnectionState, Transport } from "./transport/Transport";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const terminal = $<HTMLPreElement>("terminal");
const statusEl = $<HTMLSpanElement>("status");
const connectionDetailEl = $<HTMLParagraphElement>("connection-detail");
const connectBtn = $<HTMLButtonElement>("connect");
const disconnectBtn = $<HTMLButtonElement>("disconnect");
const clearBtn = $<HTMLButtonElement>("clear");
const form = $<HTMLFormElement>("send-form");
const input = $<HTMLInputElement>("command");
const sendBtn = $<HTMLButtonElement>("send");

const transport: Transport = new BleTransport();
const decoder = new TextDecoder("ascii");
const encoder = new TextEncoder();

function append(text: string, cls?: string) {
  const stick = terminal.scrollTop + terminal.clientHeight >= terminal.scrollHeight - 4;
  if (cls) {
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = text;
    terminal.appendChild(span);
  } else {
    terminal.appendChild(document.createTextNode(text));
  }
  if (stick) terminal.scrollTop = terminal.scrollHeight;
}

function info(text: string, cls = "info") {
  if (terminal.textContent && !terminal.textContent.endsWith("\n")) append("\n");
  append(text + "\n", cls);
}

function render(state: ConnectionState, message?: string) {
  const labels = { disconnected: "Disconnected", connecting: "Connecting…", connected: "Connected" };
  statusEl.textContent = labels[state];
  statusEl.className = `status ${state}`;
  connectBtn.disabled = state !== "disconnected";
  connectBtn.textContent = state === "connecting" ? "Connecting…" : "Connect";
  disconnectBtn.disabled = state !== "connected";
  input.disabled = sendBtn.disabled = state !== "connected";
  if (message) connectionDetailEl.textContent = message;
  if (state === "connected") input.focus();
}

transport.onData = (data) => append(decoder.decode(data, { stream: true }));
transport.onStateChange = (state, message) => render(state, message);

connectBtn.addEventListener("click", async () => {
  try {
    await transport.connect();
  } catch (e) {
    info(e instanceof Error ? e.message : String(e), "error");
  }
});
disconnectBtn.addEventListener("click", () => {
  transport.disconnect().then(() => info("Disconnected."));
});
clearBtn.addEventListener("click", () => {
  terminal.textContent = "";
});

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const text = input.value;
  input.value = "";
  try {
    await transport.send(encoder.encode(text + LINE_TERMINATOR));
  } catch (e) {
    info(e instanceof Error ? e.message : String(e), "error");
  }
});

render(transport.state, "Disconnected. Select Connect to choose a Bluetooth device.");
if (!navigator.bluetooth) {
  const message = "Web Bluetooth is unavailable. Use Chrome or Edge in a secure context (HTTPS or localhost).";
  render("disconnected", message);
  info(message, "error");
}
