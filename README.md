# HRMS — Attendance & Salary

A small HR app (employees, attendance, advances, salary slips) built with React + Vite, synced across devices via Firebase (Firestore + Auth) and deployed on Firebase Hosting.

## One-time setup (do this before the app will run)

1. **Create a Firebase project** at [console.firebase.google.com](https://console.firebase.google.com) (the free Spark plan is enough — Hosting is free on Spark too).
2. **Enable Firestore**: Build → Firestore Database → Create database → production mode, any region.
3. **Enable Email/Password sign-in**: Build → Authentication → Sign-in method → enable "Email/Password".
4. **Set the Firestore security rules**: Build → Firestore Database → Rules → paste the contents of [`firestore.rules`](./firestore.rules) → Publish. (This is what keeps your data private to your own account — don't skip it.)
5. **Register a web app**: Project Settings (gear icon) → General → "Your apps" → add a web app (`</>`) → copy the config values shown.
6. **Local development**: copy `.env.local.example` to `.env.local` and fill in the 6 values from step 5. `.env.local` is gitignored — never commit it.
7. **Deployed build (Firebase Hosting via GitHub Actions)**:
   - Add the same 6 values as **GitHub repository secrets** — Settings → Secrets and variables → Actions — named exactly as in `.env.local.example` (`VITE_FIREBASE_API_KEY`, etc.).
   - Generate a deploy credential: Firebase Console → Project settings → **Service accounts** tab → **Generate new private key** (downloads a JSON file).
   - Add that JSON file's entire contents as one more GitHub secret named **`FIREBASE_SERVICE_ACCOUNT`**.
   - Pushing to `master` runs [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml), which builds and publishes to `https://hrms-a28cd.web.app`.
8. **(Optional) Deploy manually from your own machine** instead of/alongside GitHub Actions: install the CLI once (`npm install -g firebase-tools`), run `firebase login`, then `npm run build && firebase deploy`. `.firebaserc` already points at the `hrms-a28cd` project.

The first time you open the app (locally or on the deployed site), use the "create one" link on the sign-in screen to make your account — the same email/password works on every device and keeps your data in sync.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — type-check + production build (`dist/`)
- `npm test` — run the test suite (uses an in-memory fake of Firestore/Auth, no real project needed)
- `npm run lint` — oxlint
