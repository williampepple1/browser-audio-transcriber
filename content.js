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

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startRecording':
      startRecording().then(sendResponse);
      return true; // Keep message channel open for async response

    case 'stopRecording':
      stopRecording().then(sendResponse);
      return true; // Keep message channel open for async response

    case 'getAudioElements':
      // Find all audio and video elements on the page
      const audioElements = document.querySelectorAll('audio, video');
      const audioInfo = Array.from(audioElements).map(element => ({
        tagName: element.tagName,
        src: element.src,
        currentSrc: element.currentSrc,
        paused: element.paused,
        currentTime: element.currentTime,
        duration: element.duration
      }));
      sendResponse({ audioElements: audioInfo });
      break;

    case 'playAudio':
      // Force play all audio/video elements (useful for some sites)
      const mediaElements = document.querySelectorAll('audio, video');
      mediaElements.forEach(element => {
        if (element.paused) {
          element.play().catch(e => console.log('Could not play element:', e));
        }
      });
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Start recording function
async function startRecording() {
  try {
    isRecordingActive = true;
    
    // Initialize speech recognition
    if (!initializeSpeechRecognition()) {
      throw new Error('Speech recognition not supported');
    }

    // Start speech recognition with error handling
    try {
      recognition.start();
    } catch (startError) {
      console.error('Failed to start recognition:', startError);
      // If recognition is already started, try to stop and restart
      if (startError.message.includes('already started')) {
        try {
          recognition.stop();
          await new Promise(resolve => setTimeout(resolve, 500));
          recognition.start();
        } catch (restartError) {
          console.error('Failed to restart recognition:', restartError);
          throw new Error('Could not start speech recognition');
        }
      } else {
        throw startError;
      }
    }

    // Try to capture audio from the page
    await startAudioCapture();

    console.log('Recording started successfully');
    return { success: true };

  } catch (error) {
    console.error('Error starting recording:', error);
    isRecordingActive = false;
    return { success: false, error: error.message };
  }
}

// Stop recording function
async function stopRecording() {
  try {
    isRecordingActive = false;

    if (recognition) {
      recognition.stop();
      recognition = null;
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    // Stop all tracks in the stream
    if (mediaRecorder && mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }

    console.log('Recording stopped successfully');
    return { success: true };

  } catch (error) {
    console.error('Error stopping recording:', error);
    return { success: false, error: error.message };
  }
}

// Initialize speech recognition
function initializeSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window)) {
    console.error('Speech recognition not supported');
    return false;
  }

  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = function(event) {
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

    // Send final results (these will be accumulated)
    if (finalTranscript) {
      chrome.runtime.sendMessage({
        action: 'transcriptUpdate',
        transcript: finalTranscript,
        isFinal: true
      });
    }

    // Send interim results (these will be shown in real-time but not accumulated)
    if (interimTranscript) {
      chrome.runtime.sendMessage({
        action: 'transcriptUpdate',
        transcript: interimTranscript,
        isFinal: false
      });
    }
  };

  recognition.onerror = function(event) {
    console.error('Speech recognition error:', event.error);
    
    // Handle specific errors
    if (event.error === 'no-speech') {
      // Restart recognition after a short delay for no-speech errors
      if (isRecordingActive) {
        setTimeout(() => {
          try {
            if (recognition && isRecordingActive) {
              recognition.start();
            }
          } catch (e) {
            console.error('Failed to restart recognition after no-speech error:', e);
          }
        }, 1000);
      }
    } else if (event.error === 'network') {
      // For network errors, try to restart after a longer delay
      if (isRecordingActive) {
        setTimeout(() => {
          try {
            if (recognition && isRecordingActive) {
              recognition.start();
            }
          } catch (e) {
            console.error('Failed to restart recognition after network error:', e);
          }
        }, 3000);
      }
    }
  };

  recognition.onend = function() {
    // Only restart if still recording and recognition is not in an error state
    if (isRecordingActive && recognition) {
      // Add a small delay to prevent immediate restart issues
      setTimeout(() => {
        try {
          if (isRecordingActive && recognition) {
            recognition.start();
          }
        } catch (e) {
          console.error('Failed to restart recognition:', e);
          // If restart fails, try to create a new instance
          if (isRecordingActive) {
            console.log('Creating new recognition instance...');
            recognition = null;
            initializeSpeechRecognition();
            if (recognition) {
              recognition.start();
            }
          }
        }
      }, 100);
    }
  };

  return true;
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

    mediaRecorder.ondataavailable = function(event) {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = function() {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log('Audio recording completed, size:', audioBlob.size);
    };

    mediaRecorder.start();
    return true;

  } catch (error) {
    console.error('Audio capture failed:', error);
    return false;
  }
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

// Listen for recording status updates
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'recordingStarted') {
    showRecordingIndicator();
  } else if (request.action === 'recordingStopped') {
    hideRecordingIndicator();
  }
});

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