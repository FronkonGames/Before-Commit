import * as vscode from 'vscode';
import * as path from 'path';
import { FileInfo } from './types';

export class LargeFilesProvider implements vscode.TreeDataProvider<LargeFileItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<LargeFileItem | undefined | null | void> = new vscode.EventEmitter<LargeFileItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<LargeFileItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private largeFiles: FileInfo[] = [];

  constructor() {}

  refresh(largeFiles: FileInfo[]): void {
    this.largeFiles = largeFiles;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: LargeFileItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: LargeFileItem): Thenable<LargeFileItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    // Even if there are no large files, return an empty array instead of undefined
    return Promise.resolve(
      this.largeFiles.length > 0 
        ? this.largeFiles.map(file => new LargeFileItem(file))
        : []
    );
  }
}

class LargeFileItem extends vscode.TreeItem {
  constructor(
    public readonly file: FileInfo
  ) {
    super(path.basename(file.path), vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${file.path} (${file.formattedSize})`;
    this.description = file.formattedSize;
    
    // Add an icon or label to indicate if the file is large
    if (file.isLarge) {
      this.iconPath = new vscode.ThemeIcon('warning');
      this.contextValue = 'largeFile';
    } else {
      this.iconPath = new vscode.ThemeIcon('file');
      this.contextValue = 'normalFile';
    }
    
    // Add command to open the file when clicked
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [vscode.Uri.file(file.path)]
    };
  }
}