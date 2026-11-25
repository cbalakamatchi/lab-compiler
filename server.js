require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store for current session posts (last 200 posts)
let boardPosts = [];
let connectedUsers = 0;

// Google Sheet Webhook URL from .env
const WEBHOOK_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL;

async function logToDrive(post) {
  if (!WEBHOOK_URL) {
    console.warn('⚠️ GOOGLE_SHEET_WEBHOOK_URL missing in .env. Post not logged to Sheet.');
    return;
  }
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(post),
      redirect: 'follow',
    });
    const result = await response.text();
    if (result !== 'OK') {
      console.warn('⚠️ Google Sheet response:', result);
    }
  } catch (err) {
    console.error('❌ Error writing log to Google Sheet:', err.message);
  }
}

// ==========================================================
// PASTE YOUR ORIGINAL LAB COMPILER ROUTES BELOW THIS LINE
// ==========================================================



// ==========================================================

io.on('connection', (socket) => {
  connectedUsers++;
  io.emit('user-count', connectedUsers);
  socket.emit('initial-posts', boardPosts);

  socket.on('new-post', async (data) => {
    const cleanName = String(data.studentName || 'Anonymous').trim().slice(0, 40);
    const cleanRoll = String(data.rollNo || 'N/A').trim().slice(0, 20);
    const cleanCategory = String(data.category || 'Idea').trim().slice(0, 20);
    const cleanMessage = String(data.message || '').trim().slice(0, 500);

    if (!cleanMessage) return;

    const post = {
      id: Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      studentName: cleanName,
      rollNo: cleanRoll,
      category: cleanCategory,
      message: cleanMessage,
      color: data.color || '#fef08a',
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    };

    boardPosts.unshift(post);
    if (boardPosts.length > 200) boardPosts.pop();

    io.emit('broadcast-post', post);
    await logToDrive(post);
  });

  socket.on('clear-board', (adminPin) => {
    const validPin = process.env.ADMIN_PIN || '1234';
    if (adminPin === validPin) {
      boardPosts = [];
      io.emit('board-cleared');
    }
  });

  socket.on('disconnect', () => {
    connectedUsers = Math.max(0, connectedUsers - 1);
    io.emit('user-count', connectedUsers);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(WEBHOOK_URL ? '✅ Google Sheet Webhook active.' : '⚠️ Running in memory-only mode (no Webhook URL).');
});
