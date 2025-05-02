import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// File size calculation helper
function getFormattedSize(fileSizeInBytes: number): string {
  if (fileSizeInBytes < 1024) {
    return `${fileSizeInBytes} B`;
  } else if (fileSizeInBytes < 1024 * 1024) {
    return `${(fileSizeInBytes / 1024).toFixed(2)} KB`;
  } else {
    return `${(fileSizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

// Check if file exceeds size limit
function exceedsSizeLimit(fileSizeInBytes: number, sizeLimit: number): boolean {
  return fileSizeInBytes > sizeLimit;
}

// Apply decorations to SCM resources
async function applyDecorations(repository: any, context: vscode.ExtensionContext) {
  try {
    // Get configuration values
    const config = vscode.workspace.getConfiguration('beforeCommit');
    const sizeLimit = config.get<number>('sizeLimit', 100) * 1024 * 1024; // Convert MB to bytes
    const warningColor = config.get<string>('warningColor', '#ff000033'); // Default is semi-transparent red
    
    // Get workspace root
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return;
    }
    
    // Get all resources from the repository
    const resources = [...repository.state.workingTreeChanges, ...repository.state.indexChanges];
    
    // Create a decoration type for large files
    const largeFileDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: warningColor,
      isWholeLine: true
    });
    
    // Store the decoration type in context for disposal later
    if (!context.subscriptions.includes(largeFileDecoration)) {
      context.subscriptions.push(largeFileDecoration);
    }
    
    // Apply decorations to each resource
    for (const resource of resources) {
      try {
        const filePath = resource.resourceUri.fsPath;
        
        // Skip directories
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          continue;
        }
        
        const fileSizeInBytes = stats.size;
        const fileSize = getFormattedSize(fileSizeInBytes);
        
        // Add size information to the resource description
        resource.decorations = {
          ...resource.decorations,
          tooltip: `${path.basename(filePath)} (${fileSize})`,
          strikeThrough: resource.decorations?.strikeThrough
        };
        
        // Apply background color if file size exceeds limit
        if (exceedsSizeLimit(fileSizeInBytes, sizeLimit)) {
          // Apply decoration to the file
          const editors = vscode.window.visibleTextEditors.filter(
            editor => editor.document.uri.fsPath === filePath
          );
          
          for (const editor of editors) {
            const ranges = [new vscode.Range(0, 0, editor.document.lineCount, 0)];
            editor.setDecorations(largeFileDecoration, ranges);
          }
          
          // Add warning to the description
          resource.decorations = {
            ...resource.decorations,
            tooltip: `${path.basename(filePath)} (${fileSize}) - Exceeds size limit!`,
            color: '#ff0000'
          };
        }
      } catch (error) {
        // File might be deleted or inaccessible
        console.error(`Error processing file: ${resource.resourceUri.fsPath}`, error);
      }
    }
  } catch (error) {
    console.error('Error applying decorations:', error);
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Activating BeforeCommit extension');
  
  // Get the Git SCM provider
  const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
  if (!gitExtension) {
    console.error('Git extension not found');
    vscode.window.showErrorMessage('Git extension not found');
    return;
  }
  
  const git = gitExtension.getAPI(1);
  
  // Function to update all repositories
  function updateAllRepositories() {
    for (const repo of git.repositories) {
      applyDecorations(repo, context);
    }
  }
  
  // Watch for repository changes
  git.onDidOpenRepository((repo: any) => {
    applyDecorations(repo, context);
  });
  
  // Watch for changes in the repository state
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('beforeCommit')) {
        updateAllRepositories();
      }
    })
  );
  
  // Watch for file changes
  const fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*');
  context.subscriptions.push(
    fileSystemWatcher.onDidChange(() => updateAllRepositories()),
    fileSystemWatcher.onDidCreate(() => updateAllRepositories()),
    fileSystemWatcher.onDidDelete(() => updateAllRepositories())
  );
  
  // Register command to manually refresh
  const refreshCommand = vscode.commands.registerCommand('beforeCommit.refresh', () => {
    updateAllRepositories();
  });
  
  context.subscriptions.push(refreshCommand);
  
  // Initial update for all repositories
  if (git.repositories.length > 0) {
    updateAllRepositories();
  }
}

export function deactivate() {}