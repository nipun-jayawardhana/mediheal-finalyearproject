# MediHeal Backend API Service

MediHeal is a healthcare navigation platform tailored for elderly users and caregivers in Sri Lanka.
This repository contains the production-ready Node.js, Express, and MongoDB REST API backend.

---

## 🚀 Technology Stack

- **Runtime:** Node.js (CommonJS)
- **Framework:** Express.js (v4.22)
- **Database:** MongoDB & Mongoose ODM (v8.24)
- **Authentication:** JWT (jsonwebtoken v9.0) & Bcrypt password hashing (bcryptjs v3.0)
- **Environment:** dotenv (v16.6)
- **CORS:** Enabled via cors middleware

---

## 🛠️ Setup Instructions & Prerequisites

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB instance running locally (`mongodb://127.0.0.1:27017/mediheal`) or MongoDB Atlas URI

### Installation
1. Clone repository and navigate to backend directory:
   ```bash
   cd mediheal-backend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Configure Environment Variables in `.env`:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://127.0.0.1:27017/mediheal
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRES_IN=30d
   ADMIN_NAME=System Administrator
   ADMIN_EMAIL=admin@mediheal.com
   ADMIN_PASSWORD=AdminPass123!
   ```

4. Seed Initial Admin Account:
   ```bash
   npm run seed:admin
   ```

5. Run Development Server:
   ```bash
   npm run dev
   ```

---

## 🔑 Environment Variables Summary

| Variable Name | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | HTTP server port | `5000` |
| `NODE_ENV` | Environment mode | `development` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/mediheal` |
| `JWT_SECRET` | JWT token signing key | `[SECRET_STRING]` |
| `JWT_EXPIRES_IN` | Token expiration duration | `30d` |
| `ADMIN_NAME` | Initial seeded Admin full name | `System Administrator` |
| `ADMIN_EMAIL` | Initial seeded Admin email | `admin@mediheal.com` |
| `ADMIN_PASSWORD` | Initial seeded Admin password | `[SECRET_PASSWORD]` |

---

## 👥 Role Summary & Access Control

- **Patient:** Profile creation, doctor search, appointment booking & cancellation, consultation history, medication schedule & dose marking, symptom analysis, emergency SOS triggers, community posting & commenting.
- **Caregiver:** Patient linking (via unique code), linked patient overview & medication management, medication log monitoring & adherence summaries, emergency alert resolution, community posting & commenting.
- **Doctor:** Doctor profile (SLMC number, specialization), managing assigned appointments (confirm/cancel), conducting consultations & issuing prescriptions, patient history lookup.
- **Admin:** Creating doctor accounts, listing all doctors, updating doctor profiles and availability/active status.

---

## 📋 Complete Route Inventory

### 1. Health Check
- `GET /api/health` - Public system health status

### 2. Authentication (`/api/auth`)
- `POST /api/auth/register` - Public user registration (`patient` or `caregiver` only)
- `POST /api/auth/login` - User authentication & JWT token generation
- `GET /api/auth/me` - Authenticated user profile

### 3. Patient Profile (`/api/patients`)
- `POST /api/patients/profile` - Create patient profile (generates unique `caregiverLinkCode`)
- `GET /api/patients/profile` - Retrieve patient profile
- `PUT /api/patients/profile` - Update patient profile
- `GET /api/patients/dashboard` - Patient dashboard summary (active medications, upcoming appointments, symptom check, active emergency alert)

### 4. Admin Doctor Management (`/api/admin`)
- `POST /api/admin/doctors` - Create new doctor user and DoctorProfile
- `GET /api/admin/doctors` - List all doctors (Admin view)
- `GET /api/admin/doctors/:doctorId` - Get single doctor details (Admin view)
- `PUT /api/admin/doctors/:doctorId` - Update doctor profile (Admin view)
- `PATCH /api/admin/doctors/:doctorId/status` - Toggle doctor active/inactive status

### 5. Doctor Directory (`/api/doctors`)
- `GET /api/doctors` - Search and filter active doctors (by specialization, hospital, language, availability)
- `GET /api/doctors/:doctorId` - Get doctor profile details

### 6. Appointments (`/api/appointments` & `/api/doctor/appointments`)
- `POST /api/appointments` - Book appointment with doctor (Patient)
- `GET /api/appointments/my` - List patient's appointments (Patient)
- `GET /api/appointments/:appointmentId` - View single appointment details
- `PATCH /api/appointments/:appointmentId/cancel` - Cancel appointment (Patient)
- `GET /api/doctor/appointments` - List doctor's assigned appointments (Doctor)
- `PATCH /api/doctor/appointments/:appointmentId/status` - Update appointment status (`confirmed`, `cancelled`, `completed`) (Doctor)

### 7. Consultations (`/api/consultations` & `/api/doctor`)
- `POST /api/consultations` - Create consultation record & issue prescription (Doctor)
- `GET /api/consultations/my` - View consultation history (Patient)
- `GET /api/consultations/:consultationId` - View single consultation details
- `GET /api/doctor/patients/:patientId/history` - View patient consultation history (Doctor)

### 8. Caregivers (`/api/caregivers`)
- `POST /api/caregivers/link` - Link caregiver to patient using `caregiverLinkCode`
- `GET /api/caregivers/patients` - List linked patients (Caregiver)
- `GET /api/caregivers/patients/:patientId` - Detailed patient overview & adherence summary (Caregiver)
- `DELETE /api/caregivers/patients/:patientId/link` - Remove caregiver link (Soft delete)
- `GET /api/caregivers/emergency-alerts` - View emergency alerts for linked patients (Caregiver)

### 9. Medications (`/api/medications`)
- `POST /api/medications` - Add medication for linked patient (Caregiver)
- `GET /api/medications/my` - View active medications (Patient)
- `GET /api/medications/my/logs` - View medication adherence logs (Patient)
- `GET /api/medications/patient/:patientId` - View linked patient medications (Caregiver)
- `GET /api/medications/patient/:patientId/logs` - View linked patient medication logs (Caregiver)
- `PUT /api/medications/:medicationId` - Update medication details (Caregiver)
- `DELETE /api/medications/:medicationId` - Deactivate medication (Caregiver)
- `POST /api/medications/:medicationId/taken` - Mark medication dose as taken (Patient)

### 10. Symptom Analysis (`/api/symptoms`)
- `POST /api/symptoms/analyze` - Rule-based symptom analysis & specialist recommendation (Patient)
- `GET /api/symptoms/history` - View symptom analysis history (Patient)
- `GET /api/symptoms/:symptomCheckId` - View single symptom check result (Patient)

### 11. Emergency SOS (`/api/emergency`)
- `POST /api/emergency` - Trigger emergency SOS alert with optional GPS coordinates (Patient)
- `GET /api/emergency/my` - View emergency alert history (Patient)
- `GET /api/emergency/:alertId` - View single emergency alert details (Patient / Linked Caregiver)
- `PATCH /api/emergency/:alertId/cancel` - Cancel active emergency alert (Patient)
- `PATCH /api/emergency/:alertId/resolve` - Resolve active emergency alert (Caregiver)

### 12. Community Health (`/api/community`)
- `POST /api/community/posts` - Create community post (Patient & Caregiver)
- `GET /api/community/posts` - View community feed with category filter & pagination (Patient & Caregiver)
- `GET /api/community/posts/:postId` - View post and active comments (Patient & Caregiver)
- `PUT /api/community/posts/:postId` - Update own post (Patient & Caregiver)
- `DELETE /api/community/posts/:postId` - Soft-delete own post (Patient & Caregiver)
- `POST /api/community/posts/:postId/comments` - Add comment to active post (Patient & Caregiver)
- `DELETE /api/community/comments/:commentId` - Soft-delete own comment (Patient & Caregiver)

---

## 🌐 API Base URL
- **Local Base URL:** `http://localhost:5000`
- **Health Check Endpoint:** `http://localhost:5000/api/health`
