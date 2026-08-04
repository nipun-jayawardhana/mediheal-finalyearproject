# MediHeal Backend

MediHeal is a React Native healthcare navigation system tailored for elderly users in Sri Lanka.
This repository contains the Node.js Express & MongoDB REST API backend service.

## Folder Structure

```
mediheal-backend/
├── src/
│   ├── config/          # Environment variable validation & Database setup
│   ├── controllers/     # Controller functions handling HTTP requests
│   ├── middleware/      # Centralized error & 404 middleware
│   ├── models/          # Mongoose schemas & data models (to be added)
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic services (to be added)
│   ├── utils/           # Helper functions & utilities (to be added)
│   ├── app.js           # Express app setup and middleware configuration
│   └── server.js        # Server entry point
├── .env                 # Local environment variables
├── .env.example         # Example environment file template
├── .gitignore           # Git ignored files & folders
├── package.json         # Dependencies and scripts
└── README.md            # Backend documentation
```

## Getting Started

### Prerequisites

- Node.js (v16+ recommended)
- MongoDB (Local instance or MongoDB Atlas cluster)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure Environment Variables:
   Copy `.env.example` to `.env` if not already created, and set your local or MongoDB Atlas connection string:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://127.0.0.1:27017/mediheal
   ```

### Running the Backend Server

- **Development mode (with auto-reload using nodemon):**
  ```bash
  npm run dev
  ```

- **Production mode:**
  ```bash
  npm start
  ```

### Health Check API

Verify that the server is working properly:
- Endpoint: `GET http://localhost:5000/api/health`
