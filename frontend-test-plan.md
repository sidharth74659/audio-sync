## Frontend Test Plan

### Browser Sync Scenarios

- [ ] **Initial upload and single client playback**
  - Start server, open `http://localhost:3000`.
  - Upload an audio file and click **Play**.
  - Verify audio plays and time display updates.

- [ ] **Two-client synchronization (join after upload, before play)**
  - With Browser A open (audio uploaded, paused), open Browser B at same URL.
  - Verify both show same audio loaded and controls enabled.
  - Click **Play** in Browser A and confirm Browser B also plays from same start time.

- [ ] **Two-client synchronization (join mid-play)**
  - In Browser A, upload audio and start playing.
  - After a few seconds, open Browser B.
  - Verify Browser B auto-loads audio and jumps near the same timestamp as Browser A.
  - Confirm small drift only (sub-second expected).

- [ ] **Pause propagation**
  - While both browsers playing, click **Pause** in Browser A.
  - Confirm Browser B pauses within a short delay and times are approximately equal.

- [ ] **Play propagation from secondary client**
  - From paused state, click **Play** in Browser B.
  - Confirm Browser A resumes playback in sync.

- [ ] **Manual play/pause vs. server state**
  - Manually click the built-in `<audio>` play button in one browser when server thinks paused.
  - Confirm server corrects state and other client begins playing as well.

### Connection & Error Handling

- [ ] **WebSocket reconnect**
  - Start playback in both browsers.
  - Stop the server, observe UI connection status changes.
  - Restart the server and verify clients reconnect and request the latest state.

- [ ] **No audio uploaded state**
  - Load page without uploading audio.
  - Verify play/pause buttons are disabled and no errors are shown.

- [ ] **New upload while clients connected**
  - With both browsers connected, upload a new audio file in Browser A.
  - Confirm both browsers switch to new track, reset time to 0, and remain synchronized.
