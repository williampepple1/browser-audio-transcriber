// Background service worker for audio transcription
let isRecording = false;
let currentTranscript = '';
let recordingOperation = Promise.resolve();

function runRecordingOperation(operation) {
  const nextOperation = recordingOperation.catch(() => {}).then(operation);
  recordingOperation = nextOperation.catch(() => {});
  return nextOperation;
}

function setStoredState(state) {
  return chrome.storage.local.set(state);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    throw new Error('No active tab found');
  }

  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    throw new Error('Cannot record on Chrome system pages. Please navigate to a regular webpage.');
  }

  return tab;
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (injectionError) {
    console.log('Content script already injected or injection failed:', injectionError);
  }

  // Give the content script listener a short moment to finish registering.
  await new Promise(resolve => setTimeout(resolve, 100));
}

// Start recording audio from the active tab
async function startRecording() {
  try {
    if (isRecording) {
      return { success: true };
    }

    const tab = await getActiveTab();
    await ensureContentScript(tab.id);

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'startRecording' });
    } catch (messageError) {
      console.error('Failed to communicate with content script:', messageError);
      throw new Error('Could not start recording. Please refresh the page and try again.');
    }

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to start recording');
    }

    isRecording = true;
    currentTranscript = '';

    await setStoredState({
      currentTranscript: '',
      isFinal: true,
      isRecording: true
    });

    await chrome.tabs.sendMessage(tab.id, { action: 'recordingStarted' }).catch(() => {});

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
    if (!isRecording) {
      await setStoredState({
        currentTranscript: currentTranscript,
        isFinal: true,
        isRecording: false
      });

      return { success: true, transcript: currentTranscript };
    }

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

        await chrome.tabs.sendMessage(tab.id, { action: 'recordingStopped' }).catch(() => {});
      } catch (messageError) {
        console.warn('Could not send stop message to content script:', messageError);
      }
    }

    console.log('Recording stopped successfully');

    await setStoredState({
      currentTranscript: currentTranscript,
      isFinal: true,
      isRecording: false
    });

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
      runRecordingOperation(startRecording).then(sendResponse);
      return true; // Keep message channel open for async response

    case 'stopRecording':
      runRecordingOperation(stopRecording).then(sendResponse);
      return true; // Keep message channel open for async response

    case 'getStatus':
      sendResponse(getStatus());
      break;
      
    case 'clearTranscript':
      clearTranscript().then(sendResponse);
      return true;

    case 'transcriptUpdate':
      handleTranscriptUpdate(request).catch(error => {
        console.error('Failed to handle transcript update:', error);
      });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

async function clearTranscript() {
  currentTranscript = '';
  isRecording = false;

  await setStoredState({
    currentTranscript: '',
    isFinal: true,
    isRecording: false
  });

  console.log('Transcript cleared from background script');
  return { success: true };
}

async function handleTranscriptUpdate(request) {
  // Only accumulate final results to avoid duplicates.
  if (!request.isFinal) {
    return;
  }

  currentTranscript += request.transcript;

  await setStoredState({
    currentTranscript: currentTranscript,
    isFinal: true,
    isRecording: isRecording
  });

  try {
    await chrome.runtime.sendMessage({
      action: 'transcriptUpdate',
      transcript: currentTranscript,
      isFinal: true
    });
  } catch (e) {
    // Popup might not be open, that's okay
  }
}

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