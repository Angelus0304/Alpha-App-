# Alpha Business Concepts (ABC)

A React Native (Expo) app guiding South African business owners to sustainability
and growth — Marketing, Tech & Software, Human Resources, Forms & Templates, and
a Knowledge Base, all reachable from a single dashboard.

## App map

```
Login (User Login / Main Page)
  -> Dashboard (5 header buttons)
       -> Marketing            (a-i: Logo Creation ... Ad Creation)
       -> Tech and Software    (a-l: Website Setup ... Telecoms/ISP)
       -> Human Resources      (a-h: Labour Law ... Online Courses)
       -> Forms and Templates  (a: Enter Portal -> external link)
       -> Knowledge Base       (a-g: FAQ's ... Different Industry Sectors)
```

Every header button on the Dashboard opens a **Category** screen listing its
lettered sub-items; tapping a sub-item opens an **Item Detail** screen.

## Project structure

```
App.js                        entry point
src/
  navigation/RootNavigator.js  stack navigator + auto-login check
  screens/
    LoginScreen.js             User Login / Main Page
    DashboardScreen.js         header buttons (categories)
    CategoryScreen.js          lettered sub-item list for a category
    ItemDetailScreen.js        renders info / link / list content
  data/appData.js              ALL category + sub-item content lives here
  components/                  CategoryButton, ListItem, ScreenHeader
  theme/colors.js              brand colors, spacing, radius tokens
assets/                        icon.png, adaptive-icon.png, splash.png, favicon.png
```

**To edit any screen's copy, wording, or sub-items, edit `src/data/appData.js`.**
That one file drives navigation and content for every category — you don't need
to touch screen code to change text, add a new sub-item, or reorder items.

## What's real vs. what's a placeholder

- **Real & working:** navigation flow, all 5 categories, all ~44 sub-items,
  login gate (session persisted with AsyncStorage), external link handling
  (Forms and Templates), list-style Knowledge Base screens.
- **Placeholder / to wire up before launch:**
  - **Authentication** — `LoginScreen.js` currently mocks login (any
    email/password works, stored locally). Connect it to a real backend
    (e.g. Firebase Auth, Supabase Auth, or your own API).
  - **"Get Started" buttons** on info screens are stubs — wire them to
    whatever action each service needs (a form, a request, a booking flow,
    a payment, etc.).
  - **Contact numbers, department names, and links** in `appData.js` under
    Knowledge Base are best-effort references — verify and update them
    before shipping (government contact details change).
  - Some Tech & Software items (CRM, POS, App Development, Chat-Bots) are
    themselves large product categories — decide whether ABC will build
    these in-house, integrate a third-party provider, or route users to a
    request/quote form.

## Running the app locally

```bash
npm install
npm start          # opens Expo Dev Tools / QR code
# then press "i" for iOS simulator, "a" for Android emulator,
# or scan the QR code with the Expo Go app on your phone
```

Requires Node.js 18+, and Xcode (for iOS simulator) or Android Studio
(for Android emulator) if not testing on a physical device.

## Building for the App Store / Google Play

This project is set up for [EAS Build](https://docs.expo.dev/build/introduction/),
Expo's cloud build service:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios
eas build --platform android
```

Then submit with:

```bash
eas submit --platform ios
eas submit --platform android
```

You'll need:
- An Apple Developer account ($99/year) for `bundleIdentifier`
  `com.alphabusinessconcepts.app` (change this in `app.json` if needed)
- A Google Play Console account ($25 one-time) for `package`
  `com.alphabusinessconcepts.app`
- Your own app icon/splash artwork for production (placeholders are in
  `/assets` — an "ABC" navy-and-amber badge — swap these for final artwork)

## Next steps worth prioritizing

1. Replace mock login with real authentication.
2. Decide which Tech & Software items are actual built-in tools vs.
   request/lead-generation forms that route to a human team.
3. Verify every phone number, URL, and department name in the Knowledge
   Base section.
4. Add real icon/splash artwork sized per Apple/Google guidelines
   (1024x1024 icon, etc. — current placeholders are already sized correctly,
   just need final branding).
