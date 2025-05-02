import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as util from 'util';
import { LargeFilesProvider } from './largeFilesProvider';
import { FileInfo } from './types';

const execPromise = util.promisify(exec);

// Size constants
const MB = 1024 * 1024;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('BeforeCommit extension is now active!');

  // Create status bar item to show count of large files
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'beforeCommit.refreshLargeFiles';
  context.subscriptions.push(statusBarItem);

  // Create tree data provider for large files view
  const largeFilesProvider = new LargeFilesProvider();
  vscode.window.registerTreeDataProvider('beforeCommitLargeFiles', largeFilesProvider);

  // Store large files information
  let largeFiles: FileInfo[] = [];

  // Function to get size limit from configuration
  function getSizeLimit() {
    const config = vscode.workspace.getConfiguration('beforeCommit');
    return config.get('sizeLimit', 100) * MB; // Default 100MB
  }

  // Function to check if a file is large
  // Function to check if a file is large
  async function checkFileSize(filePath: string): Promise<FileInfo | null> {
    try {
      const stats = await fs.promises.stat(filePath);
      const sizeLimit = getSizeLimit();
      return {
        path: filePath,
        size: stats.size,
        isLarge: stats.size >= sizeLimit,
        formattedSize: formatFileSize(stats.size)
      };
    } catch (error) {
      console.error(`Error checking file size for ${filePath}:`, error);
      return null;
    }
  }

  // Format file size to human-readable format
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(2) + ' KB';
    } else if (bytes < 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    } else {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
  }

  // Function to get files to be added to git
  // Function to get files to be added to git
  async function getGitFilesToBeAdded(): Promise<{status: string, path: string}[]> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        console.log('No workspace folders found');
        return [];
      }
  
      const rootPath = workspaceFolders[0].uri.fsPath;
      console.log(`Checking git status in: ${rootPath}`);
      
      // Get a more comprehensive list of files that would be included in a commit
      // This includes both staged and unstaged changes
      const { stdout: statusOutput } = await execPromise('git status --porcelain -uall', { cwd: rootPath });
      console.log(`Git status output: ${statusOutput}`);
      
      // Also get all tracked files to ensure we're not missing anything
      const { stdout: lsFilesOutput } = await execPromise('git ls-files', { cwd: rootPath });
      
      // Combine both outputs
      const allFiles = new Set<string>();
      
      // Process status output
      statusOutput.split('\n')
        .filter(line => line.trim() !== '')
        .forEach(line => {
          // Status format is XY PATH where X is staged status, Y is unstaged status
          const status = line.substring(0, 2);
          const filePath = line.substring(3).trim();
          
          // Remove quotes if present
          const cleanPath = filePath.replace(/^"(.*)"$/, '$1');
          allFiles.add(cleanPath);
        });
      
      // Process ls-files output
      lsFilesOutput.split('\n')
        .filter(line => line.trim() !== '')
        .forEach(line => {
          allFiles.add(line.trim());
        });
      
      console.log(`Total unique files found: ${allFiles.size}`);
      
      // Convert to file objects and filter for actual files
      const files = Array.from(allFiles)
        .map(filePath => {
          return {
            status: "??", // Default status if unknown
            path: path.join(rootPath, filePath)
          };
        })
        .filter(file => {
          // Check if it's a file (not a directory)
          try {
            return fs.statSync(file.path).isFile();
          } catch (error) {
            return false;
          }
        });
      
      console.log(`After filtering, found ${files.length} valid files`);
      return files;
    } catch (error) {
      console.error('Error getting git files:', error);
      return [];
    }
  }

// Function to refresh the list of large files
async function refreshLargeFiles() {
  try {
    const gitFiles = await getGitFilesToBeAdded();
    console.log(`Found ${gitFiles.length} files in git status`);
    
    // Check size of each file
    const filePromises = gitFiles.map(file => checkFileSize(file.path));
    const fileResults = await Promise.all(filePromises);
    
    // Get all valid files (not null)
    const allValidFiles = fileResults.filter((result): result is FileInfo => result !== null);
    
    // Filter large files for status bar, notifications, and tree view
    largeFiles = allValidFiles
      .filter(file => file.isLarge)
      .sort((a, b) => b.size - a.size); // Sort by size (largest first)
    
    // Update the tree view with ONLY large files
    largeFilesProvider.refresh(largeFiles);
    
    // Update status bar
    if (largeFiles.length > 0) {
      statusBarItem.text = `$(warning) Large Files: ${largeFiles.length}`;
      statusBarItem.tooltip = 'Files exceeding size limit to be committed';
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
    
      // Show information message with large files
      if (largeFiles.length > 0) {
        const message = `Found ${largeFiles.length} large file(s) to be committed`;
        const viewDetails = 'View Details';
        
        vscode.window.showWarningMessage(message, viewDetails).then(selection => {
          if (selection === viewDetails) {
            // Focus on the tree view instead of showing quick pick
            vscode.commands.executeCommand('beforeCommitLargeFiles.focus');
          }
        });
      }
    } catch (error) {
      console.error('Error refreshing large files:', error);
    }
}

  // Function to show details of large files
  function showLargeFilesDetails() {
    if (largeFiles.length === 0) {
      vscode.window.showInformationMessage('No large files found.');
      return;
    }
    
    // Create a quick pick for each large file
    const items = largeFiles.map(file => ({
      label: path.basename(file.path),
      description: file.formattedSize,
      detail: file.path,
      file
    }));
    
    vscode.window.showQuickPick(items, {
      placeHolder: 'Large files to be committed',
      matchOnDescription: true,
      matchOnDetail: true
    }).then(selected => {
      if (selected) {
        // Open the selected file
        const fileUri = vscode.Uri.file(selected.file.path);
        vscode.window.showTextDocument(fileUri);
      }
    });
  }

  // Register the refresh command
  let refreshCommand = vscode.commands.registerCommand('beforeCommit.refreshLargeFiles', refreshLargeFiles);
  context.subscriptions.push(refreshCommand);
  
  // Register the view refresh command (for the refresh icon)
  let viewRefreshCommand = vscode.commands.registerCommand('beforeCommitLargeFiles.refresh', () => {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Refreshing large files...",
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0 });
      await refreshLargeFiles();
      progress.report({ increment: 100 });
    });
  });
  context.subscriptions.push(viewRefreshCommand);

  // Set up file system watcher to detect changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  watcher.onDidChange(() => refreshLargeFiles());
  watcher.onDidCreate(() => refreshLargeFiles());
  watcher.onDidDelete(() => refreshLargeFiles());
  context.subscriptions.push(watcher);

  // Initial refresh
  refreshLargeFiles();
}

// this method is called when your extension is deactivated
export function deactivate() {}
