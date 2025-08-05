# Browser Audio Transcriber

A Chrome extension that transcribes audio from browser tabs in real-time and saves the transcriptions locally as text files.

## Features

- 🎤 **Real-time Audio Transcription**: Captures and transcribes audio from any browser tab
- 🎯 **English Language Support**: Optimized for English speech recognition
- 💾 **Local Storage**: All transcriptions are saved locally on your device
- 🎨 **Beautiful UI**: Modern, intuitive interface with recording indicators
- 📁 **Easy Download**: One-click download of transcriptions as text files
- 🔒 **Privacy-First**: No data is sent to external servers

## Installation

### Method 1: Load as Unpacked Extension (Recommended for Development)

1. **Download or Clone this Repository**
   ```bash
   git clone https://github.com/williampepple1/browser-audio-transcriber.git
   cd browser-audio-transcriber
   ```

2. **Open Chrome Extensions Page**
   - Open Chrome and navigate to `chrome://extensions/`
   - Or go to Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the `browser-audio-transcriber` folder
   - The extension should now appear in your extensions list

### Method 2: Install from Chrome Web Store (Future)

Once published, you'll be able to install directly from the Chrome Web Store.

## Usage

### Basic Usage

1. **Navigate to a webpage** with audio content (YouTube, podcasts, etc.)

2. **Click the extension icon** in your Chrome toolbar

3. **Start Recording**
   - Click the "▶ Play" button to begin transcription
   - A red recording indicator will appear on the webpage
   - The extension will start capturing and transcribing audio

4. **Stop Recording**
   - Click the "⏹ Stop" button to end transcription
   - The transcription will be processed and displayed

5. **Download Transcript**
   - Click "📥 Download Transcript" to save as a text file
   - Files are automatically named with timestamps

6. **Refresh Transcript**
   - Click "Refresh Transcript" to reset the state of the extension

### Supported Audio Sources

- YouTube videos
- Podcast players
- Music streaming services
- Video conferencing apps
- Any webpage with audio content

## Technical Details

### Architecture

- **Manifest V3**: Uses the latest Chrome extension manifest format
- **Service Worker**: Background script handles audio capture and transcription
- **Content Script**: Injected into web pages for enhanced audio detection
- **Web Speech API**: Uses Chrome's built-in speech recognition
- **MediaDevices API**: Captures audio through microphone (picks up speaker audio)

### Permissions

- `activeTab`: Access to the currently active tab
- `tabs`: Tab management and information
- `storage`: Local data storage
- `scripting`: Dynamic script injection
- `downloads`: File download functionality

### File Structure

```
browser-audio-transcriber/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── background.js         # Service worker (audio capture & transcription)
├── content.js            # Content script (page injection)
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

## Troubleshooting

### Common Issues

**"Speech recognition not supported"**
- Ensure you're using Chrome browser
- Check that the page has audio content
- Try refreshing the page

**"Could not establish connection. Receiving end does not exist."**
- Refresh the webpage you're trying to record from
- Make sure you're not on a Chrome system page (chrome:// URLs)
- Try navigating to a different webpage and back

**"Failed to capture tab audio"**
- Make sure the tab has audio playing
- Check that the tab is not muted
- Try switching to a different tab and back

**Recording indicator not showing**
- Check that the extension is enabled
- Try refreshing the page
- Ensure the content script is loaded

### Browser Compatibility

- ✅ Chrome 88+
- ✅ Edge 88+ (Chromium-based)
- ❌ Firefox (not supported due to different APIs)
- ❌ Safari (not supported due to different APIs)

## Development

### Prerequisites

- Chrome browser
- Basic knowledge of JavaScript and Chrome Extensions

### Local Development

1. **Clone the repository**
2. **Load as unpacked extension** (see installation instructions)
3. **Make changes** to the code
4. **Reload the extension** in `chrome://extensions/`
5. **Test your changes**

### Key Files to Modify

- `background.js`: Audio capture and transcription logic
- `popup.js`: User interface interactions
- `content.js`: Page-specific functionality
- `manifest.json`: Extension configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Privacy

This extension:
- ✅ Processes all audio locally on your device
- ✅ Does not send any data to external servers
- ✅ Stores transcriptions only on your local machine
- ✅ Uses Chrome's built-in speech recognition API

## Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Search existing issues on GitHub
3. Create a new issue with detailed information

## Roadmap

- [ ] Support for multiple languages
- [ ] Real-time transcript display
- [ ] Audio file export
- [ ] Custom transcription settings
- [ ] Keyboard shortcuts
- [ ] Cloud backup option (optional)

---

**Note**: This extension requires audio to be playing in the browser tab for transcription to work. It cannot transcribe audio from other applications or system audio.
