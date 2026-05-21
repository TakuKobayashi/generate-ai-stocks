// VAPID鍵ペアを生成するスクリプト
// Node.jsで実行: node scripts/generate-vapid-keys.js

const crypto = require('crypto');

function generateVAPIDKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: {
      type: 'spki',
      format: 'der'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der'
    }
  });

  const publicKeyBase64 = urlBase64Encode(publicKey);
  const privateKeyBase64 = urlBase64Encode(privateKey);

  console.log('VAPID Keys Generated:');
  console.log('====================');
  console.log('Public Key:', publicKeyBase64);
  console.log('Private Key:', privateKeyBase64);
  console.log('');
  console.log('Add these to your wrangler.toml:');
  console.log(`VAPID_PUBLIC_KEY = "${publicKeyBase64}"`);
  console.log('');
  console.log('Set the private key as a secret:');
  console.log(`wrangler secret put VAPID_PRIVATE_KEY`);
  console.log('Then paste:', privateKeyBase64);
}

function urlBase64Encode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

generateVAPIDKeys();
