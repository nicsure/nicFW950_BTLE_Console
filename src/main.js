import { LINE_TERMINATOR } from "./config.js";
import { BleTransport } from "./transport/BleTransport.js";

const $ = (id) => document.getElementById(id);
const terminal = $("terminal");
const statusEl = $("status");
const connectionDetailEl = $("connection-detail");
const connectBtn = $("connect");
const disconnectBtn = $("disconnect");
const clearBtn = $("clear");
const form = $("send-form");
const input = $("command");
const sendBtn = $("send");
const lightModeBtn = $("light-mode");
const darkModeBtn = $("dark-mode");

const transport = new BleTransport();
const decoder = new TextDecoder("ascii");
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
let manuallySelectedTheme = false;

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  lightModeBtn.setAttribute("aria-pressed", String(theme === "light"));
  darkModeBtn.setAttribute("aria-pressed", String(theme === "dark"));
}

try {
  const savedTheme = localStorage.getItem("nicfw950-theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    manuallySelectedTheme = true;
    setTheme(savedTheme);
  } else {
    setTheme(systemTheme.matches ? "dark" : "light");
  }
} catch {
  setTheme(systemTheme.matches ? "dark" : "light");
}

systemTheme.addEventListener("change", (event) => {
  if (!manuallySelectedTheme) setTheme(event.matches ? "dark" : "light");
});

lightModeBtn.addEventListener("click", () => {
  manuallySelectedTheme = true;
  setTheme("light");
  try { localStorage.setItem("nicfw950-theme", "light"); } catch {}
});
darkModeBtn.addEventListener("click", () => {
  manuallySelectedTheme = true;
  setTheme("dark");
  try { localStorage.setItem("nicfw950-theme", "dark"); } catch {}
});

function append(text, className = "") {
  const shouldStickToBottom =
    terminal.scrollTop + terminal.clientHeight >= terminal.scrollHeight - 4;

  if (className) {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    terminal.appendChild(span);
  } else {
    terminal.appendChild(document.createTextNode(text));
  }

  if (shouldStickToBottom) terminal.scrollTop = terminal.scrollHeight;
}

function info(text, className = "info") {
  if (terminal.textContent && !terminal.textContent.endsWith("\n")) append("\n");
  append(`${text}\n`, className);
}

function renderConnection(state, message) {
  const labels = {
    disconnected: "Disconnected",
    connecting: "Connecting…",
    connected: "Connected",
  };

  statusEl.textContent = labels[state];
  statusEl.className = `status ${state}`;
  connectBtn.disabled = state !== "disconnected";
  connectBtn.textContent = state === "connecting" ? "Connecting…" : "Connect";
  disconnectBtn.disabled = state !== "connected";
  input.disabled = sendBtn.disabled = state !== "connected";

  if (message) connectionDetailEl.textContent = message;
  if (state === "connected") input.focus();
}

transport.onData = (bytes) => {
  append(decoder.decode(bytes, { stream: true }));
};
transport.onStateChange = (state, message) => {
  renderConnection(state, message);
};

connectBtn.addEventListener("click", async () => {
  try {
    await transport.connect();
  } catch (error) {
    info(errorMessage(error), "error");
  }
});

disconnectBtn.addEventListener("click", async () => {
  try {
    await transport.disconnect();
  } catch (error) {
    info(errorMessage(error), "error");
  }
});

clearBtn.addEventListener("click", () => {
  terminal.textContent = "";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const command = input.value;

  try {
    await transport.send(encodeAscii(command + LINE_TERMINATOR));
    input.value = "";
  } catch (error) {
    info(errorMessage(error), "error");
  }
});

function encodeAscii(text) {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code > 0x7f) throw new Error("Commands must contain ASCII characters only.");
    bytes[index] = code;
  }
  return bytes;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

renderConnection(
  transport.state,
  "Disconnected. Select Connect to choose a Bluetooth device.",
);

if (!navigator.bluetooth) {
  const message =
    "Web Bluetooth is unavailable. Use a supported browser over HTTPS or localhost.";
  renderConnection("disconnected", message);
  info(message, "error");
}
