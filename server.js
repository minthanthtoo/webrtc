const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', () => {
    const clients = Array.from(io.sockets.sockets.keys());
    const target = clients.find(id => id !== socket.id);
    if (target) {
      socket.emit('peer', target);
      io.to(target).emit('peer', socket.id);
    }
  });

  socket.on('signal', (data) => {
    io.to(data.target).emit('signal', {
      sender: socket.id,
      signal: data.signal,
    });
  });

  socket.on('disconnect', () => {
    io.emit('leave', socket.id);
  });
});

//http.listen(3000, () => console.log('Server running at http://localhost:3000'));
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));