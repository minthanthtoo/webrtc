const previewAllowed = localStorage.getItem('previewAllowed') === 'true';
if (!previewAllowed) {
  alert('Please join from the lobby first.');
  window.location.href = '/login.html'; // or /room/abc
}


const role = localStorage.getItem('role') || 'guest';
const roomId = localStorage.getItem('roomId') || 'room-default';
document.getElementById('roleLabel').textContent = `You are a ${role.toUpperCase()}`;

const socket = io();
let localStream;
let peerConnection;
let peerId;
const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const localVideo = document.getElementById('local');
const remoteVideo = document.getElementById('remote');

// Join a named room
//const roomId = "room-123"; // Replace with dynamic ID later
socket.emit('join-room', roomId);

// Get camera/mic
(async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
})();

// Receive peer to connect
socket.on('peer', async (id) => {
  peerId = id;
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      socket.emit('signal', { target: peerId, signal: { candidate } });
    }
  };

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  // Only one peer sends the offer
  if (socket.id < peerId) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { target: peerId, signal: { sdp: offer } });
  }
});

// Receive signaling data
socket.on('signal', async ({ signal }) => {
  if (!peerConnection) return;

  if (signal.sdp) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    if (signal.sdp.type === 'offer') {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal', { target: peerId, signal: { sdp: answer } });
    }
  }

  if (signal.candidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
  }
});

// Media sync events
socket.on('media-toggle', ({ kind, enabled }) => {
  console.log(`Remote ${kind} is now ${enabled ? 'on' : 'off'}`);
  // Update UI icon if needed
});

// Disconnect handling
socket.on('leave', (id) => {
  if (peerId === id) {
    alert("The other person has left the call.");
    if (peerConnection) peerConnection.close();
    remoteVideo.srcObject = null;
  }
});

// UI controls for mic/cam toggle
document.addEventListener('DOMContentLoaded', () => {
  const muteBtn = document.createElement('button');
  muteBtn.textContent = 'Toggle Mic';
  document.body.appendChild(muteBtn);

  const camBtn = document.createElement('button');
  camBtn.textContent = 'Toggle Video';
  document.body.appendChild(camBtn);

  muteBtn.onclick = () => {
    const track = localStream.getAudioTracks()[0];
    track.enabled = !track.enabled;
    socket.emit('media-toggle', {
      target: peerId,
      kind: 'mic',
      enabled: track.enabled
    });
  };

  camBtn.onclick = () => {
    const track = localStream.getVideoTracks()[0];
    track.enabled = !track.enabled;
    socket.emit('media-toggle', {
      target: peerId,
      kind: 'video',
      enabled: track.enabled
    });
  };
});