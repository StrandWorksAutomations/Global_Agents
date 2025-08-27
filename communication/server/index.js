import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const wss = new WebSocketServer({ port: 8081 });

const agents = new Map();
const messages = [];
const thoughtStreams = new Map();

const upload = multer({ 
  dest: path.join(__dirname, '../../uploads'),
  limits: { fileSize: 100 * 1024 * 1024 }
});

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

app.post('/api/register', (req, res) => {
  const { agentId, name, type, parentId } = req.body;
  agents.set(agentId, {
    id: agentId,
    name,
    type,
    parentId,
    status: 'active',
    connectedAt: new Date()
  });
  
  io.emit('agent-registered', { agentId, name, type, parentId });
  res.json({ success: true, agentId });
});

app.post('/api/message', (req, res) => {
  const message = {
    id: uuidv4(),
    ...req.body,
    timestamp: new Date()
  };
  
  messages.push(message);
  io.emit('message', message);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'message', data: message }));
    }
  });
  
  res.json({ success: true, messageId: message.id });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const { agentId, recipientId, messageText } = req.body;
  const file = req.file;
  
  const fileInfo = {
    id: uuidv4(),
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: `/uploads/${file.filename}`
  };
  
  const message = {
    id: uuidv4(),
    from: agentId,
    to: recipientId,
    text: messageText || 'File shared',
    file: fileInfo,
    timestamp: new Date()
  };
  
  messages.push(message);
  io.emit('message', message);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'file-shared', data: message }));
    }
  });
  
  res.json({ success: true, messageId: message.id, file: fileInfo });
});

app.post('/api/thoughts', (req, res) => {
  const { agentId, thought } = req.body;
  
  if (!thoughtStreams.has(agentId)) {
    thoughtStreams.set(agentId, []);
  }
  
  const thoughtEntry = {
    id: uuidv4(),
    agentId,
    thought,
    timestamp: new Date()
  };
  
  thoughtStreams.get(agentId).push(thoughtEntry);
  
  io.emit('thought-stream', thoughtEntry);
  
  res.json({ success: true, thoughtId: thoughtEntry.id });
});

app.get('/api/agents', (req, res) => {
  res.json(Array.from(agents.values()));
});

app.get('/api/messages', (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  res.json(messages.slice(offset, offset + parseInt(limit)));
});

app.get('/api/thoughts/:agentId', (req, res) => {
  const { agentId } = req.params;
  const thoughts = thoughtStreams.get(agentId) || [];
  res.json(thoughts);
});

io.on('connection', (socket) => {
  console.log('Client connected to Socket.IO');
  
  socket.emit('initial-data', {
    agents: Array.from(agents.values()),
    recentMessages: messages.slice(-50)
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from Socket.IO');
  });
});

wss.on('connection', (ws) => {
  console.log('Agent connected via WebSocket');
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'register':
          ws.agentId = message.agentId;
          agents.set(message.agentId, {
            ...message,
            ws,
            status: 'active'
          });
          break;
          
        case 'execute':
          const targetAgent = agents.get(message.targetId);
          if (targetAgent && targetAgent.ws) {
            targetAgent.ws.send(JSON.stringify({
              type: 'execute-command',
              command: message.command,
              fromAgent: message.fromAgent
            }));
          }
          break;
          
        default:
          break;
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });
  
  ws.on('close', () => {
    if (ws.agentId && agents.has(ws.agentId)) {
      agents.get(ws.agentId).status = 'disconnected';
      io.emit('agent-disconnected', ws.agentId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:8081`);
});