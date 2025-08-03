// Background service worker for audio transcription
let isRecording = false;
let currentTranscript = '';

// Start recording audio from the active tab
async function startRecording() {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab found');
    }

    // Send message to content script to start recording
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'startRecording' });
    
    if (response && response.success) {
      isRecording = true;
      currentTranscript = '';
      console.log('Recording started successfully');
      return { success: true };
    } else {
      throw new Error(response?.error || 'Failed to start recording');
    }

  } catch (error) {
    console.error('Error starting recording:', error);
    return { success: false, error: error.message };
  }
}

// Stop recording
async function stopRecording() {
  try {
    isRecording = false;

    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      // Send message to content script to stop recording
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'stopRecording' });
      
      if (!response || !response.success) {
        console.warn('Failed to stop recording in content script');
      }
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

    case 'transcriptUpdate':
      // Handle transcript updates from content script
      currentTranscript += request.transcript;
      // Forward to popup if it's open
      chrome.runtime.sendMessage({
        action: 'transcriptUpdate',
        transcript: currentTranscript
      });
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