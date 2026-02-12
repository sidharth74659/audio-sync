(function () {
  const audio = document.getElementById('audio');
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const timeDisplay = document.getElementById('timeDisplay');
  const connectionStatus = document.getElementById('connectionStatus');
  const playState = document.getElementById('playState');
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');

  let ws;
  let currentState = {
    isPlaying: false,
    currentTime: 0,
    lastUpdated: Date.now(),
    audioUrl: null,
  };

  let reconnectTimeout = null;

  function formatTime(seconds) {
    return (seconds || 0).toFixed(1) + 's';
  }

  function updateUiFromState() {
    const { isPlaying, currentTime, lastUpdated, audioUrl } = currentState;

    if (audioUrl && audio.src !== window.location.origin + audioUrl) {
      // Set audio source if available and not yet set
      audio.src = audioUrl;
    }

    // Compute actual time based on reference state
    let actualTime = currentTime;
    if (isPlaying) {
      const elapsed = (Date.now() - lastUpdated) / 1000;
      actualTime = currentTime + elapsed;
    }

    // Only seek if difference is noticeable to avoid choppy behavior
    if (!Number.isNaN(actualTime) && Math.abs(audio.currentTime - actualTime) > 0.25) {
      audio.currentTime = actualTime;
    }

    if (isPlaying && audio.paused && audio.src) {
      // Try to play if we should be playing
      audio.play().catch(() => {
        // Autoplay might be blocked; user can press play manually.
      });
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }

    timeDisplay.textContent = formatTime(audio.currentTime || actualTime || 0);
    playState.textContent = isPlaying ? 'playing' : 'stopped';
  }

  function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = protocol + '://' + window.location.host;
    ws = new WebSocket(url);

    connectionStatus.textContent = 'connecting…';

    ws.addEventListener('open', () => {
      connectionStatus.textContent = 'connected';
      // Request latest state on connect in case server did not push yet
      send({ type: 'request_state' });
    });

    ws.addEventListener('message', (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        return;
      }

      if (data.type === 'state' && data.state) {
        currentState = data.state;
        updateUiFromState();
      }
    });

    ws.addEventListener('close', () => {
      connectionStatus.textContent = 'disconnected – retrying…';
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(connect, 1500);
    });

    ws.addEventListener('error', () => {
      connectionStatus.textContent = 'error';
    });
  }

  function send(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Local user actions
  playBtn.addEventListener('click', () => {
    if (!audio.src) return;
    send({ type: 'play', currentTime: audio.currentTime || 0 });
  });

  pauseBtn.addEventListener('click', () => {
    if (!audio.src) return;
    send({ type: 'pause', currentTime: audio.currentTime || 0 });
  });

  // Show live time locally for smoother UI
  setInterval(() => {
    timeDisplay.textContent = formatTime(audio.currentTime || 0);
  }, 200);

  // Handle uploads
  uploadBtn.addEventListener('click', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      alert('Please choose an audio file first.');
      return;
    }

    const formData = new FormData();
    formData.append('audio', file);

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading…';

    fetch('/upload', {
      method: 'POST',
      body: formData,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
      })
      .then((data) => {
        if (data && data.audioUrl) {
          // Server will broadcast state, but apply immediately as well
          currentState = data.state || currentState;
          currentState.audioUrl = data.audioUrl;
          updateUiFromState();
        }
      })
      .catch((err) => {
        console.error(err);
        alert('Upload failed. Please try again.');
      })
      .finally(() => {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload';
      });
  });

  // Initial state: disable controls until audio is available
  function refreshControlState() {
    const hasAudio = !!audio.src;
    playBtn.disabled = !hasAudio;
    pauseBtn.disabled = !hasAudio;
  }

  // Monitor audio src changes
  const srcObserver = new MutationObserver(refreshControlState);
  srcObserver.observe(audio, { attributes: true, attributeFilter: ['src'] });

  audio.addEventListener('loadedmetadata', () => {
    refreshControlState();
  });

  audio.addEventListener('play', () => {
    // If user manually plays while server thinks paused, correct server
    if (!currentState.isPlaying) {
      send({ type: 'play', currentTime: audio.currentTime || 0 });
    }
  });

  audio.addEventListener('pause', () => {
    // If user manually pauses while server thinks playing, correct server
    if (currentState.isPlaying) {
      send({ type: 'pause', currentTime: audio.currentTime || 0 });
    }
  });

  // Kick off connection
  connect();

  refreshControlState();
})();
