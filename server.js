const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.get('/room/:id', (req, res) => {
  res.sendFile(__dirname + '/public/lobby.html');
});

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a named room (e.g., doctor-patient session)
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const target = clients.find(id => id !== socket.id);
    if (target) {
      socket.emit('peer', target);
      io.to(target).emit('peer', socket.id);
    }
  });

  // Relay WebRTC signaling
  socket.on('signal', (data) => {
    io.to(data.target).emit('signal', {
      sender: socket.id,
      signal: data.signal,
    });
  });

  // Sync mic/cam toggle status
  socket.on('media-toggle', (data) => {
    socket.to(data.target).emit('media-toggle', {
      sender: socket.id,
      kind: data.kind,
      enabled: data.enabled
    });
  });

  // Notify others on disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    socket.broadcast.emit('leave', socket.id);
  });

  socket.on('leave', (targetId) => {
    socket.to(targetId).emit('leave', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));