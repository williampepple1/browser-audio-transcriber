document.addEventListener('DOMContentLoaded', function() {
  const playBtn = document.getElementById('playBtn');
  const stopBtn = document.getElementById('stopBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const statusText = document.getElementById('status-text');
  const statusIndicator = document.getElementById('status-indicator');
  const transcriptPreview = document.getElementById('transcript-preview');

  let isRecording = false;
  let currentTranscript = '';

  // Check current status when popup opens
  chrome.runtime.sendMessage({action: 'getStatus'}, function(response) {
    if (response && response.isRecording) {
      setRecordingState(true);
      if (response.transcript) {
        currentTranscript = response.transcript;
        updateTranscriptPreview();
      }
    }
  });

  playBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({action: 'startRecording'}, function(response) {
      if (response && response.success) {
        setRecordingState(true);
        statusText.textContent = 'Recording...';
      } else {
        statusText.textContent = 'Error: ' + (response?.error || 'Failed to start recording');
      }
    });
  });

  stopBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({action: 'stopRecording'}, function(response) {
      if (response && response.success) {
        setRecordingState(false);
        currentTranscript = response.transcript || '';
        updateTranscriptPreview();
        statusText.textContent = 'Recording stopped. Transcript ready.';
        downloadBtn.style.display = 'block';
      } else {
        statusText.textContent = 'Error: ' + (response?.error || 'Failed to stop recording');
      }
    });
  });

  downloadBtn.addEventListener('click', function() {
    if (currentTranscript) {
      const blob = new Blob([currentTranscript], {type: 'text/plain'});
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `transcript-${timestamp}.txt`;
      
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      }, function(downloadId) {
        if (chrome.runtime.lastError) {
          console.error('Download failed:', chrome.runtime.lastError);
          // Fallback: create download link
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
        }
        URL.revokeObjectURL(url);
      });
    }
  });

  function setRecordingState(recording) {
    isRecording = recording;
    playBtn.disabled = recording;
    stopBtn.disabled = !recording;
    statusIndicator.style.display = recording ? 'inline-block' : 'none';
    
    if (!recording) {
      downloadBtn.style.display = currentTranscript ? 'block' : 'none';
    } else {
      downloadBtn.style.display = 'none';
    }
  }

  function updateTranscriptPreview() {
    if (currentTranscript) {
      transcriptPreview.textContent = currentTranscript;
      transcriptPreview.style.display = 'block';
    } else {
      transcriptPreview.style.display = 'none';
    }
  }

  // Listen for transcript updates from background script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'transcriptUpdate') {
      currentTranscript = request.transcript;
      updateTranscriptPreview();
    }
  });
}); 