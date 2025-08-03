// Content script for audio transcription support
console.log('Audio Transcriber content script loaded');

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
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

// Monitor for new audio/video elements being added to the page
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const audioElements = node.querySelectorAll ? node.querySelectorAll('audio, video') : [];
        if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
          audioElements.push(node);
        }
        
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