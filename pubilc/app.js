const socket = io();

const postForm = document.getElementById('post-form');
const boardGrid = document.getElementById('board-grid');
const onlineBadge = document.getElementById('online-badge');
const clearBtn = document.getElementById('clear-btn');

// Remember student name & roll number across refreshes
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('studentName')) {
    document.getElementById('studentName').value = localStorage.getItem('studentName');
  }
  if (localStorage.getItem('rollNo')) {
    document.getElementById('rollNo').value = localStorage.getItem('rollNo');
  }
});

// Prevent XSS by safely creating DOM nodes
function createCardElement(post) {
  const card = document.createElement('div');
  card.className = 'note-card';
  card.style.backgroundColor = post.color || '#fef08a';

  const header = document.createElement('div');
  header.className = 'note-header';
  header.textContent = `${post.studentName} (${post.rollNo})`;

  const catBadge = document.createElement('span');
  catBadge.textContent = post.category;
  header.appendChild(catBadge);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.textContent = post.message;

  const footer = document.createElement('div');
  footer.className = 'note-footer';
  footer.textContent = `Logged to Drive • ${post.timestamp}`;

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  return card;
}

// Submit new note
postForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const studentName = document.getElementById('studentName').value.trim();
  const rollNo = document.getElementById('rollNo').value.trim();
  const category = document.getElementById('category').value;
  const color = document.getElementById('cardColor').value;
  const messageInput = document.getElementById('message');
  const message = messageInput.value.trim();

  if (!studentName || !rollNo || !message) return;

  localStorage.setItem('studentName', studentName);
  localStorage.setItem('rollNo', rollNo);

  socket.emit('new-post', { studentName, rollNo, category, color, message });
  messageInput.value = '';
  messageInput.focus();
});

// Instructor clear board button
clearBtn.addEventListener('click', () => {
  const pin = prompt('Enter Instructor Admin PIN to clear the screen (Drive logs remain safe):');
  if (pin) {
    socket.emit('clear-board', pin);
  }
});

// Socket listeners
socket.on('user-count', (count) => {
  onlineBadge.textContent = `🟢 ${count} Student${count === 1 ? '' : 's'} Online`;
});

socket.on('initial-posts', (posts) => {
  boardGrid.innerHTML = '';
  posts.forEach((post) => {
    boardGrid.appendChild(createCardElement(post));
  });
});

socket.on('broadcast-post', (post) => {
  boardGrid.prepend(createCardElement(post));
});

socket.on('board-cleared', () => {
  boardGrid.innerHTML = '';
});
