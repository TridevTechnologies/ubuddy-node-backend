// app.js
const express = require('express');
const app = express();
require('dotenv').config();

// Middleware to parse JSON bodies
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth'); // Login route
const classRoutes = require('./routes/class'); // Create and get classes
const classSubjectRoutes = require('./routes/classSubject'); // Allocate subjects to classes
const schoolRoutes = require('./routes/school'); // Create school and get all schools
const studentRoutes = require('./routes/student'); // Student-related routes
const subjectRoutes = require('./routes/subject'); // Create subjects for a school

// Mount routes with base paths
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/class-subjects', classSubjectRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/subject', subjectRoutes);

// 404 Handler for unknown routes
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler (optional)
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
