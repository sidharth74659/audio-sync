const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const multer = require('multer');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// In-memory shared playback state
// isPlaying: whether playback is currently active
// currentTime: reference time in seconds
// lastUpdated: timestamp (ms since epoch) when state last changed
let playbackState = {
  isPlaying: false,
  currentTime: 0,
  lastUpdated: Date.now(),
  audioUrl: null,
};

// Multer setup for handling single audio upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.audio';
    cb(null, `audio-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage });

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Endpoint to upload a new audio file
app.post('/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const audioUrl = `/uploads/${req.file.filename}`;

  // Reset playback state when a new file is uploaded
  playbackState = {
    isPlaying: false,
    currentTime: 0,
    lastUpdated: Date.now(),
    audioUrl,
  };

  // Broadcast new audio URL and reset state to all clients
  broadcastState();

  res.json({ audioUrl, state: playbackState });
});

// WebSocket message types
// { type: 'play', currentTime }
// { type: 'pause', currentTime }
// { type: 'request_state' }

wss.on('connection', (ws) => {
  // When a new client connects, immediately send current state
  sendState(ws);

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (e) {
      console.error('Invalid JSON from client:', message.toString());
      return;
    }

    if (!data || !data.type) return;

    switch (data.type) {
      case 'play': {
        // Update reference time and mark as playing
        // currentTime is provided from the client at the moment play was pressed
        playbackState.isPlaying = true;
        playbackState.currentTime = typeof data.currentTime === 'number' ? data.currentTime : 0;
        playbackState.lastUpdated = Date.now();
        broadcastState();
        break;
      }
      case 'pause': {
        // Freeze playback at the sent time
        playbackState.isPlaying = false;
        playbackState.currentTime = typeof data.currentTime === 'number' ? data.currentTime : 0;
        playbackState.lastUpdated = Date.now();
        broadcastState();
        break;
      }
      case 'request_state': {
        sendState(ws);
        break;
      }
      default:
        break;
    }
  });
});

function broadcastState() {
  const payload = JSON.stringify({ type: 'state', state: playbackState });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function sendState(ws) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'state', state: playbackState }));
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
