<div align="center">
  <img src="images/icon.png" width="256" height="256" alt="Before Commit Icon">
  <h1>Before Commit Extension for VS Code</h1>
</div>

<div align="center">

[![Downloads](https://img.shields.io/visual-studio-marketplace/d/FronkonGames.before-commit)](https://marketplace.visualstudio.com/items?itemName=FronkonGames.before-commit) [![Rating](https://img.shields.io/visual-studio-marketplace/r/FronkonGames.before-commit)](https://marketplace.visualstudio.com/items?itemName=FronkonGames.before-commit) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

This extension highlights files that exceed a configurable size limit in the Source Control view before committing them.

## Features

- Shows a dedicated "Before Commit" panel in the Source Control view
- Displays a warning icon for files that exceed the size limit
- Shows file sizes in tooltips when hovering over files
- Provides a status bar indicator showing the count of large files
- Updates automatically when files change
- Allows quick navigation to large files

## Requirements

- Git must be installed and available in the PATH
- A Git repository must be initialized in the workspace

## Usage

1. Open a folder containing a Git repository
2. Navigate to the Source Control view in VS Code
3. The "Before Commit" panel will show files that exceed the size limit
4. Click on any file in the list to open it
5. Use the refresh button in the panel to manually update the list
6. Hover over files to see their size

## Extension Settings

This extension contributes the following settings:

* `beforeCommit.sizeLimit`: File size limit in MB. Files larger than this will be highlighted (default: 100MB)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.