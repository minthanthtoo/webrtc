const socket = io();
let localStream;
let peerConnection;
// const config = { iceServers: [] }; // No STUN/TURN
const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

const localVideo = document.getElementById('local');
const remoteVideo = document.getElementById('remote');

(async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
  socket.emit('join');
})();

socket.on('peer', async (peerId) => {
  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      socket.emit('signal', { target: peerId, signal: { candidate } });
    }
  };

  peerConnection.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
  };

  if (socket.id < peerId) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { target: peerId, signal: { sdp: offer } });
  }

  socket.on('signal', async ({ signal }) => {
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
});
// peerConnection.ontrack = (e) => {
//   remoteVideo.srcObject = e.streams[0];
// };