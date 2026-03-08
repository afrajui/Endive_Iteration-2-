[README.md](https://github.com/user-attachments/files/25828941/README.md)
# 🌿 Endive — Your Personal Assistant

A PWA-ready personal assistant for college students, built with React + Vite. Powered by Claude AI.

---

## 🚀 Deploy to Vercel (Free, ~5 min)

### 1. Get an Anthropic API Key
- Go to [console.anthropic.com](https://console.anthropic.com)
- Sign up / log in → **API Keys** → **Create Key**
- Copy the key (starts with `sk-ant-...`)

### 2. Push to GitHub
```bash
git init
git add .
git commit -m "Initial Endive app"
```
- Go to [github.com/new](https://github.com/new) and create a new repo
```bash
git remote add origin https://github.com/YOUR_USERNAME/endive.git
git push -u origin main
```

### 3. Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → sign in with GitHub
2. Click **"Add New Project"** → import your `endive` repo
3. Click **Deploy** (Vercel auto-detects Vite/React)
4. Once deployed, go to **Settings → Environment Variables**
5. Add: `ANTHROPIC_API_KEY` = your key from step 1
6. Go to **Deployments** → click **Redeploy** to apply the key

Your app is now live at `https://endive.vercel.app` (or similar)!

---

## 📱 Install as a Phone App (PWA)

### iPhone / Safari
1. Open your Vercel URL in **Safari**
2. Tap the **Share** button (box with arrow)
3. Tap **"Add to Home Screen"**
4. Tap **Add** — Endive appears on your home screen like a real app!

### Android / Chrome
1. Open your Vercel URL in **Chrome**
2. Tap the **three dots menu** → **"Add to Home screen"**
3. Tap **Add** — done!

---

## 💻 Run Locally (Development)

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173)

> Note: For local dev, the `/api/chat` serverless function won't run.
> Either use `vercel dev` (install Vercel CLI: `npm i -g vercel`) or
> temporarily swap `/api/chat` back to the Anthropic URL with your key in a `.env` file.

---

## 📁 Project Structure

```
endive/
├── api/
│   └── chat.js          # Vercel serverless function (keeps API key secret)
├── public/
│   ├── icon-192.png     # PWA icon
│   ├── icon-512.png     # PWA icon
│   ├── apple-touch-icon.png
│   └── favicon.ico
├── src/
│   ├── main.jsx         # React entry point
│   └── App.jsx          # Main Endive app
├── index.html
├── vite.config.js       # Vite + PWA plugin config
└── package.json
```

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key — set this in Vercel dashboard |

Never commit your API key to GitHub!
