const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const os = require('os');
const multer = require('multer');
const fs = require('fs');

// Function to create a unique filename with the original extension
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const uniqueName = `${baseName}-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Array to store old messages
const messageHistory = [];

// Handle file uploads
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  // Create a file message object
  const fileMessage = {
    type: 'file',
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
  };

  // Store the file message in the history
  messageHistory.push(fileMessage);

  // Broadcast the file message to all clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(fileMessage));
    }
  });

  res.status(200).send('File uploaded successfully.');
});

wss.on('connection', (ws) => {
  console.log('A new client connected');

  // Send the message history to the new client
  messageHistory.forEach((message) => {
    ws.send(JSON.stringify(message));
  });

  // Send a welcome message to the new client
  ws.send(JSON.stringify({ type: 'text', content: 'Welcome to the WebSocket server!' }));

  ws.on('message', (message) => {
    const messageString = message.toString();
    console.log('Received:', messageString);

    // Parse the message
    const parsedMessage = JSON.parse(messageString);

    // Store the new message in the history
    messageHistory.push(parsedMessage);

    // Broadcast the message to all clients, including the sender
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Function to get local network IP address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const PORT = 8080;
const LOCAL_IP = getLocalIp();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is listening on http://${LOCAL_IP}:${PORT}`);
});
