# Backend setup

Use Node.js 20 or newer.

## 1. Configure MongoDB

Use MongoDB locally or create a MongoDB Atlas cluster. Copy `.env.example` to `.env` and set:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=sakthi_dental_clinic
ADMIN_USERNAME=admin
ADMIN_PASSWORD=use-a-strong-password
SESSION_SECRET=not-used-for-local-memory-sessions

# Optional email provider
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-app-password
SMTP_FROM=appointments@example.com
```

For Atlas, replace `MONGODB_URI` with the connection string from your cluster. Never commit `.env`.

### Configure appointment notifications

Copy the notification settings above into `backend/.env` and replace the example values with credentials from your provider. Email uses SMTP; `SMTP_FROM` must be an address authorized by your SMTP provider. For Gmail, use an app password rather than your account password. Port 465 usually uses `SMTP_SECURE=true`; port 587 usually uses `SMTP_SECURE=false`.

Email is used for appointment requests, status changes, and reminders. Reminders are scheduled 24 hours and 2 hours before confirmed appointments using the clinic's India time (UTC+05:30). Failed appointment and status notifications, and failed reminders, are retried every five minutes up to five total attempts. Delivery attempts and provider errors are recorded on each appointment in `notificationDelivery`; check the backend logs and provider console when troubleshooting. Never commit `.env`.

## 2. Create the admin account

From this `backend` directory:

```powershell
npm install
npm run create-admin
```

Run this again whenever you want to change the admin password.

If you used the previous JSON backend and still have `data/appointments.json`, migrate it once:

```powershell
npm run migrate-json
```

## 3. Start the application

```powershell
npm start
```

Open:

- Website: `http://localhost:3000`
- Admin dashboard: `http://localhost:3000/admin.html`

## Included services

- MongoDB appointment storage
- Username/password admin login with bcrypt hashing
- Session-protected admin API
- Appointment status updates: pending, confirmed, completed, cancelled
- Duplicate appointment time protection
- Public date availability endpoint
- Dashboard appointment search and summary counts
- Analytics endpoint: `GET /api/analytics`
- SMTP email appointment notifications
- 24-hour and 2-hour reminders for confirmed appointments
