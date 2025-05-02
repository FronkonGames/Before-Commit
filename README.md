# Before Commit Extension for VS Code

This extension shows the size of files in the Source Control view before committing them.

## Features

- Displays file sizes next to files in a dedicated "Before Commit" view in the Source Control panel
- Updates automatically when files change
- Shows file status (Modified, Added, Deleted, etc.)
- Click on a file to open it
- Highlights files that exceed a configurable size limit with a customizable background color

## Requirements

- Git must be installed and available in the PATH
- A Git repository must be initialized in the workspace

## Usage

1. Open a folder containing a Git repository
2. Navigate to the Source Control view in VS Code
3. Look for the "Before Commit" section
4. Files will be listed with their sizes and status
5. Files exceeding the size limit will be highlighted with a red background (configurable)

## Extension Settings

This extension contributes the following settings:

* `beforeCommit.sizeLimit`: File size limit in MB (default: 100). Files larger than this will be highlighted.
* `beforeCommit.warningColor`: Background color for files that exceed the size limit (default: #ff000033 - semi-transparent red).

## Known Issues

- May not work with very large repositories
- Does not show sizes for submodules

## Release Notes

### 0.1.0

Initial release of Before Commit extension.        