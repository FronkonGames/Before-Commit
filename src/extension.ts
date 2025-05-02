import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface GitFile {
  path: string;
  size: string;
  sizeInBytes: number;
  status: string;
}

class BeforeCommitProvider implements vscode.TreeDataProvider<GitFileItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GitFileItem | null | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private gitFiles: GitFile[] = [];
  private workspaceRoot: string | undefined;

  constructor(private context: vscode.ExtensionContext) {
    this.workspaceRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;

    // Register file system watcher to track changes
    const fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*');
    this.context.subscriptions.push(
      fileSystemWatcher.onDidChange(() => this.refresh()),
      fileSystemWatcher.onDidCreate(() => this.refresh()),
      fileSystemWatcher.onDidDelete(() => this.refresh())
    );

    // Refresh when git repository changes or configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('git') || e.affectsConfiguration('beforeCommit')) {
        this.refresh();
      }
    });

    // Initial refresh
    this.refresh();
  }

  refresh(): void {
    console.log('Refreshing tree view');
    this.getGitFiles().then(() => {
      console.log('Git files updated, firing event');
      this._onDidChangeTreeData.fire(undefined);  // Pass undefined explicitly
    });
  }

  async getGitFiles(): Promise<void> {
    console.log('Getting git files, workspace root:', this.workspaceRoot);
    if (!this.workspaceRoot) {
      this.gitFiles = [];
      return;
    }

    try {
      // Get git status
      console.log('Executing git status command');
      const { stdout } = await execAsync('git status --porcelain', { cwd: this.workspaceRoot });
      
      const files: GitFile[] = [];
      const lines = stdout.split('\n').filter(line => line.trim() !== '');
      console.log(`Found ${lines.length} changed files`);
      
      for (const line of lines) {
        const status = line.substring(0, 2).trim();
        const filePath = line.substring(3).trim();
        console.log(`Processing file: ${filePath} with status: ${status}`);
        
        if (!filePath) {
          console.log('Empty file path, skipping');
          continue;
        }
        
        const fullPath = path.join(this.workspaceRoot, filePath);
        console.log(`Full path: ${fullPath}`);
        
        try {
          const stats = fs.statSync(fullPath);
          const fileSizeInBytes = stats.size;
          let fileSize: string;
          
          if (fileSizeInBytes < 1024) {
            fileSize = `${fileSizeInBytes} B`;
          } else if (fileSizeInBytes < 1024 * 1024) {
            fileSize = `${(fileSizeInBytes / 1024).toFixed(2)} KB`;
          } else {
            fileSize = `${(fileSizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
          }
          
          files.push({
            path: filePath,
            size: fileSize,
            sizeInBytes: fileSizeInBytes,
            status: this.getStatusText(status)
          });
        } catch (err) {
          // File might be deleted
          files.push({
            path: filePath,
            size: 'N/A',
            sizeInBytes: 0,
            status: this.getStatusText(status)
          });
        }
      }
      
      this.gitFiles = files;
      console.log(`Updated gitFiles array with ${files.length} files`);
    } catch (error) {
      console.error('Error getting git files:', error);
      this.gitFiles = [];
    }
  }

  getStatusText(status: string): string {
    if (status.includes('M')) return 'Modified';
    if (status.includes('A')) return 'Added';
    if (status.includes('D')) return 'Deleted';
    if (status.includes('R')) return 'Renamed';
    if (status.includes('C')) return 'Copied';
    if (status.includes('U')) return 'Updated';
    if (status.includes('?')) return 'Untracked';
    return status;
  }

  getTreeItem(element: GitFileItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: GitFileItem): Promise<GitFileItem[]> {
    console.log('Getting children, element:', element);
    if (!this.workspaceRoot) {
      console.log('No workspace root found');
      vscode.window.showInformationMessage('No git repository found in workspace');
      return Promise.resolve([]);
    }

    if (element) {
      return Promise.resolve([]);
    } else {
      // Get configuration values
      const config = vscode.workspace.getConfiguration('beforeCommit');
      const sizeLimit = config.get<number>('sizeLimit', 100) * 1024 * 1024;
      const warningColor = config.get<string>('warningColor', '#ff000033');
      console.log(`Config: sizeLimit=${sizeLimit}, warningColor=${warningColor}`);

      console.log(`Creating tree items for ${this.gitFiles.length} files`);
      return this.gitFiles.map(file => {
        console.log(`Creating tree item for ${file.path}`);
        return new GitFileItem(
          file.path,
          file.size,
          file.sizeInBytes,
          file.status,
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [vscode.Uri.file(path.join(this.workspaceRoot!, file.path))]
          },
          sizeLimit,
          warningColor
        );
      });
    }
  }
}

class GitFileItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly size: string,
    public readonly sizeInBytes: number,
    public readonly status: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    private sizeLimit: number = 100 * 1024 * 1024,
    private warningColor: string = '#ff000033'
  ) {
    super(label, collapsibleState);
    console.log(`Creating GitFileItem: ${label}, size: ${size}, status: ${status}`);
    this.tooltip = `${label} (${size})`;
    this.description = `${size} - ${status}`;
    
    // Set icon based on status using ThemeIcon
    console.log(`Setting icon for status: ${status}`);
    try {
      if (status === 'Modified') {
        this.iconPath = vscode.ThemeIcon.File;
        // Or use a codicon directly
        this.iconPath = { id: 'edit' };
      } else if (status === 'Added') {
        this.iconPath = { id: 'add' };
      } else if (status === 'Deleted') {
        this.iconPath = { id: 'trash' };
      } else {
        this.iconPath = { id: 'file' };
      }
      console.log('Icon set successfully');
    } catch (error) {
      console.error('Error setting icon:', error);
    }

    // Apply background color if file size exceeds limit
    console.log(`Checking file size: ${sizeInBytes} > ${sizeLimit}`);
    if (sizeInBytes > sizeLimit) {
      console.log('File exceeds size limit, setting contextValue and resourceUri');
      // Set a custom context value to identify large files
      this.contextValue = 'largeFile';
      
      try {
        // Use an absolute path for the resourceUri
        // The label is likely a relative path, so we need to make it absolute
        console.log(`Creating Uri from: ${label}`);
        // Get the workspace root from the command arguments if available
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
          const absolutePath = path.isAbsolute(label) ? label : path.join(workspaceRoot, label);
          this.resourceUri = vscode.Uri.file(absolutePath);
        } else {
          // Fallback to just using the label
          this.resourceUri = vscode.Uri.file(label);
        }
        console.log('ResourceUri set successfully:', this.resourceUri);
      } catch (error) {
        console.error('Error setting resourceUri:', error);
      }
    }
  }

  contextValue = 'gitFile';
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

  console.log('Git extension found, getting API');
  const git = gitExtension.getAPI(1);
  
  // Watch for repository changes
  git.onDidOpenRepository(() => {
    console.log('Repository opened, setting up decorations');
    setupFileSizeDecorations(context);
  });

  // Set up decorations for any repositories that are already open
  console.log(`Found ${git.repositories.length} repositories`);
  if (git.repositories.length > 0) {
    setupFileSizeDecorations(context);
  }
}

// Remove the unused repo parameter
function setupFileSizeDecorations(context: vscode.ExtensionContext) {
  // Create decorations provider that will add file sizes to the SCM view
  // This would use the same logic you currently have for calculating file sizes
  // but apply it to the built-in SCM resources instead
  
  // Register configuration
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('beforeCommit')) {
      vscode.commands.executeCommand('beforeCommit.refresh');
    }
  }));

  const beforeCommitProvider = new BeforeCommitProvider(context);
  
  vscode.window.registerTreeDataProvider('beforeCommit', beforeCommitProvider);
  
  // Command to refresh the view
  const refreshCommand = vscode.commands.registerCommand('beforeCommit.refresh', () => {
    beforeCommitProvider.refresh();
  });
  
  context.subscriptions.push(refreshCommand);
}

export function deactivate() {}