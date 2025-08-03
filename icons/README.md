# Extension Icons

This directory contains the icon files for the Audio Transcriber Chrome extension.

## Required Icon Sizes:

- **icon16.png** (16x16 pixels) - Used in the extension management page and favicon
- **icon48.png** (48x48 pixels) - Used in the Chrome Web Store and extension management  
- **icon128.png** (128x128 pixels) - Used in the Chrome Web Store and installation

## Current Status:

The SVG files have been created with a microphone design in turquoise blue (#06b6d4) to match the extension's theme:

- `icon16.svg` - 16x16 microphone icon
- `icon48.svg` - 48x48 microphone icon  
- `icon128.svg` - 128x128 microphone icon

## To Complete Setup:

You need to convert these SVG files to PNG format. You can:

1. **Use an online converter**: Upload the SVG files to a service like:
   - https://convertio.co/svg-png/
   - https://cloudconvert.com/svg-to-png
   - https://www.svgviewer.dev/

2. **Use design software**: Open the SVG files in:
   - Adobe Illustrator
   - Figma
   - Inkscape (free)
   - GIMP (free)

3. **Use command line tools** (if you have them installed):
   - ImageMagick: `convert icon16.svg icon16.png`
   - Inkscape: `inkscape icon16.svg --export-filename=icon16.png`

## Icon Design:

The icons feature:
- Turquoise blue background (#06b6d4) matching the extension theme
- White microphone symbol
- Rounded corners for modern look
- Clear visibility at all sizes

Once you have the PNG files, place them in this directory and the extension will use them automatically. 