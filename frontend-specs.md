## Synchronized Audio Playback - Frontend Specs

- **Single page app** served from `public/index.html` using vanilla JS.
- **Audio element** with play/pause controls and text time display.
- **WebSocket client**
  - Connects to `ws(s)://<host>` on page load.
  - On open, sends `{ type: 'request_state' }`.
  - On `state` message, updates local UI and syncs playback.
- **Upload flow**
  - Uses `<input type="file" accept="audio/*">` and `fetch('/upload', { method: 'POST', body: FormData })`.
  - When upload succeeds, uses returned `audioUrl` and state; server also broadcasts to all clients.
- **Sync behavior**
  - Maintains last known shared state `{ isPlaying, currentTime, lastUpdated, audioUrl }`.
  - Computes `actualTime = currentTime + (Date.now() - lastUpdated) / 1000` when `isPlaying`.
  - Seeks if local `audio.currentTime` drifts more than ~0.25s from `actualTime`.
  - Starts/stops audio based on `isPlaying`.
- **Resilience**
  - Reconnects WebSocket with simple retry loop on close.
  - On reconnect, requests latest state.
  - Handles case where no audio is uploaded yet by disabling play/pause buttons.
