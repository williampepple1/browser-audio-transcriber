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

    // Check if we can inject scripts on this tab
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('Cannot record on Chrome system pages. Please navigate to a regular webpage.');
    }

    // First, ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (injectionError) {
      console.log('Content script already injected or injection failed:', injectionError);
    }

    // Wait a moment for the script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send message to content script to start recording
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'startRecording' });
      
      if (response && response.success) {
        isRecording = true;
        currentTranscript = '';
        console.log('Recording started successfully');
        return { success: true };
      } else {
        throw new Error(response?.error || 'Failed to start recording');
      }
    } catch (messageError) {
      console.error('Failed to communicate with content script:', messageError);
      throw new Error('Could not start recording. Please refresh the page and try again.');
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
      try {
        // Send message to content script to stop recording
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'stopRecording' });
        
        if (!response || !response.success) {
          console.warn('Failed to stop recording in content script');
        }
      } catch (messageError) {
        console.warn('Could not send stop message to content script:', messageError);
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
  console.log('Status requested - isRecording:', isRecording, 'transcript length:', currentTranscript.length);
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