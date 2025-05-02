import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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
    
    console.log(`Applying decorations with sizeLimit: ${sizeLimit} bytes, warningColor: ${warningColor}`);
    
    // Get workspace root
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      console.log('No workspace root found');
      return;
    }
    
    // Get all resources from the repository
    const resources = [...repository.state.workingTreeChanges, ...repository.state.indexChanges];
    console.log(`Found ${resources.length} resources to process`);
    
    // Create a decoration type for large files
    const largeFileDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: warningColor,
      isWholeLine: true
    });
    
    // Store the decoration type in context for disposal later
    if (!context.subscriptions.includes(largeFileDecoration)) {
      context.subscriptions.push(largeFileDecoration);
    }
    
    // Counter for files exceeding size limit
    let largeFilesCount = 0;
    
    // Apply decorations to each resource
    for (const resource of resources) {
      try {
        const filePath = resource.resourceUri.fsPath;
        console.log(`Processing file: ${filePath}`);
        
        // Skip directories or deleted files
        if (!fs.existsSync(filePath)) {
          console.log(`File does not exist (might be deleted): ${filePath}`);
          continue;
        }
        
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          console.log(`Skipping directory: ${filePath}`);
          continue;
        }
        
        const fileSizeInBytes = stats.size;
        const fileSize = getFormattedSize(fileSizeInBytes);
        console.log(`File size: ${fileSize} (${fileSizeInBytes} bytes)`);
        
        // Add size information to the resource description
        resource.decorations = {
          ...resource.decorations,
          tooltip: `${path.basename(filePath)} (${fileSize})`,
          strikeThrough: resource.decorations?.strikeThrough,
          // Add size to the description so it's visible in the UI
          description: `${fileSize} ${resource.decorations?.description || ''}`
        };
        
        // Apply background color if file size exceeds limit
        console.log(`Checking if file exceeds limit: ${fileSizeInBytes} > ${sizeLimit}`);
        if (exceedsSizeLimit(fileSizeInBytes, sizeLimit)) {
          console.log(`File exceeds size limit: ${filePath}`);
          // Increment counter
          largeFilesCount++;
          
          // Apply decoration to the file
          const editors = vscode.window.visibleTextEditors.filter(
            editor => editor.document.uri.fsPath === filePath
          );
          
          console.log(`Found ${editors.length} open editors for this file`);
          for (const editor of editors) {
            const ranges = [new vscode.Range(0, 0, editor.document.lineCount, 0)];
            editor.setDecorations(largeFileDecoration, ranges);
          }
          
          // Add warning to the description
          resource.decorations = {
            ...resource.decorations,
            tooltip: `${path.basename(filePath)} (${fileSize}) - Exceeds size limit!`,
            color: '#ff0000',
            description: `${fileSize} - LARGE! ${resource.decorations?.description || ''}`
          };
        }
      } catch (error) {
        // File might be deleted or inaccessible
        console.error(`Error processing file: ${resource.resourceUri?.fsPath}`, error);
      }
    }
    
    console.log(`Found ${largeFilesCount} large files`);
    
    // Update the Changes section badge with the count of large files
    if (repository.sourceControl) {
      if (largeFilesCount > 0) {
        console.log(`Setting badge for ${largeFilesCount} large files`);
        repository.sourceControl.inputBox.placeholder = `Message (${largeFilesCount} large files)`;
        
        // Add a badge to the Changes section
        const changesGroup = repository.sourceControl.groups.find((group: any) => group.id === 'workingTree');
        if (changesGroup) {
          console.log(`Found Changes group, setting badge`);
          changesGroup.label = `Changes ${largeFilesCount > 0 ? `(${largeFilesCount})` : ''}`;
          changesGroup.badge = largeFilesCount;
          changesGroup.badgeColor = new vscode.ThemeColor('errorForeground');
        } else {
          console.log(`Could not find Changes group`);
        }
      } else {
        // Reset to default if no large files
        repository.sourceControl.inputBox.placeholder = 'Message';
        
        // Reset the Changes section label
        const changesGroup = repository.sourceControl.groups.find((group: any) => group.id === 'workingTree');
        if (changesGroup) {
          changesGroup.label = 'Changes';
          changesGroup.badge = undefined;
        }
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