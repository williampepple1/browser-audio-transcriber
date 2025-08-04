// offscreen.js
let recognition;
let isRecording = false;
let audioContext;
let streamSource;

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'start-recording') {
    if (isRecording) {
      console.log('Recording is already in progress.');
      sendResponse({ success: false, error: 'Recording already in progress.' });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: request.target,
          },
        },
      });

      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      streamSource = audioContext.createMediaStreamSource(stream);
      const destination = audioContext.createMediaStreamDestination();
      streamSource.connect(destination);

      startSpeechRecognition();
      isRecording = true;
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error starting recording in offscreen document:', error);
      sendResponse({ success: false, error: error.message });
    }
  } else if (request.action === 'stop-recording') {
    if (recognition) {
      recognition.stop();
    }
    if (streamSource) {
        streamSource.mediaStream.getTracks().forEach(track => track.stop());
        streamSource = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    isRecording = false;
    sendResponse({ success: true });
  }
  return true;
});

function startSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window)) {
    console.error('Speech recognition not supported in offscreen document.');
    return;
  }

  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      chrome.runtime.sendMessage({
        action: 'transcriptUpdate',
        transcript: finalTranscript,
        isFinal: true,
      });
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (isRecording) {
        // Automatically try to restart on error
        setTimeout(() => {
            if (isRecording) {
                try {
                    recognition.start();
                } catch(e) {
                    console.error("Failed to restart recognition", e);
                }
            }
        }, 1000);
    }
  };

  recognition.onend = () => {
    if (isRecording) {
      setTimeout(() => {
        if (isRecording) {
            try {
                recognition.start();
            } catch(e) {
                console.error("Failed to restart recognition on end", e);
            }
        }
      }, 100);
    }
  };

  recognition.start();
}
