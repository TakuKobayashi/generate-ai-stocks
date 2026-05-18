import axios from 'axios';
import { LocalOAuthServer } from '../../services/oauth/local-oauth-server';
import { tokenStorage } from '../../storage/token-storage';

// Asana
const ASANA_CLIENT_ID = process.env.ASANA_CLIENT_ID || '';
const ASANA_CLIENT_SECRET = process.env.ASANA_CLIENT_SECRET || '';
const ASANA_REDIRECT_URI = 'http://localhost:3001/callback';

export async function authAsana(): Promise<void> {
  if (!ASANA_CLIENT_ID || !ASANA_CLIENT_SECRET) {
    console.error('環境変数 ASANA_CLIENT_ID と ASANA_CLIENT_SECRET を設定してください');
    return;
  }

  console.log('Asana認証を開始します...');

  const oauthServer = new LocalOAuthServer();

  try {
    const code = await oauthServer.startAuthFlow({
      port: 3001,
      authUrl: 'https://app.asana.com/-/oauth_authorize',
      clientId: ASANA_CLIENT_ID,
      redirectUri: ASANA_REDIRECT_URI,
      scopes: [],
    });

    const tokenResponse = await axios.post(
      'https://app.asana.com/-/oauth_token',
      {
        grant_type: 'authorization_code',
        client_id: ASANA_CLIENT_ID,
        client_secret: ASANA_CLIENT_SECRET,
        code: code,
        redirect_uri: ASANA_REDIRECT_URI,
      }
    );

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      throw new Error('アクセストークンの取得に失敗しました');
    }

    tokenStorage.saveToken('asana', accessToken);
    console.log('✓ Asanaの認証が完了しました!');
  } catch (error) {
    console.error('認証エラー:', error);
    throw error;
  } finally {
    oauthServer.stop();
  }
}

// Google Tasks
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = 'http://localhost:3002/callback';

export async function authGoogleTasks(): Promise<void> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('環境変数 GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を設定してください');
    return;
  }

  console.log('Google Tasks認証を開始します...');

  const oauthServer = new LocalOAuthServer();

  try {
    const code = await oauthServer.startAuthFlow({
      port: 3002,
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      clientId: GOOGLE_CLIENT_ID,
      redirectUri: GOOGLE_REDIRECT_URI,
      scopes: ['https://www.googleapis.com/auth/tasks'],
    });

    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        grant_type: 'authorization_code',
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code: code,
        redirect_uri: GOOGLE_REDIRECT_URI,
      }
    );

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      throw new Error('アクセストークンの取得に失敗しました');
    }

    tokenStorage.saveToken('googleTasks', accessToken);
    console.log('✓ Google Tasksの認証が完了しました!');
  } catch (error) {
    console.error('認証エラー:', error);
    throw error;
  } finally {
    oauthServer.stop();
  }
}

// Trello
const TRELLO_API_KEY = process.env.TRELLO_API_KEY || '';
const TRELLO_REDIRECT_URI = 'http://localhost:3003/callback';

export async function authTrello(): Promise<void> {
  if (!TRELLO_API_KEY) {
    console.error('環境変数 TRELLO_API_KEY を設定してください');
    console.log('APIキーは https://trello.com/app-key から取得できます');
    return;
  }

  console.log('Trello認証を開始します...');

  const oauthServer = new LocalOAuthServer();

  try {
    const token = await oauthServer.startAuthFlow({
      port: 3003,
      authUrl: 'https://trello.com/1/authorize',
      clientId: TRELLO_API_KEY,
      redirectUri: TRELLO_REDIRECT_URI,
      scopes: ['read', 'write'],
    });

    // Trelloの場合、tokenが直接返される
    tokenStorage.saveToken('trello', token);
    console.log('✓ Trelloの認証が完了しました!');
  } catch (error) {
    console.error('認証エラー:', error);
    throw error;
  } finally {
    oauthServer.stop();
  }
}
