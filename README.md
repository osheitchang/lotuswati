# lotuswati

This repository includes a Railway deployment guide and a minimal Railway configuration starter.

## Deploy to Railway

Follow the full guide in [`docs/RAILWAY_DEPLOY.md`](docs/RAILWAY_DEPLOY.md).

Quick path:

1. Push this repo to GitHub.
2. In Railway, create a **New Project** -> **Deploy from GitHub repo**.
3. Set your service **Start Command** (or add a `Procfile`) for your app runtime.
4. Add required environment variables in Railway -> **Variables**.
5. Deploy and monitor logs in Railway -> **Deployments**.

> If your app requires a custom build/runtime, use a `Dockerfile` and Railway will build from it.
