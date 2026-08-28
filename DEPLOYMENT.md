# 🚀 Full-Stack Deployment Guide

This project is fully configured for production deployment across all major cloud providers.

---

## 🌟 Option 1: Render.com (Recommended - 1-Click Deployment)

1. Sign in to [Render.com](https://render.com).
2. Click **New +** &rarr; **Web Service**.
3. Connect your GitHub repository: `https://github.com/RahulNayak793/Railway-management-system.git`.
4. Render will automatically detect `render.yaml`:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
5. Click **Create Web Service**. Render will automatically build the frontend, start the Express backend, and provide your live URL (e.g. `https://railway-management-system.onrender.com`).

---

## ⚡ Option 2: Hybrid Setup (Render Backend + Vercel Frontend - RECOMMENDED)

This setup runs your database-intensive Express.js backend on **Render.com** (to avoid serverless cold starts and execution timeouts) and hosts your React frontend on **Vercel.com** for maximum speed.

### Step 1: Deploy Backend to Render.com
1. Sign in to [Render.com](https://render.com).
2. Click **New +** &rarr; **Web Service**.
3. Link your GitHub repository.
4. Select **Node** as the runtime environment.
5. Set:
   - **Build Command:** `npm install --prefix backend`
   - **Start Command:** `npm run start --prefix backend`
6. Under **Environment Variables**, configure any required secrets (e.g., Supabase, Stripe, JWT_SECRET, nodemailer credentials).
7. Create the service. Once deployed, note down your Render Web Service URL (e.g. `https://railway-backend.onrender.com`).

### Step 2: Deploy Frontend to Vercel.com
You can link your Vercel frontend to the Render backend using either of the following methods:

#### Method A: Dashboard Environment Variable (Simplest - No Code Edits)
1. Import your repository into [Vercel](https://vercel.com).
2. During setup, under **Environment Variables**, add:
   - **Key:** `RENDER_BACKEND_URL`
   - **Value:** Your Render Web Service URL (e.g., `https://railway-backend.onrender.com`)
3. Deploy! The serverless proxy in `api/index.js` will dynamically route all `/api/*` traffic to Render.

#### Method B: Native Vercel Rewrite Rules (Highest Performance)
1. Open `vercel.json` in your repository.
2. Modify the `/api/:path*` rewrite rule to route directly to your Render URL:
   ```json
   {
     "source": "/api/:path*",
     "destination": "https://your-backend-service.onrender.com/api/:path*"
   }
   ```
3. Commit and push your changes to GitHub. Vercel will rebuild and handle routing natively at the edge, bypassing serverless function invocation entirely.

---

## 🚂 Option 3: Railway.app / Heroku

1. Create a new project on [Railway.app](https://railway.app) or Heroku.
2. Select **Deploy from GitHub repo**.
3. Set environment variable: `PORT=5000`.
4. The platform will automatically run `npm run build` and `npm start`.

---

## 💻 Local Production Preview Mode

To test production mode locally:
```bash
# Build frontend for production
npm run build

# Start production server
npm start
```
Open `http://localhost:5000` in your browser.
