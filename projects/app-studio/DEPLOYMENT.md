# Cloudflare Workers Deployment Guide

Complete guide for deploying your Pixel Studio website to Cloudflare Workers with Assets.

## Prerequisites

- Cloudflare account (free tier works)
- pnpm installed
- Git repository with your code
- Wrangler CLI installed

## Step 1: Install Wrangler

```bash
pnpm add -g wrangler
```

Or install locally:

```bash
pnpm add -D wrangler
```

## Step 2: Login to Cloudflare

```bash
wrangler login
```

This will open a browser window for authentication.

## Step 3: Build Your Project

```bash
pnpm build
```

This creates the `out` directory with your static files.

## Step 4: Configure wrangler.jsonc

The `wrangler.jsonc` is already configured:

```jsonc
{
  "name": "app-studio",
  "compatibility_date": "2024-01-01",
  "assets": {
    "directory": "./out",
    "binding": "ASSETS"
  },
  "main": "src/index.ts"
}
```

Update the `name` field to your desired worker name.

## Step 5: Deploy

```bash
wrangler deploy
```

Your site will be available at:
- `https://app-studio.<your-subdomain>.workers.dev`

## Custom Domain Setup

### 1. Add Custom Domain

```bash
wrangler domains add yourdomain.com
```

Or use the Cloudflare Dashboard:

1. Go to Workers & Pages
2. Select your worker
3. Click "Custom Domains"
4. Add your domain

### 2. DNS Configuration

Cloudflare will automatically configure DNS if your domain is on Cloudflare.

For external domains:
- Add a CNAME record pointing to your workers.dev URL

## Environment Variables

If you need environment variables:

```bash
# Add secret
wrangler secret put SECRET_NAME

# Add regular variable in wrangler.jsonc
{
  "vars": {
    "API_URL": "https://api.example.com"
  }
}
```

## Continuous Deployment

### Using GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm build

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

Add `CLOUDFLARE_API_TOKEN` to your GitHub repository secrets.

## Monitoring & Analytics

### Enable Web Analytics

1. Go to Cloudflare Dashboard
2. Navigate to Analytics > Web Analytics
3. Add your site
4. Copy the beacon script
5. Add to `app/layout.tsx`

### Workers Analytics

View in Cloudflare Dashboard:
- Requests per second
- CPU time
- Bandwidth usage
- Error rates

## Performance Optimization

### Cache Configuration

Workers Assets automatically caches static files. For custom caching:

```typescript
// src/index.ts
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Custom cache for specific paths
    if (url.pathname.startsWith('/api')) {
      return fetch(request);
    }
    
    return env.ASSETS.fetch(request);
  },
};
```

### Compression

Cloudflare automatically compresses responses. To verify:

```bash
curl -H "Accept-Encoding: gzip" https://yourdomain.com -I
```

## Security Headers

Add security headers in `src/index.ts`:

```typescript
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
```

## Troubleshooting

### Build Errors

```bash
# Clear cache and rebuild
rm -rf .next out
pnpm build
```

### Deployment Fails

```bash
# Check wrangler version
wrangler --version

# Update wrangler
pnpm add -g wrangler@latest

# Check logs
wrangler tail
```

### 404 Errors

Ensure `output: 'export'` is set in `next.config.mjs`.

### Slow Performance

1. Check Worker CPU time in dashboard
2. Optimize images
3. Enable Cloudflare caching
4. Use CDN for static assets

## Rollback

### Rollback to Previous Version

```bash
# List deployments
wrangler deployments list

# Rollback to specific deployment
wrangler rollback <deployment-id>
```

## Cost Estimation

Cloudflare Workers free tier includes:
- 100,000 requests/day
- 10ms CPU time per request

For most static sites, free tier is sufficient.

Paid plan ($5/month):
- 10 million requests/month
- Additional requests: $0.50 per million

## Best Practices

1. **Test Locally**: Always test build before deploying
2. **Use Staging**: Deploy to staging worker first
3. **Monitor Logs**: Check `wrangler tail` regularly
4. **Optimize Assets**: Compress images, minify CSS/JS
5. **Cache Wisely**: Leverage Cloudflare's edge cache
6. **Set Headers**: Configure security headers
7. **Version Control**: Tag releases in Git
8. **Document Changes**: Keep changelog updated

## Preview Deployments

Preview before deploying to production:

```bash
# Create preview
wrangler deploy --dry-run

# Deploy to preview URL
wrangler deploy --env preview
```

## Advanced Configuration

### Multiple Environments

Create `wrangler.production.jsonc` and `wrangler.staging.jsonc`:

```bash
# Deploy to staging
wrangler deploy --config wrangler.staging.jsonc

# Deploy to production
wrangler deploy --config wrangler.production.jsonc
```

### Rate Limiting

Implement rate limiting in worker:

```typescript
// src/index.ts
const rateLimiter = {
  async limit(request: Request): Promise<boolean> {
    // Implement your rate limiting logic
    return true;
  }
};
```

## Support & Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [Next.js Docs](https://nextjs.org/docs)

## Quick Commands Reference

```bash
# Login
wrangler login

# Build
pnpm build

# Deploy
wrangler deploy

# View logs
wrangler tail

# List deployments
wrangler deployments list

# Rollback
wrangler rollback <id>

# Add domain
wrangler domains add yourdomain.com
```

---

Happy deploying! 🚀
