🦷 Dental Web
Dental Web is a dental clinic website designed to help visitors learn
about the clinic, explore dental treatments, find useful information,
and get in touch. The project includes a public-facing website and a
backend service for supporting application functionality.
🌐 Live Demo: https://dental-web-m1i6.onrender.com\
💻 Source Code: https://github.com/Pratikt02/Dental--Web
✨ Features
🧑‍⚕️ Visitor Features
- Clinic homepage and introduction
- About page with clinic information
- Dental treatments and services page
- Contact page for inquiries
- Frequently asked questions (FAQ)
- Privacy information page
- Login page
- Responsive website layout
👤 Patient Features
- Patient-facing page/interface
- Access to patient-related website functionality
- Login-based access where configured
👨‍💼 Admin Features
- Admin-facing interface
- Login-based access where configured
- Administrative page for managing clinic application information
The exact availability of appointment booking, patient records, and
administrative operations depends on the current implementation.
Update this section to match the live application and source code.

🔄 Website Flow
Visitor opens the website
          ↓
Explores clinic information
          ↓
Views dental treatments
          ↓
Checks FAQs or contact information
          ↓
Uses the relevant patient or login interface
🛠️ Tech Stack
Frontend
- HTML5
- CSS3
- JavaScript
Backend
- Node.js
- Express.js
Database
- MongoDB
Deployment
- Render
Development Tools
- Git
- GitHub
- npm
🏗️ Project Structure
Dental--Web/
│
├── docs/                  # Frontend website files
│   ├── index.html         # Homepage
│   ├── about.html         # About the clinic
│   ├── treatments.html    # Dental treatments/services
│   ├── contact.html       # Contact page
│   ├── faq.html           # Frequently asked questions
│   ├── login.html         # Login page
│   ├── admin.html         # Admin interface
│   ├── patient.html       # Patient interface
│   └── privacy.html       # Privacy information
│
└── backend/
    ├── server.js          # Express server and API
    ├── db.js              # Database connection
    └── package.json       # Backend dependencies and scripts
This structure is based on the currently available project details.
Adjust filenames and folders if the repository has changed.
🚀 Local Development
Prerequisites
Make sure you have installed:
- Node.js (LTS recommended)
- npm
- MongoDB or MongoDB Atlas
- Git
1. Clone the Repository
git clone https://github.com/Pratikt02/Dental--Web.git
Navigate into the project:
cd Dental--Web
2. Install Backend Dependencies
cd backend
npm install
3. Configure Environment Variables
Review backend/server.js, backend/db.js, and backend/package.json
to identify the environment variables required by your implementation.
If the project uses a .env file, create one in the backend directory
and add the required values. For example:
NODE_ENV=development
PORT=5000
MONGODB_URI=your_mongodb_connection_string
Use the exact variable names expected by your code. These are
illustrative examples, not a guarantee that the project uses these
specific names.
⚠️ Never commit .env files, database credentials, or other secrets
to GitHub.
4. Start the Backend
Check the scripts section of backend/package.json for the configured
development command. If the backend is configured to run directly with
Node.js, you may use:
node server.js
If a development script exists, use the corresponding command, for
example:
npm run dev
5. Open the Frontend
The frontend files are located in docs/. Open docs/index.html in a
browser or serve the docs/ directory with a local static web server.
If the frontend calls the backend API, ensure its API base URL points to
your local backend rather than the production deployment.
🌐 Deployment
The project is deployed on Render.
Live Application
👉 https://dental-web-m1i6.onrender.com
GitHub Repository
👉 https://github.com/Pratikt02/Dental--Web
When deploying the backend, configure the required environment variables
in the Render dashboard and ensure the database is reachable from the
hosted service. If the frontend and backend are deployed separately,
configure the frontend API URL and backend CORS settings accordingly.
🔐 Security Considerations
- Keep database credentials and private configuration in environment
  variables.
- Validate user input on the server.
- Protect administrative endpoints with server-side authentication and
  authorization.
- Configure CORS to allow only the intended frontend origins.
- Use HTTPS in production.
- Avoid exposing private patient or clinic information.
- Do not commit secrets or production credentials to GitHub.
🧪 Testing Checklist
Before publishing a release, verify the parts implemented in your
project:
- [ ] Homepage and navigation load correctly
- [ ] About, treatments, contact, FAQ, and privacy pages work
- [ ] Website layout works on mobile and desktop
- [ ] Login flow works, if authentication is enabled
- [ ] Patient interface works, if applicable
- [ ] Admin access is protected, if applicable
- [ ] Backend API connects to the database
- [ ] Frontend API requests use the correct URL
- [ ] Production deployment is reachable
🚀 Future Improvements
Potential enhancements, depending on the current scope of the project:
- Online appointment booking and appointment status tracking
- Dentist profiles and clinic opening hours
- Patient appointment history
- Appointment notifications and reminders
- Stronger form validation and accessible UI components
- Automated tests for backend endpoints
- Documented API endpoints and sample environment configuration
👨‍💻 Author
Pratik Thange
GitHub: https://github.com/Pratikt02
