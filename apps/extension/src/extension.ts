import * as vscode from 'vscode';
import { AuthManager } from './auth';
import { TaskExplorerProvider } from './taskExplorer';

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "telecode" is now active!');

  const auth = new AuthManager(context);
  const taskExplorerProvider = new TaskExplorerProvider(auth);

  vscode.window.registerTreeDataProvider('telecode-tasks', taskExplorerProvider);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('telecode.connect', async () => {
      const success = await auth.connect();
      if (success) {
        taskExplorerProvider.refresh();
      }
    }),

    vscode.commands.registerCommand('telecode.disconnect', async () => {
      await auth.disconnect();
      taskExplorerProvider.refresh();
    }),

    vscode.commands.registerCommand('telecode.refreshTasks', () => {
      taskExplorerProvider.refresh();
    }),

    vscode.commands.registerCommand('telecode.viewTask', (task: any) => {
      vscode.window.showInformationMessage(`Task Details:\nMode: ${task.mode}\nStatus: ${task.status}\nPrompt: ${task.prompt}`);
      if (task.pullRequestUrl) {
        vscode.env.openExternal(vscode.Uri.parse(task.pullRequestUrl));
      }
    })
  );

  // Initial refresh
  auth.isAuthenticated().then(isAuth => {
    if (isAuth) {
      taskExplorerProvider.refresh();
    }
  });
}

export function deactivate() {}
