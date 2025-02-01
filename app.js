const express = require('express');
const cors = require('cors');
require('dotenv').config();
const schoolRoutes = require('./routes/school');
const authRoutes = require('./routes/auth');
const classRoutes = require('./routes/class');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/school', schoolRoutes); // School routes
app.use('/api/auth', authRoutes); // Authentication routes

// Root route
app.get('/', (req, res) => {
    res.send('School Management API is running');
});



app.use('/api/class', classRoutes);


module.exports = app;
const studentRoutes = require("./routes/student");

app.use("/api/students", studentRoutes);
