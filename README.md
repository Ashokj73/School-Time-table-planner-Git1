# SchoolFlow SaaS — Multi-User Timetable & Staff Cover Platform

> **Product Status**: Production Ready  
> **Deployment Target**: Vercel  
> **Authentication**: Google ID (OAuth 2.0 / Google Identity Services)  
> **Architecture**: Multi-Tenant Cloud Web Application with Isolated Data Storage (Inputs & Outputs)

---

## 🌟 SaaS Platform Highlights

1. **Google ID Authorization**:
   - Seamless sign-in via Google Identity Services (GIS).
   - Built-in multi-persona sandbox switcher for instant local demonstration of multi-user data isolation.
2. **Multi-User Data Isolation**:
   - Each administrator/individual operates in a secure, isolated workspace keyed to their unique Google ID (`google-sub-*`).
   - Timetables, teacher rosters, classes, absences, and assignments belonging to User A are completely inaccessible to User B.
3. **Persistent Inputs & Outputs**:
   - **Inputs Saved**: School instructional days, daily period timings, custom break intervals, teacher roster, curriculum subjects, class cohorts, weekly teaching allocations, recorded absences, and delegated tasks.
   - **Outputs Saved**: Algorithmic clash-free weekly timetable matrices, automated absence cover decisions, coverage rates, and teacher workload analytics.
   - Real-time auto-saving with visual Cloud Sync status indicators (`🟢 Cloud Synced`, `🟡 Syncing...`).
   - Manual snapshot creation for archiving published versions.
4. **Multi-Timetable Workspace**:
   - Create, rename, clone, and switch between multiple timetables (e.g. *Term 1 2026-27*, *Exam Schedule*, *Middle School Timetable*).
5. **Turnkey Vercel Deployment**:
   - Built-in `vercel.json` with security headers (`Cross-Origin-Opener-Policy` for Google OAuth popups).
   - Zero complex server maintenance or heavy build steps required.

---

## 🚀 How to Publish to Vercel

### Method 1: Deploy via GitHub (Recommended)
1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Transform SchoolFlow into multi-user SaaS with Google ID auth"
   git push origin main
   ```
2. **Import into Vercel:**
   - Go to [vercel.com](https://vercel.com) and log in.
   - Click **"Add New..."** > **"Project"**.
   - Select your GitHub repository (`School-Time-table-planner`).
   - Leave the build settings as default (Framework Preset: *Other*).
   - Click **Deploy**!
3. Your SaaS is now live at `https://school-time-table-planner-xxxx.vercel.app`!

---

## 🔐 Google Cloud Console Setup (Google ID Authorization)

To enable live Google Sign-In on your Vercel deployment:

1. Go to the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).
2. Click **Create Credentials** > **OAuth client ID**.
3. Select Application type: **Web application**.
4. Under **Authorized JavaScript origins**, add:
   - `http://localhost`
   - `http://localhost:3000`
   - `http://localhost:5000`
   - `https://your-project-name.vercel.app` (your Vercel URL)
5. Under **Authorized redirect URIs**, add:
   - `http://localhost`
   - `https://your-project-name.vercel.app`
6. Click **Create** and copy your **Client ID** (e.g., `123456789-abcdef.apps.googleusercontent.com`).
7. In the SchoolFlow SaaS app, click on your user profile in the top-right corner, paste the Client ID into the **Google OAuth 2.0 Credentials** field, and click **Save**.

---

## 🧪 Local Verification & Demonstration

You can test the application right now without setting up any credentials:

1. Open `index.html` directly in any web browser.
2. Click the **User Profile** widget in the top right corner to open the **Account Hub**.
3. Click between **Dr. Sarah Jenkins** and **Prof. Michael Chen** in the Sandbox Switcher:
   - Notice how switching accounts immediately switches to that specific administrator's private timetables, inputs, and outputs!
   - Modify a teacher's name or period time in one account, then switch to the other account: the data remains 100% separate and isolated.
4. Click **Manage** next to the Timetable dropdown to create a new timetable (e.g., "Term 2 2026/27") and switch between them.
5. Click **Day-wise Excel**, **Weekly Master Excel**, or **Print Day / PDF** to generate formatted outputs.

---

## 📂 Project Architecture

```text
├── index.html           # Main SaaS single-page application shell
├── vercel.json          # Vercel deployment & security headers configuration
├── package.json         # Project metadata and deployment scripts
├── css/
│   └── styles.css       # Complete enterprise design system and responsive layout
├── js/
│   ├── auth.js          # Google Identity Services controller & multi-user session manager
│   ├── config.js        # Runtime Google Cloud & Firebase configuration hub
│   ├── storage.js       # Multi-tenant persistence engine for inputs and outputs
│   ├── scheduler.js     # Timetable allocation algorithm & fair cover resolution
│   ├── exports.js       # Excel, PDF, and CSV export generators
│   └── ui.js            # Master UI orchestration, reactive state, and modal controller
└── README.md            # Product & deployment documentation
```
