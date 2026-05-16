import axios from 'axios';
import { LocalOAuthServer } from '../../services/oauth/local-oauth-server';
import { tokenStorage } from '../../storage/token-storage';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://localhost:3000/callback';
const PORT = 3000;

export async function authGitHub(): Promise<void> {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    console.error('環境変数 GITHUB_CLIENT_ID と GITHUB_CLIENT_SECRET を設定してください');
    console.log('または、取得したトークンを直接 daily-report generate --github-token <TOKEN> で指定できます');
    return;
  }

  console.log('GitHub認証を開始します...');

  const oauthServer = new LocalOAuthServer();

  try {
    const code = await oauthServer.startAuthFlow({
      port: PORT,
      authUrl: 'https://github.com/login/oauth/authorize',
      clientId: GITHUB_CLIENT_ID,
      redirectUri: REDIRECT_URI,
      scopes: ['repo', 'user'],
    });

    console.log('認証コードを取得しました。アクセストークンを取得中...');

    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri: REDIRECT_URI,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      throw new Error('アクセストークンの取得に失敗しました');
    }

    tokenStorage.saveToken('github', accessToken);
    console.log('✓ GitHubの認証が完了しました!');
  } catch (error) {
    console.error('認証エラー:', error);
    throw error;
  } finally {
    oauthServer.stop();
  }
}
