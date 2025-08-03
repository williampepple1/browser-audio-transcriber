document.addEventListener('DOMContentLoaded', function() {
  const playBtn = document.getElementById('playBtn');
  const stopBtn = document.getElementById('stopBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const statusText = document.getElementById('status-text');
  const statusIndicator = document.getElementById('status-indicator');
  const transcriptPreview = document.getElementById('transcript-preview');
  const statusCard = document.getElementById('statusCard');
  const waveAnimation = document.getElementById('wave-animation');

  let isRecording = false;
  let currentTranscript = '';

  // Check current status when popup opens
  chrome.runtime.sendMessage({action: 'getStatus'}, function(response) {
    console.log('Popup opened, current status:', response);
    if (response) {
      isRecording = response.isRecording;
      if (response.transcript) {
        currentTranscript = response.transcript;
      }
      setRecordingState(isRecording);
      updateTranscriptPreview();
      
      // Update status text based on current state
      if (isRecording) {
        statusText.textContent = 'Recording in progress...';
      } else if (currentTranscript) {
        statusText.textContent = 'Recording completed';
      } else {
        statusText.textContent = 'Ready to transcribe';
      }
    }
  });

  playBtn.addEventListener('click', function() {
    // Add loading state
    playBtn.disabled = true;
    playBtn.querySelector('.btn-text').textContent = 'Starting...';
    
    chrome.runtime.sendMessage({action: 'startRecording'}, function(response) {
      if (response && response.success) {
        setRecordingState(true);
        statusText.textContent = 'Recording in progress...';
        showNotification('Recording started successfully!', 'success');
      } else {
        setRecordingState(false);
        statusText.textContent = 'Ready to transcribe';
        showNotification('Error: ' + (response?.error || 'Failed to start recording'), 'error');
      }
    });
  });

  stopBtn.addEventListener('click', function() {
    // Add loading state
    stopBtn.disabled = true;
    stopBtn.querySelector('.btn-text').textContent = 'Stopping...';
    
    chrome.runtime.sendMessage({action: 'stopRecording'}, function(response) {
      if (response && response.success) {
        setRecordingState(false);
        currentTranscript = response.transcript || '';
        updateTranscriptPreview();
        statusText.textContent = 'Recording completed';
        showNotification('Recording stopped. Transcript ready!', 'success');
      } else {
        setRecordingState(true);
        statusText.textContent = 'Recording in progress...';
        showNotification('Error: ' + (response?.error || 'Failed to stop recording'), 'error');
      }
    });
  });

  downloadBtn.addEventListener('click', function() {
    if (currentTranscript) {
      // Add loading state
      downloadBtn.disabled = true;
      downloadBtn.querySelector('.btn-text').textContent = 'Downloading...';
      
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
        
        // Reset button state
        downloadBtn.disabled = false;
        downloadBtn.querySelector('.btn-text').textContent = 'Download Transcript';
        showNotification('Transcript downloaded successfully!', 'success');
      });
    }
  });

  function setRecordingState(recording) {
    isRecording = recording;
    
    if (recording) {
      // Recording state
      playBtn.disabled = true;
      stopBtn.disabled = false;
      playBtn.querySelector('.btn-text').textContent = 'Recording...';
      stopBtn.querySelector('.btn-text').textContent = 'Stop';
      
      statusIndicator.classList.remove('hidden');
      waveAnimation.classList.remove('hidden');
      statusCard.classList.add('recording');
      downloadBtn.classList.add('hidden');
      
      // Add fade-in animation
      statusCard.classList.add('fade-in');
    } else {
      // Stopped state
      playBtn.disabled = false;
      stopBtn.disabled = true;
      playBtn.querySelector('.btn-text').textContent = 'Start Recording';
      stopBtn.querySelector('.btn-text').textContent = 'Stop';
      
      statusIndicator.classList.add('hidden');
      waveAnimation.classList.add('hidden');
      statusCard.classList.remove('recording');
      
      if (currentTranscript) {
        downloadBtn.classList.remove('hidden');
        downloadBtn.classList.add('fade-in');
      }
    }
  }

  function updateTranscriptPreview(isFinal = true) {
    if (currentTranscript) {
      transcriptPreview.textContent = currentTranscript;
      transcriptPreview.classList.remove('hidden');
      transcriptPreview.classList.add('fade-in');
      
      // Add visual indication for interim vs final results
      if (!isFinal) {
        transcriptPreview.style.fontStyle = 'italic';
        transcriptPreview.style.opacity = '0.8';
      } else {
        transcriptPreview.style.fontStyle = 'normal';
        transcriptPreview.style.opacity = '1';
      }
    } else {
      transcriptPreview.classList.add('hidden');
    }
  }

  function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type} fade-in`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 1000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      max-width: 300px;
      word-wrap: break-word;
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Listen for transcript updates from background script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'transcriptUpdate') {
      console.log('Received transcript update:', request.transcript.length, 'characters', 'isFinal:', request.isFinal);
      currentTranscript = request.transcript;
      updateTranscriptPreview(request.isFinal);
    }
  });

  // Periodically check status to ensure popup stays in sync
  setInterval(function() {
    if (isRecording) {
      chrome.runtime.sendMessage({action: 'getStatus'}, function(response) {
        if (response && response.transcript !== currentTranscript) {
          currentTranscript = response.transcript;
          updateTranscriptPreview();
        }
      });
    }
  }, 2000); // Check every 2 seconds when recording

  // Add hover effects for buttons
  [playBtn, stopBtn, downloadBtn].forEach(btn => {
    btn.addEventListener('mouseenter', function() {
      if (!btn.disabled) {
        btn.style.transform = 'translateY(-2px)';
      }
    });
    
    btn.addEventListener('mouseleave', function() {
      if (!btn.disabled) {
        btn.style.transform = 'translateY(0)';
      }
    });
  });
}); 