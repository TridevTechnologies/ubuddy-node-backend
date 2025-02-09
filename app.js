const express = require('express');
const cors = require('cors'); // Import the CORS middleware
const app = express();
require('dotenv').config();

// Enable CORS for all origins
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth'); // Login route
const classRoutes = require('./routes/class'); // Create and get classes
const classSubjectRoutes = require('./routes/classSubject'); // Allocate subjects to classes
const schoolRoutes = require('./routes/school'); // Create school and get all schools
const studentRoutes = require('./routes/student'); // Student-related routes
const subjectRoutes = require('./routes/subjects'); // Create subjects for a school
const sessionRoutes = require('./routes/sessions');


// Mount routes with base paths
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/class-subjects', classSubjectRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/subject', subjectRoutes);
app.use('/api/sessions', sessionRoutes);
// 404 Handler for unknown routes
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler (optional)
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(500).json({ message: 'Internal Server Error' });
});

module.exports = app; // Export app without starting the server
