import express from 'express';
import { Server } from 'http';
import open from 'open';

export interface OAuthServerOptions {
  port: number;
  authUrl: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
}

export class LocalOAuthServer {
  private app: express.Application;
  private server: Server | null = null;

  constructor() {
    this.app = express();
  }

  public async startAuthFlow(options: OAuthServerOptions): Promise<string> {
    const { port, authUrl, clientId, redirectUri, scopes, state } = options;

    return new Promise((resolve, reject) => {
      this.app.get('/callback', (req, res) => {
        const code = req.query.code as string;
        const error = req.query.error as string;

        if (error) {
          res.send(`
            <html>
              <body>
                <h1>認証エラー</h1>
                <p>認証に失敗しました: ${error}</p>
                <p>このウィンドウを閉じてください。</p>
              </body>
            </html>
          `);
          this.stop();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (code) {
          res.send(`
            <html>
              <body>
                <h1>認証成功!</h1>
                <p>認証が完了しました。このウィンドウを閉じてください。</p>
              </body>
            </html>
          `);
          this.stop();
          resolve(code);
          return;
        }

        res.status(400).send('Invalid callback');
        this.stop();
        reject(new Error('No authorization code received'));
      });

      this.server = this.app.listen(port, async () => {
        console.log(`ローカルサーバーが起動しました: http://localhost:${port}`);
        
        const scopeParam = scopes.join(' ');
        const stateParam = state || Math.random().toString(36).substring(7);
        
        const url = `${authUrl}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopeParam)}&response_type=code&state=${stateParam}`;
        
        console.log('ブラウザで認証ページを開いています...');
        await open(url);
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
