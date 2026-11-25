require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { google } = require('googleapis');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
});

app.use(express.static(path.join(__dirname, 'public')));

// In-memory store for current session posts (last 200 posts)
let boardPosts = [];
let connectedUsers = 0;

// Google Sheets (Drive) Setup
let sheetsClient = null;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function initGoogleSheets() {
  try {
    if (!process.env.GOOGLE_CREDENTIALS_JSON || !SHEET_ID) {
      console.warn('⚠️ Google Drive credentials or Sheet ID missing. Running in memory-only mode.');
      return;
    }

    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    console.log('✅ Connected to Google Drive (Sheets API) for logging.');
  } catch (err) {
    console.error('❌ Failed to initialize Google Sheets:', err.message);
  }
}

async function logToDrive(post) {
  if (!sheetsClient || !SHEET_ID) return;
  try {
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[post.timestamp, post.studentName, post.rollNo, post.category, post.message]],
      },
    });
  } catch (err) {
    console.error('❌ Error writing log to Google Drive:', err.message);
  }
}

io.on('connection', (socket) => {
  connectedUsers++;
  io.emit('user-count', connectedUsers);

  // Send existing board posts to newly connected student
  socket.emit('initial-posts', boardPosts);

  // Handle new sticky note / post from student
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

    // Broadcast instantly to all 50+ students
    io.emit('broadcast-post', post);

    // Log asynchronously to Google Drive
    await logToDrive(post);
  });

  // Instructor clear board action (protected by admin PIN)
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
initGoogleSheets().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Live Board Server running on port ${PORT}`);
  });
});
