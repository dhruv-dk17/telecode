import axios from 'axios';
import * as vscode from 'vscode';

export class TelecodeApi {
  private baseUrl: string;

  constructor() {
    this.baseUrl = vscode.workspace.getConfiguration('telecode').get('apiUrl') || 'http://localhost:3005/api';
  }

  async exchangeCode(code: string): Promise<string | null> {
    try {
      const response = await axios.post(`${this.baseUrl}/bot/sync/exchange`, { code });
      return response.data.apiToken || null;
    } catch (error) {
      console.error('Telecode API Error (Exchange):', error);
      return null;
    }
  }

  async getTasks(token: string): Promise<any[]> {
    try {
      // For now, using the bot endpoint to list tasks. 
      // In a real app, we might have a dedicated /api/tasks endpoint.
      // We need to pass the token in headers if we had auth middleware.
      // For this MVP, we'll assume the token can be exchanged for a userId or similar.
      
      // Let's assume the exchange returns an "apiToken" which is just the userId for now
      // since the server doesn't have full JWT auth yet.
      const response = await axios.get(`${this.baseUrl}/bot/tasks/token/${token}`);
      return response.data.tasks || [];
    } catch (error) {
      console.error('Telecode API Error (GetTasks):', error);
      return [];
    }
  }
}
