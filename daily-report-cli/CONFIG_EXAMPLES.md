# Daily Report CLI Configuration Examples

## OAuth App Setup

### GitHub
1. Visit: https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - Application name: Daily Report CLI
   - Homepage URL: http://localhost
   - Authorization callback URL: http://localhost:3000/callback
4. Copy Client ID and Client Secret

### Asana
1. Visit: https://app.asana.com/0/my-apps
2. Click "Create new app"
3. Fill in app details
4. Add redirect URL: http://localhost:3000/callback
5. Copy Client ID and Client Secret

### Google Tasks
1. Visit: https://console.cloud.google.com/
2. Create a new project
3. Enable Google Tasks API
4. Create OAuth 2.0 Client ID
5. Add redirect URI: http://localhost:3000/callback
6. Copy Client ID and Client Secret

### Trello
1. Visit: https://trello.com/app-key
2. Copy API Key
3. No additional setup needed

## Environment Variables for GitHub Actions

```yaml
# Add these as repository secrets
GITHUB_TOKEN: automatically provided by GitHub Actions
ASANA_TOKEN: your_asana_access_token
GOOGLE_TASKS_TOKEN: your_google_tasks_access_token
TRELLO_TOKEN: your_trello_access_token
```

## Token Storage Location

Tokens are stored locally at:
```
~/.daily-report-cli/tokens.json
```

Format:
```json
{
  "github": "ghp_...",
  "asana": "...",
  "googleTasks": "...",
  "trello": "..."
}
```

## Custom Template Example

Create a file `custom-template.md`:

```handlebars
# 📊 Daily Report - {{formatDate date "yyyy/MM/dd (EEE)"}}

## 📝 Summary
Total commits: {{count git.commits}}
Total PRs reviewed: {{count github.prComments}}
Total tasks completed: {{count asana.completedTasks}}

## 💻 Development Activity

{{#if (isNotEmpty git.commits)}}
### Git Commits
{{#each git.commits}}
- **{{repository}}** | `{{branch}}`
  ```
  {{message}}
  ```
  {{formatDate date "HH:mm"}}
{{/each}}
{{/if}}

{{#if (isNotEmpty github.commits)}}
### GitHub Commits
{{#each github.commits}}
- {{link (truncate message 50) commitUrl}}
  {{formatDate date "HH:mm"}} | {{link repository repositoryUrl}}
{{/each}}
{{/if}}

## 📋 Task Management

{{#if (isNotEmpty asana.completedTasks)}}
### ✅ Completed ({{count asana.completedTasks}})
{{#each asana.completedTasks}}
- {{link title url}}
{{/each}}
{{/if}}

{{#if (isNotEmpty asana.createdTasks)}}
### 🆕 Created ({{count asana.createdTasks}})
{{#each asana.createdTasks}}
- {{link title url}}
{{/each}}
{{/if}}

---
Generated at {{formatDate date "yyyy-MM-dd HH:mm:ss"}}
```

Use with:
```bash
daily-report generate --template custom-template.md
```
