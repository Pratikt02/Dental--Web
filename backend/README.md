# Backend setup

## 1. Configure MongoDB

Use MongoDB locally or create a MongoDB Atlas cluster. Copy `.env.example` to `.env` and set:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=sakthi_dental_clinic
ADMIN_USERNAME=admin
ADMIN_PASSWORD=use-a-strong-password
SESSION_SECRET=not-used-for-local-memory-sessions
```

For Atlas, replace `MONGODB_URI` with the connection string from your cluster. Never commit `.env`.

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

Email, WhatsApp, payment, and Google Business integrations require provider credentials and can be connected through environment variables later.
