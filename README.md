# Vue 2 + Vite

This template should help get you started developing with Vue 2 in Vite. The template uses Vue 2 `<script setup>` SFCs.

For documentation, please refer to the official Vue 2 documentation.

## GitHub Actions Setup

### Set up WebDAV Secrets

Install [GitHub CLI](https://cli.github.com/) and run the following commands to set up WebDAV credentials:

```sh
# Login to GitHub CLI
gh auth login

# Set WebDAV secrets (replace with your actual values)
gh secret set WEBDAV_URL --repo username/vue-bookmark-on-bolt --body "https://your-webdav-server.com"
gh secret set WEBDAV_USERNAME --repo username/vue-bookmark-on-bolt --body "your-username"
gh secret set WEBDAV_PASSWORD --repo username/vue-bookmark-on-bolt --body "your-password"
```

### Automatic Deployment

The project is configured with a GitHub Action workflow that automatically deploys to WebDAV when you push to the `master` branch or push tags. The workflow file is located at `.github/workflows/webdav-publish.yml`.

Deployment target: `online/vue-bookmark-on-bolt`
Build output directory: `./dist`