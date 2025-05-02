<div align="center">
  <img src="images/icon.png" width="256" height="256" alt="Before Commit Icon">
  <h1>Before Commit Extension for VS Code</h1>
</div>

<div align="center">

[![Downloads](https://img.shields.io/visual-studio-marketplace/d/FronkonGames.before-commit)](https://marketplace.visualstudio.com/items?itemName=FronkonGames.before-commit) [![Rating](https://img.shields.io/visual-studio-marketplace/r/FronkonGames.before-commit)](https://marketplace.visualstudio.com/items?itemName=FronkonGames.before-commit) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

This extension highlights files that exceed a configurable size limit in the Source Control view before committing them.

## Features

- Integrates directly with the existing "Changes" view in the Source Control panel
- Displays file sizes in tooltips when hovering over files
- Shows a badge with the count of large files in the "Changes" section
- Updates automatically when files change
- Highlights files that exceed a configurable size limit with a customizable background color

## Requirements

- Git must be installed and available in the PATH
- A Git repository must be initialized in the workspace

## Usage

1. Open a folder containing a Git repository
2. Navigate to the Source Control view in VS Code
3. Files exceeding the size limit will be highlighted with a red background (configurable)
4. Hover over files to see their size information
5. The "Changes" section will show a badge with the count of large files

## Extension Settings

This extension contributes the following settings:

* `beforeCommit.sizeLimit`: File size limit in MB (default: 100). Files larger than this will be highlighted.
* `beforeCommit.warningColor`: Background color for files that exceed the size limit (default: #ff000033 - semi-transparent red).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.