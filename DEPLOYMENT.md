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

## ⚡ Option 2: Vercel

1. Sign in to [Vercel.com](https://vercel.com).
2. Click **Add New** &rarr; **Project**.
3. Import your GitHub repository: `RahulNayak793/Railway-management-system`.
4. Vercel will automatically detect `vercel.json` and deploy both the serverless API (`/api/*`) and the static frontend React build.

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
