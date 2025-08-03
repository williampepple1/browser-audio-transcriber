// Background service worker for audio transcription
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let currentTranscript = '';
let recognition = null;

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

    if (finalTranscript) {
      currentTranscript += finalTranscript;
      // Send update to popup
      chrome.runtime.sendMessage({
        action: 'transcriptUpdate',
        transcript: currentTranscript
      });
    }
  };

  recognition.onerror = function(event) {
    console.error('Speech recognition error:', event.error);
  };

  recognition.onend = function() {
    if (isRecording) {
      // Restart recognition if still recording
      recognition.start();
    }
  };

  return true;
}

// Start recording audio from the active tab
async function startRecording() {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab found');
    }

    // Request tab capture
    const stream = await chrome.tabCapture.capture({
      audio: true,
      video: false
    });

    if (!stream) {
      throw new Error('Failed to capture tab audio');
    }

    // Initialize speech recognition
    if (!initializeSpeechRecognition()) {
      throw new Error('Speech recognition not supported');
    }

    // Start speech recognition
    recognition.start();

    // Set up media recorder for backup audio recording
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = function(event) {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = function() {
      // Create audio blob for potential future use
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log('Audio recording completed, size:', audioBlob.size);
    };

    mediaRecorder.start();
    isRecording = true;
    currentTranscript = '';

    console.log('Recording started successfully');
    return { success: true };

  } catch (error) {
    console.error('Error starting recording:', error);
    return { success: false, error: error.message };
  }
}

// Stop recording
async function stopRecording() {
  try {
    isRecording = false;

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
    return { success: true, transcript: currentTranscript };

  } catch (error) {
    console.error('Error stopping recording:', error);
    return { success: false, error: error.message };
  }
}

// Get current status
function getStatus() {
  return {
    isRecording: isRecording,
    transcript: currentTranscript
  };
}

// Message listener for communication with popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startRecording':
      startRecording().then(sendResponse);
      return true; // Keep message channel open for async response

    case 'stopRecording':
      stopRecording().then(sendResponse);
      return true; // Keep message channel open for async response

    case 'getStatus':
      sendResponse(getStatus());
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Audio Transcriber extension installed');
});

// Handle tab updates to ensure proper audio capture
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isRecording) {
    console.log('Tab updated, ensuring recording continues');
  }
}); 