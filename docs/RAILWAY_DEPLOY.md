# Railway deployment guide

This repo is currently a starter/empty app repo, so Railway needs to know how to run your app.

## 1) Connect GitHub to Railway

1. Commit and push your code to GitHub.
2. Open Railway and click **New Project**.
3. Choose **Deploy from GitHub repo** and select this repository.

## 2) Pick one runtime strategy

Use **one** of the following:

### Option A: Start Command in Railway UI (fastest)

Set the command in Railway service settings:

- Node.js: `npm run start`
- Python (FastAPI/Uvicorn): `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Go: `./your-binary`

### Option B: `Procfile`

Add a `Procfile` in repo root:

```txt
web: <your start command>
```

Example:

```txt
web: npm run start
```

### Option C: Dockerfile (most control)

If you add a `Dockerfile`, Railway builds and runs it directly.

## 3) Configure environment variables

In Railway service -> **Variables**, add your app configuration:

- `PORT` is provided automatically by Railway.
- Add secrets like `DATABASE_URL`, `API_KEY`, etc.

Do not hardcode secrets in source.

## 4) Configure build/watch settings (optional)

This repo includes a starter `railway.json`.

- `watchPatterns` controls which file changes trigger deploys.
- Adjust to match your stack.

## 5) Deploy and verify

1. Trigger deployment from Railway UI (or by pushing to your connected branch).
2. Open **Deployments** logs.
3. Fix errors if build/start fails.
4. Once healthy, open generated Railway domain.

## 6) Common issues

- **App starts on wrong port**: make sure app listens on `0.0.0.0:$PORT`.
- **No start command**: set service Start Command or add `Procfile`/`Dockerfile`.
- **Build not detected**: ensure `package.json`, `requirements.txt`, or Dockerfile is present.
- **Crash loop**: inspect Railway logs and confirm required env vars are set.
