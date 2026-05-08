import * as vscode from 'vscode';
import { TelecodeApi } from './api';

const TOKEN_KEY = 'telecode_api_token';

export class AuthManager {
  private api: TelecodeApi;

  constructor(private context: vscode.ExtensionContext) {
    this.api = new TelecodeApi();
  }

  async connect(): Promise<boolean> {
    const code = await vscode.window.showInputBox({
      prompt: 'Enter the 6-digit sync code from the Telecode Telegram bot',
      placeHolder: '123456',
      validateInput: (value) => {
        return value.length === 6 && /^\d+$/.test(value) ? null : 'Please enter a 6-digit numeric code';
      }
    });

    if (!code) {
      return false;
    }

    const token = await this.api.exchangeCode(code);
    if (token) {
      await this.context.secrets.store(TOKEN_KEY, token);
      vscode.window.showInformationMessage('✅ Successfully connected to Telecode!');
      return true;
    } else {
      vscode.window.showErrorMessage('❌ Invalid or expired sync code.');
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.context.secrets.delete(TOKEN_KEY);
    vscode.window.showInformationMessage('Disconnected from Telecode.');
  }

  async getToken(): Promise<string | undefined> {
    return await this.context.secrets.get(TOKEN_KEY);
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}
