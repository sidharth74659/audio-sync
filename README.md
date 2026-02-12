# Synchronized Audio Playback (Local)

Minimal end-to-end synchronized audio playback app. Multiple users visiting the same URL hear the same uploaded audio in sync. When one user presses play or pause, everyone follows.

## Features

- Upload a single audio file (stored on disk under `uploads/`).
- Shared playback state in memory, no database or third-party services.
- WebSocket-based synchronization so play/pause events propagate to all connected clients.
- New clients join at the correct synchronized timestamp.

## Requirements

- Node.js 20.19.0 (recommended, see `.nvmrc`).
- npm or yarn.

## Install & Run Locally

```bash
# from project root
npm install

# start server
npm start
# or for auto-reload during development
npm run dev
```

Then open `http://localhost:3000` in one or more browser windows.

### Basic Usage

1. Open `http://localhost:3000` in Browser A.
2. Upload an audio file (e.g., `.mp3`, `.wav`).
3. Click **Play** – playback starts for all connected clients.
4. Open the same URL in Browser B (or another device on the same network).
5. Browser B will load the same audio and automatically sync to the current playback time.
6. Any **Play** / **Pause** action in one browser is reflected in all others.

## How Synchronization Works

The server keeps a single in-memory playback state:

```js
{
  isPlaying: boolean,
  currentTime: number,   // seconds, reference point
  lastUpdated: number,   // Date.now() when state last changed
  audioUrl: string | null
}
```

- When a client sends `play` with its current time, the server stores:
  - `isPlaying = true`
  - `currentTime = sent currentTime`
  - `lastUpdated = Date.now()`
  - and broadcasts the state to all clients.
- When a client sends `pause`, the server stores `isPlaying = false` and `currentTime` at the pause moment.
- On each client, when a new state is received:
  - If `isPlaying` is true, the effective playback position is

    ```js
    actualTime = currentTime + (Date.now() - lastUpdated) / 1000;
    ```

  - The client gently seeks if the difference between its local `audio.currentTime` and `actualTime` is large enough.
  - The client starts or stops playback based on `isPlaying`.

### New Clients Joining

- When a new WebSocket connection is opened, the server immediately sends the latest playback state, including `audioUrl`.
- The client sets its `<audio>` source and computes the synchronized position using the formula above.
- If playback is currently active, the new client plays from the computed time.

## Limitations & Possible Improvements

- **Latency & jitter**: WebSocket and network latency mean clients may have small timing differences (tens to hundreds of ms).
- **Clock drift**: The approach assumes client clocks are roughly in sync; large clock offsets can introduce error.
- **No persistence**: State and uploaded files live only in memory/disk until the server restarts; there is no history or multi-room support.

Potential improvements for production:

- Periodic server time pings / round-trip latency measurement and offset correction for tighter sync.
- Use a more robust time base (e.g., server-authoritative time with drift correction).
- Heartbeat / presence detection and per-room sessions with IDs.
- File management (cleanup, multiple tracks, user-selectable playlists, etc.).

## Exposing the App Over the Internet

You can share the synchronized experience with others by exposing your local port.

### Option 1: Using ngrok

1. Install ngrok (see docs for your OS).
2. Run the app locally with `npm start`.
3. In another terminal, run:

   ```bash
   ngrok http 3000
   ```

4. ngrok will print a public URL like `https://abcd1234.ngrok.io` – share this URL with others. All visitors connect to your local server through the tunnel.

### Option 2: Router Port Forwarding

1. Run the app locally with `npm start`.
2. Find your machine's local IP address (e.g., `192.168.1.10`).
3. Log into your router's admin interface.
4. Forward external TCP port **3000** (or another chosen external port) to internal IP `192.168.1.10` on port **3000**.
5. Share your public IP address (or domain) and port with others (e.g., `http://your-public-ip:3000`).

> Be mindful of security when exposing local services to the internet. Consider using HTTPS, authentication, and firewall rules in production-quality setups.
