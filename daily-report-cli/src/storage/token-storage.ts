import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TokenStorage } from '../types';

const CONFIG_DIR = path.join(os.homedir(), '.daily-report-cli');
const TOKEN_FILE = path.join(CONFIG_DIR, 'tokens.json');

export class TokenStorageManager {
  private ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
  }

  private readTokens(): TokenStorage {
    this.ensureConfigDir();
    
    if (!fs.existsSync(TOKEN_FILE)) {
      return {};
    }

    try {
      const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to read token file:', error);
      return {};
    }
  }

  private writeTokens(tokens: TokenStorage): void {
    this.ensureConfigDir();
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
  }

  public saveToken(service: keyof TokenStorage, token: string): void {
    const tokens = this.readTokens();
    tokens[service] = token;
    this.writeTokens(tokens);
  }

  public getToken(service: keyof TokenStorage): string | undefined {
    const tokens = this.readTokens();
    return tokens[service];
  }

  public deleteToken(service: keyof TokenStorage): void {
    const tokens = this.readTokens();
    delete tokens[service];
    this.writeTokens(tokens);
  }

  public getAllTokens(): TokenStorage {
    return this.readTokens();
  }

  public hasToken(service: keyof TokenStorage): boolean {
    const tokens = this.readTokens();
    return !!tokens[service];
  }
}

export const tokenStorage = new TokenStorageManager();
