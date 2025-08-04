// background.js

let isRecording = false;
let currentTranscript = '';
let targetTabId = null;

const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';

// A function to setup the offscreen document
async function setupOffscreenDocument(path) {
  // Check if we have an existing offscreen document
  const existingContexts = await chrome.runtime.getOffscreenDocuments({
    clientTypes: [chrome.runtime.ClientType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(path)]
  });

  if (existingContexts.length > 0) {
    return;
  }

  // create offscreen document
  await chrome.offscreen.createDocument({
    url: path,
    reasons: ['USER_MEDIA'],
    justification: 'The extension needs to process audio from tab capture, and the Web Speech API is only available in a document context.',
  });
}

async function closeOffscreenDocument() {
    const existingContexts = await chrome.runtime.getOffscreenDocuments({
        clientTypes: [chrome.runtime.ClientType.OFFSCREEN_DOCUMENT],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
    });
    if (existingContexts.length > 0) {
        await chrome.offscreen.closeDocument();
    }
}


// Start recording
async function startRecording() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error("No active tab found.");

        targetTabId = tab.id;
        isRecording = true;
        currentTranscript = '';
        chrome.storage.local.set({ currentTranscript: '', isRecording: true });

        // Setup and start recording in the offscreen document
        await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);
        chrome.runtime.sendMessage({
            action: 'start-recording',
            target: targetTabId
        });

        // Also, tell content script to show indicator
        chrome.tabs.sendMessage(targetTabId, { action: 'show-indicator' });

        return { success: true };
    } catch (error) {
        console.error("Error starting recording:", error);
        return { success: false, error: error.message };
    }
}

// Stop recording
async function stopRecording() {
    try {
        isRecording = false;
        chrome.storage.local.set({ isRecording: false });

        chrome.runtime.sendMessage({ action: 'stop-recording' });
        await closeOffscreenDocument();
        
        if (targetTabId) {
            chrome.tabs.sendMessage(targetTabId, { action: 'hide-indicator' });
        }
        targetTabId = null;

        return { success: true, transcript: currentTranscript };
    } catch(error) {
        console.error("Error stopping recording:", error);
        return { success: false, error: error.message };
    }
}

function getStatus() {
    return { isRecording, transcript: currentTranscript };
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Disambiguate messages from popup vs offscreen
    if (sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)) {
        // Message from offscreen document
        if (request.action === 'transcriptUpdate') {
            if (request.isFinal) {
                currentTranscript += request.transcript;
                chrome.storage.local.set({ currentTranscript });
                // Forward to popup
                chrome.runtime.sendMessage({
                    action: 'transcriptUpdate',
                    transcript: currentTranscript,
                });
            }
        }
    } else {
        // Message from popup or content script
        switch (request.action) {
            case 'startRecording':
                startRecording().then(sendResponse);
                return true;
            case 'stopRecording':
                stopRecording().then(sendResponse);
                return true;
            case 'getStatus':
                sendResponse(getStatus());
                break;
        }
    }
}); 