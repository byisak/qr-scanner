# QR Scanner Privacy Policy

Cubion (큐비온, "we", "us") processes and protects the personal information of people who use the QR Scanner app for Android and iOS (the "App") and the scanview.app real-time scan viewer (together with the App, the "Service") in accordance with the Personal Information Protection Act of Korea and other applicable laws. This policy describes App version 1.3.0 and takes effect on October 16, 2026.

## 1. Summary

- Most features (scanning, creating codes, managing history) work without an account. In that case your scan history, created codes, scan photos and settings are stored **only on your device** and are never sent to our server.
- The App **contains no ads and does not collect the advertising ID.**
- Information reaches our server (scanview.app) only when you (1) sign up or sign in, or (2) turn on **Realtime Server Sync** yourself while signed in.
- Usage analytics (Firebase Analytics) is on by default on Android and off by default on iOS. You can turn it on or off at any time under **Settings → App Info & Support → Usage Analytics**.
- You can delete your account and server data from within the App, or request deletion as described on the [Account & Data Deletion](https://scanview.app/legal/account-deletion?lang=en) page.

## 2. Information we process and how we collect it

### 2-1. Sign-up and sign-in (optional)

An account is optional. Realtime Server Sync requires signing in.

- **Email sign-up:** email address, password and name (nickname). Passwords are stored only as a salted scrypt hash that cannot be reversed.
- **Sign in with Google:** your Google account's email address, name, profile photo URL and unique Google account ID
- **Sign in with Apple (iOS):** the email address Apple provides (or Apple's private relay address if you choose it), your name (if shared) and unique Apple account ID
- **Generated automatically:** member ID, authentication tokens that keep you signed in, a random device identifier created by the App (used only to tell your signed-in devices apart; it is not the advertising ID or a hardware ID), sign-up date, last sign-in/activity time, and feature-unlock status

### 2-2. Realtime Server Sync (optional, sign-in required)

Only when you turn on Settings → Realtime Server Sync, the following is sent to and stored on the scanview.app server each time you scan:

- The content (value) of the scanned code, the scan time and your member ID
- Session information: session ID, session name, public/private setting, session password (if set, stored as a hash), creation and last-activity times

**Important:** new sessions are **public** by default. Anyone who has the session link can view its scans on the web. If you send codes containing personal or sensitive information, make the session private or set a password.

### 2-3. Usage analytics (Firebase Analytics)

To improve the App we use Google's Firebase Analytics to collect:

- The app instance ID (an identifier Firebase creates for each installation), screen views and feature events (for example, the **type** and format of codes you scan or create, how you save or share, settings changes and error types)
- Information Firebase collects automatically: device model, operating system and version, App version, language, approximate country/region (derived from IP address), first-open and session information

We never send the **content** of codes you scan or create, your email or your name as analytics, and we do not collect the advertising ID. Analytics is on by default on Android; on iOS nothing is collected until you turn it on. Turning off Settings → App Info & Support → Usage Analytics stops collection from that point.

### 2-4. Location (optional)

- **Creating a location QR code:** we ask for location permission only when you tap "current location" on the map screen, and read your device's location only while the App is in use. We never use background location. The location is used only for the map and the QR code you create, and is not sent to our server.
- **Place search:** when you search for a place on the map, the search text and the current map center coordinates (which may be your current location) are sent to Google Maps Platform (Places and Geocoding). Converting coordinates to an address uses your device's built-in location service (Google on Android, Apple on iOS).
- **Connecting to Wi-Fi from a QR code (Android):** Android requires location permission to connect to Wi-Fi networks; the App does not collect your location in this case.

### 2-5. Device permissions and information that stays on your device

We request each permission only when you use the related feature; you can deny it and keep using everything else. The following is not sent to our server (see 2-2 for scan values when Realtime Server Sync is on).

- **Camera:** scanning QR codes and barcodes. Camera frames are analyzed on the device. If "Save Scan Photo" is on, the photo taken at the moment of scanning is kept only in the App's private storage; you can turn this off in Settings.
- **Photos:** used only to **save** created QR codes or scan images to your gallery. To read a code from an image, only the photo you pick in the system photo picker is analyzed on the device; the App does not read your whole photo library.
- **Contacts:** used only when you choose to add a contact (vCard) from a QR code. The App does not read your existing contacts or send them anywhere.
- **Calendar:** used only when you choose to add an event from a QR code; the App looks up which calendars can be written to and writes the event. Event details are not sent anywhere.
- **NFC:** reading NFC tags and saving them to your scan history.
- **Notifications:** only for notifications scheduled on the device, such as lottery draw reminders.
- **Biometrics (Face ID / fingerprint):** used to unlock the App through the operating system. The App never receives or stores biometric data.
- **Wi-Fi state:** used to connect to a network from a Wi-Fi QR code.

### 2-6. Backup (optional)

- **Google Drive backup:** when you run backup or restore, the App saves a backup file (JSON) of your settings and scan history to **your own** Google Drive, and on restore finds and reads that backup file. Backups do not pass through our server and we cannot access them.
- **iCloud (iOS):** if you use iCloud, App data may be synced and backed up to your own iCloud. This also does not pass through our server.

### 2-7. Transfers you set up yourself

- **Scan URL integration and product search:** if you turn these on and choose an address or search site, scanned values are sent to that website and are governed by that website's privacy policy.
- **Lottery result check:** the App queries the Korean lottery operator's (dhlottery.co.kr) website with the draw number only; no personal information is sent.

### 2-8. Information generated while using the Service

When the App or a browser connects to our server, connection records such as IP address, access time and request logs may be kept by the server environment. We use them only for security and troubleshooting.

## 3. Why we process your information

- Identifying members, keeping you signed in, account management and verification (including password-reset emails)
- Creating Realtime Server Sync sessions and showing and managing their scans
- Keeping feature-unlock status across your devices
- Usage statistics, error detection and service improvement (when analytics is on)
- Place search and map display for creating location QR codes
- Preventing abuse, security and answering inquiries

## 4. How long we keep it

- **Account information:** kept until you delete your account. On deletion, sign-in is blocked and sign-in tokens are deleted immediately, and the remaining account information is permanently deleted within 30 days.
- **Realtime Server Sync data (sessions and scan values):** kept until you delete the session or scans. Sessions deleted on the web dashboard stay in the trash for 30 days so they can be restored, and can then be permanently deleted. When you delete your account, they are permanently deleted within 30 days.
- **Feature-unlock records:** kept until you delete your account and deleted within 30 days after that.
- **Analytics data:** deleted automatically when the retention period configured in Firebase (Google Analytics) expires.
- **On-device data (scan history, photos, settings):** stays on your device until you delete it in the App or uninstall the App. We cannot access it.
- If a law requires us to keep certain information, we keep it separately and only for the period the law requires.

## 5. How we destroy information

When the retention period ends or the purpose has been achieved, we destroy the information without delay. Information in our server database is deleted so that it cannot be recovered. We do not keep personal information on paper.

## 6. Disclosure to third parties

We do not provide your personal information to third parties. Exceptions: sessions you make public can be viewed by anyone with the link, and we may disclose information when lawfully required by investigative authorities or other legal process.

## 7. Service providers and international transfers

We use the following providers to run the Service. Data sent to them is transmitted over encrypted connections (HTTPS) while you use the App.

- **Google LLC (United States)**
  - Firebase Analytics: analytics data in 2-3 / app usage analysis / deleted per the configured retention period
  - Google Maps Platform: place search text, map center coordinates / place search and map display / per Google's policies after processing
  - Sign in with Google: Google account information in 2-1 / authentication / until account deletion
  - [Google Privacy Policy](https://policies.google.com/privacy)
- **Apple Inc. (United States, iOS)**
  - Sign in with Apple: Apple account information in 2-1 / authentication / until account deletion
  - [Apple Privacy Policy](https://www.apple.com/legal/privacy/)
- **Server hosting provider:** operating the scanview.app server and database (account information and Realtime Server Sync data) / until the service contract ends or you delete your account

You can refuse these transfers by turning off analytics or by not using the related features (sign-in, place search). Only those features become unavailable; everything else keeps working.

## 8. Your rights

You may at any time access, correct or delete your personal information, or ask us to stop processing it.

- **Access and correction:** in the App, go to Settings → your profile (Account Settings) to view and edit your name (nickname) and change your password.
- **Deletion (delete account):** Settings → your profile (Account Settings) → Danger Zone → Delete Account. If you cannot use the App, request deletion by email as described on the [Account & Data Deletion](https://scanview.app/legal/account-deletion?lang=en) page.
- **Opting out of analytics:** turn off Settings → App Info & Support → Usage Analytics.
- **Withdrawing permissions:** you can turn off camera, location, photos, contacts, calendar and notification permissions in your device settings at any time.
- For other requests, email us at the address below. After verifying your identity we will respond without delay (within 10 days at the latest). You may also make requests through a legal representative or an authorized agent.

## 9. Children

The Service is not directed to children under 14 (or under 13 where that is the applicable age), and we do not knowingly collect their personal information. If we learn that such a child has created an account, we will delete the account and its information without delay.

## 10. Security measures

- All communication between the App and our server is encrypted with HTTPS/WSS
- Account and session passwords are stored only as irreversible hashes
- Sign-in information on the device is kept in the operating system's secure storage (Keychain/Keystore)
- Admin functions are restricted to authorized staff and admin actions are logged

## 11. Cookies and similar technologies

The App does not use cookies. The scanview.app website uses browser storage (localStorage) to keep you signed in and remember display settings, and a cookie to remember your language. You can clear them in your browser settings. We do not use advertising or tracking cookies.

## 12. Privacy officer and contact

- Operator: Cubion (큐비온)
- Privacy officer: Representative of Cubion
- Email: [support@scanview.app](mailto:support@scanview.app)

If you need to report or get advice on a privacy violation, you can also contact the Korean authorities below.

- Personal Information Infringement Report Center: 118 (in Korea), privacy.kisa.or.kr
- Personal Information Dispute Mediation Committee: 1833-6972, www.kopico.go.kr

## 13. Changes to this policy

We will announce changes on this page and in the App at least 7 days before they take effect, or at least 30 days before for changes that significantly affect your rights.

- Effective date: October 16, 2026
