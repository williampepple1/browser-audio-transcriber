// Content script for audio transcription support
// Prevent multiple injections
if (window.audioTranscriberLoaded) {
  console.log('Audio Transcriber content script already loaded');
} else {
  window.audioTranscriberLoaded = true;
  console.log('Audio Transcriber content script loaded');

  let mediaRecorder = null;
  let audioChunks = [];
  let recognition = null;
  let isRecordingActive = false;
  let recordingSessionId = 0;
  let recognitionRestartTimer = null;
  let startRecordingPromise = null;

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'startRecording':
        startRecording().then(sendResponse);
        return true; // Keep message channel open for async response

      case 'stopRecording':
        stopRecording().then(sendResponse);
        return true; // Keep message channel open for async response

      case 'recordingStarted':
        showRecordingIndicator();
        sendResponse({ success: true });
        break;

      case 'recordingStopped':
        hideRecordingIndicator();
        sendResponse({ success: true });
        break;

      case 'getAudioElements':
        sendResponse({ audioElements: getAudioElements() });
        break;

      case 'playAudio':
        playMediaElements();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  });

  async function startRecording() {
    if (isRecordingActive) {
      return { success: true };
    }

    if (startRecordingPromise) {
      return startRecordingPromise;
    }

    startRecordingPromise = startRecordingSession().finally(() => {
      startRecordingPromise = null;
    });

    return startRecordingPromise;
  }

  async function startRecordingSession() {
    const sessionId = ++recordingSessionId;

    try {
      clearRecognitionRestartTimer();
      stopRecognition();
      stopAudioCapture();

      if (!supportsSpeechRecognition()) {
        throw new Error('Speech recognition not supported');
      }

      isRecordingActive = true;

      await startAudioCapture();

      if (!isCurrentRecordingSession(sessionId)) {
        throw new Error('Recording was stopped before startup completed');
      }

      startRecognition(sessionId);

      console.log('Recording started successfully');
      return { success: true };

    } catch (error) {
      console.error('Error starting recording:', error);
      cleanupRecordingSession();
      return { success: false, error: error.message };
    }
  }

  async function stopRecording() {
    try {
      cleanupRecordingSession();
      console.log('Recording stopped successfully');
      return { success: true };

    } catch (error) {
      console.error('Error stopping recording:', error);
      return { success: false, error: error.message };
    }
  }

  function cleanupRecordingSession() {
    isRecordingActive = false;
    recordingSessionId++;
    clearRecognitionRestartTimer();
    stopRecognition();
    stopAudioCapture();
  }

  function startRecognition(sessionId) {
    if (!supportsSpeechRecognition()) {
      throw new Error('Speech recognition not supported');
    }

    if (!isCurrentRecordingSession(sessionId)) {
      return;
    }

    recognition = createSpeechRecognition(sessionId);
    recognition.start();
    console.log('Speech recognition started successfully');
  }

  function createSpeechRecognition(sessionId) {
    const speechRecognition = new webkitSpeechRecognition();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';

    speechRecognition.onresult = function(event) {
      if (!isCurrentRecordingSession(sessionId)) {
        return;
      }

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
          isFinal: true
        });
      }

      if (interimTranscript) {
        chrome.runtime.sendMessage({
          action: 'transcriptUpdate',
          transcript: interimTranscript,
          isFinal: false
        });
      }
    };

    speechRecognition.onerror = function(event) {
      console.error('Speech recognition error:', event.error);

      if (!isCurrentRecordingSession(sessionId)) {
        return;
      }

      if (event.error === 'no-speech') {
        scheduleRecognitionRestart(sessionId, 1000);
      } else if (event.error === 'network' || event.error === 'aborted') {
        scheduleRecognitionRestart(sessionId, 3000);
      }
    };

    speechRecognition.onend = function() {
      if (isCurrentRecordingSession(sessionId)) {
        scheduleRecognitionRestart(sessionId, 500);
      }
    };

    return speechRecognition;
  }

  function scheduleRecognitionRestart(sessionId, delay) {
    if (!isCurrentRecordingSession(sessionId)) {
      return;
    }

    clearRecognitionRestartTimer();

    recognitionRestartTimer = setTimeout(() => {
      recognitionRestartTimer = null;

      if (!isCurrentRecordingSession(sessionId)) {
        return;
      }

      try {
        stopRecognition();
        startRecognition(sessionId);
        console.log('Successfully restarted speech recognition');
      } catch (error) {
        console.error('Failed to restart recognition:', error);
        scheduleRecognitionRestart(sessionId, 2000);
      }
    }, delay);
  }

  function clearRecognitionRestartTimer() {
    if (recognitionRestartTimer) {
      clearTimeout(recognitionRestartTimer);
      recognitionRestartTimer = null;
    }
  }

  function stopRecognition() {
    if (!recognition) {
      return;
    }

    const currentRecognition = recognition;
    recognition = null;

    currentRecognition.onresult = null;
    currentRecognition.onerror = null;
    currentRecognition.onend = null;

    try {
      currentRecognition.stop();
    } catch (error) {
      console.log('Error stopping recognition:', error);
    }
  }

  function isCurrentRecordingSession(sessionId) {
    return isRecordingActive && recordingSessionId === sessionId;
  }

  function supportsSpeechRecognition() {
    return 'webkitSpeechRecognition' in window;
  }

// Start audio capture
async function startAudioCapture() {
  try {
    // Try to capture microphone audio (this will pick up audio from speakers)
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    // Set up media recorder
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    const recordedChunks = audioChunks;

    mediaRecorder.ondataavailable = function(event) {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = function() {
      const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
      console.log('Audio recording completed, size:', audioBlob.size);
    };

    mediaRecorder.start();
    return true;

  } catch (error) {
    console.error('Audio capture failed:', error);
    throw new Error('Audio capture failed: ' + error.message);
  }
}

  function stopAudioCapture() {
    if (!mediaRecorder) {
      audioChunks = [];
      return;
    }

    const recorder = mediaRecorder;
    mediaRecorder = null;

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }

    if (recorder.stream) {
      recorder.stream.getTracks().forEach(track => track.stop());
    }

    audioChunks = [];
  }

  function getAudioElements() {
    const audioElements = document.querySelectorAll('audio, video');

    return Array.from(audioElements).map(element => ({
      tagName: element.tagName,
      src: element.src,
      currentSrc: element.currentSrc,
      paused: element.paused,
      currentTime: element.currentTime,
      duration: element.duration
    }));
  }

  function playMediaElements() {
    const mediaElements = document.querySelectorAll('audio, video');

    mediaElements.forEach(element => {
      if (element.paused) {
        element.play().catch(error => console.log('Could not play element:', error));
      }
    });
  }

// Monitor for new audio/video elements being added to the page
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Check if the node itself is an audio/video element
        if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
          console.log('New audio/video element detected:', node);
        }
        
        // Check for audio/video elements within the node
        const audioElements = node.querySelectorAll ? node.querySelectorAll('audio, video') : [];
        audioElements.forEach(element => {
          console.log('New audio/video element detected:', element);
        });
      }
    });
  });
});

// Start observing the document for changes
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Add a visual indicator when recording is active
let recordingIndicator = null;

function showRecordingIndicator() {
  if (!recordingIndicator) {
    recordingIndicator = document.createElement('div');
    recordingIndicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 20px;
      height: 20px;
      background: #f44336;
      border-radius: 50%;
      z-index: 10000;
      animation: pulse 1.5s infinite;
      box-shadow: 0 0 10px rgba(244, 67, 54, 0.5);
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.1); }
        100% { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(recordingIndicator);
  }
}

function hideRecordingIndicator() {
  if (recordingIndicator) {
    recordingIndicator.remove();
    recordingIndicator = null;
  }
}

// Helper function to get all media streams on the page
function getAllMediaStreams() {
  const streams = [];
  
  // Get streams from audio/video elements
  const mediaElements = document.querySelectorAll('audio, video');
  mediaElements.forEach(element => {
    if (element.srcObject) {
      streams.push(element.srcObject);
    }
  });
  
  // Get streams from canvas elements (if they have audio)
  const canvasElements = document.querySelectorAll('canvas');
  canvasElements.forEach(canvas => {
    if (canvas.captureStream) {
      try {
        const stream = canvas.captureStream();
        if (stream.getAudioTracks().length > 0) {
          streams.push(stream);
        }
      } catch (e) {
        // Canvas might not support captureStream
      }
    }
  });
  
  return streams;
}

  // Expose helper functions to the page context
  window.audioTranscriberHelpers = {
    getAllMediaStreams,
    showRecordingIndicator,
    hideRecordingIndicator
  };
}