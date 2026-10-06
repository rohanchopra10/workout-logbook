# Workout Logbook

Your own workout app: weekly Double-part / Single-part plan, today's-workout menu (every double-part combination plus Custom), last-time weights and reps filled in, exercise library (212 exercises, each with a short step-by-step tutorial) with smart swaps, warm-up and cool-down, cardio, weekly weigh-in, history, progress charts and coach feedback through Claude.

Works on iPhone and Android. Without an account, workouts are saved only on the phone. With a free account (Supabase), they are also saved privately in the cloud and sync across phones. Workouts are never uploaded to GitHub.

## Files in this folder

| File | What it is |
|---|---|
| `index.html` | The app |
| `manifest.webmanifest` | Lets iPhone install it with a name and icon |
| `sw.js` | Makes the app open even without internet |
| `config.js` | Your Supabase Project URL and publishable key (turns on accounts) |
| `supabase.js` | Sign-in and cloud sync library (don't edit) |
| `supabase-setup.sql` | Run once in Supabase to create the private database table (no need to upload it to GitHub, harmless if you do) |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | App icons |
| `demos/` | Start/finish exercise photos for the looping demos (public domain, from the free-exercise-db project; see `demos/LICENSE.md`) |
| `README.md` | This guide |

## 1. Put the app online (free, about 10 minutes, one time)

1. Go to **github.com** and create a free account (skip this if you have one).
2. Click **+** (top right) → **New repository**.
   - Repository name: `workout-logbook`
   - Choose **Public** (free Pages needs public; only the app code is public, never your workouts).
   - Click **Create repository**.
3. On the new repository page, click the link **uploading an existing file**.
4. Open this folder on your PC, select **all the files** (not the folder itself) and drag them into the browser. Click **Commit changes**.
5. Go to **Settings** → **Pages** (left menu).
   - Source: **Deploy from a branch**
   - Branch: **main**, folder **/ (root)** → **Save**.
6. Wait 1–2 minutes and refresh the Pages screen. Your app link appears, like
   `https://YOUR-USERNAME.github.io/workout-logbook/`

## 2. Install it on your phone

**Android:** open the link in **Chrome** → **⋮** menu → **Add to Home screen** (or **Install app**).

**iPhone:**

1. Open your app link in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. From now on, **always open it from the Logbook icon** on your home screen. (Safari and the icon keep separate data.)

## 3. Move your history from the Claude logbook (one time)

1. Open the old logbook in Claude → **History** → **Copy backup**.
2. Open the new app from the home-screen icon. The welcome screen asks for your backup.
3. Paste it and tap **Restore my history**. All workouts, weigh-ins, plan and exercise preferences come across.

## Everyday use

- **Coach feedback:** after saving, open the workout in History → **Copy for Claude** → paste into any Claude chat. Paste Claude's reply back with **Paste Claude's reply** to keep it with the workout.
- **Back up every week or two:** History → **Save backup file** (save it to iCloud Drive or Files), or **Copy backup** into Notes. The app reminds you after 10 days. If you ever change phones or delete the app, **Restore from file** brings everything back.

## Updating the app later

When you get a new `index.html`, open your repository on GitHub → **Add file** → **Upload files** → drop the new file → **Commit changes**. The app updates the next time you open it with internet. Your data stays untouched.

## Accounts and cloud sync (Supabase, free)

1. Go to **supabase.com** → **Start your project** → sign in with GitHub.
2. **New project**: name `workout-logbook`, create a strong database password (save it somewhere), region **South Asia (Mumbai)** → **Create new project**. Wait about 2 minutes.
3. **SQL Editor** → **New query** → paste everything from `supabase-setup.sql` → **Run**. It should say *Success*.
4. **Authentication** → **Sign In / Providers** → **Email**: keep it enabled and turn **Confirm email** OFF → **Save**. (Supabase's free email sender only delivers to your own address, so friends would never get a confirmation email.)
5. **Authentication** → **URL Configuration**: Site URL `https://rohanchopra10.github.io/workout-logbook/` → **Save**.
6. **Project Settings** → **API Keys** (and **Data API** for the URL): copy the **Project URL** and the **Publishable key** (starts with `sb_publishable_`, or the `anon` key). Never use the `secret` / `service_role` key.
7. Put both into `config.js`, then upload `config.js`, `supabase.js`, `index.html` and `sw.js` to GitHub.

Password reset emails reach only you until you add your own email sender (Authentication → Emails → SMTP settings).
