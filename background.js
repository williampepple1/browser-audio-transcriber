// Background service worker for audio transcription
let isRecording = false;
let currentTranscript = '';
let recordingTabId = null;
let recordingOperation = Promise.resolve();

async function restoreState() {
  const result = await chrome.storage.local.get(['currentTranscript', 'isRecording', 'recordingTabId']);
  isRecording = result.isRecording || false;
  currentTranscript = result.currentTranscript || '';
  recordingTabId = result.recordingTabId || null;

  if (isRecording && recordingTabId) {
    try {
      const tab = await chrome.tabs.get(recordingTabId);
      if (!tab) {
        await resetRecordingState();
      }
    } catch {
      await resetRecordingState();
    }
  }
}

async function resetRecordingState() {
  isRecording = false;
  recordingTabId = null;
  await setStoredState({ isRecording: false, recordingTabId: null });
}

restoreState();

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

  await new Promise(resolve => setTimeout(resolve, 100));
}

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
    recordingTabId = tab.id;

    await setStoredState({
      currentTranscript: '',
      isFinal: true,
      isRecording: true,
      recordingTabId: tab.id
    });

    await chrome.tabs.sendMessage(tab.id, { action: 'recordingStarted' }).catch(() => {});

    console.log('Recording started successfully on tab', tab.id);
    return { success: true };

  } catch (error) {
    console.error('Error starting recording:', error);
    return { success: false, error: error.message };
  }
}

async function stopRecording() {
  try {
    if (!isRecording) {
      await setStoredState({
        currentTranscript: currentTranscript,
        isFinal: true,
        isRecording: false,
        recordingTabId: null
      });

      return { success: true, transcript: currentTranscript };
    }

    isRecording = false;
    const tabId = recordingTabId;
    recordingTabId = null;

    if (tabId) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, { action: 'stopRecording' });

        if (!response || !response.success) {
          console.warn('Failed to stop recording in content script');
        }

        await chrome.tabs.sendMessage(tabId, { action: 'recordingStopped' }).catch(() => {});
      } catch (messageError) {
        console.warn('Could not send stop message to content script:', messageError);
      }
    }

    console.log('Recording stopped successfully');

    await setStoredState({
      currentTranscript: currentTranscript,
      isFinal: true,
      isRecording: false,
      recordingTabId: null
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
  recordingTabId = null;

  await setStoredState({
    currentTranscript: '',
    isFinal: true,
    isRecording: false,
    recordingTabId: null
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

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === recordingTabId) {
    console.log('Recording tab was closed, stopping recording');
    isRecording = false;
    recordingTabId = null;
    setStoredState({ isRecording: false, recordingTabId: null });
  }
});