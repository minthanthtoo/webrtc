const previewAllowed = localStorage.getItem('previewAllowed') === 'true';
if (!previewAllowed) {
  alert('Please join from the lobby first.');
  window.location.href = '/login.html';
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
const statusDiv = document.getElementById('status');
statusDiv.textContent = 'Waiting for peer to join...';

// UI Buttons
const toggleMicBtn = document.getElementById('toggleMic');
const toggleCamBtn = document.getElementById('toggleCam');

// Utility: update button class state
function updateButtonState(button, isEnabled) {
  button.classList.toggle('active', isEnabled);
  button.classList.toggle('disabled', !isEnabled);
  button.setAttribute('aria-pressed', isEnabled.toString());
}

// Join a named room
socket.emit('join-room', roomId);

// Get camera/mic
(async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  // Set initial button state
  const micTrack = localStream.getAudioTracks()[0];
  if (micTrack) updateButtonState(toggleMicBtn, micTrack.enabled);

  const camTrack = localStream.getVideoTracks()[0];
  if (camTrack) updateButtonState(toggleCamBtn, camTrack.enabled);
})();

// Socket: on peer found
socket.on('peer', async (id) => {
  peerId = id;

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

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
    statusDiv.textContent = 'Call Connected!';
  };

  // Send offer if first
  if (socket.id < peerId) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { target: peerId, signal: { sdp: offer } });
  }
});

// Socket: signaling received
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

// Socket: media toggle from remote
socket.on('media-toggle', ({ kind, enabled }) => {
  const msg = `Remote ${kind} is ${enabled ? 'ON' : 'OFF'}`;
  console.log(msg);
  statusDiv.textContent = msg;
});

// Socket: peer disconnected
socket.on('leave', (id) => {
  if (peerId === id) {
    if (peerConnection) peerConnection.close();
    peerConnection = null;
    remoteVideo.srcObject = null;
    statusDiv.textContent = 'Peer disconnected';
    alert("The other person has left the call.");
  }
});

// Button: mic toggle
toggleMicBtn.onclick = () => {
  const track = localStream?.getAudioTracks()[0];
  if (!track) return alert("Mic not ready");

  track.enabled = !track.enabled;
  updateButtonState(toggleMicBtn, track.enabled);

  socket.emit('media-toggle', {
    target: peerId,
    kind: 'mic',
    enabled: track.enabled
  });
};

// Button: cam toggle
toggleCamBtn.onclick = () => {
  const track = localStream?.getVideoTracks()[0];
  if (!track) return alert("Camera not ready");

  track.enabled = !track.enabled;
  updateButtonState(toggleCamBtn, track.enabled);

  socket.emit('media-toggle', {
    target: peerId,
    kind: 'video',
    enabled: track.enabled
  });
};

// Button: end call
const endBtn = document.getElementById('endCall');
if (endBtn) {
  endBtn.onclick = () => {
    if (peerConnection) peerConnection.close();
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    location.href = '/login.html';
  };
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  localStorage.removeItem('previewAllowed');
});