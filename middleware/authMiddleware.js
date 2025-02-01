const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.authenticate = (req, res, next) => {
    const token = req.header('Authorization');

    // Check if the token is in the correct format (Bearer <token>)
    if (!token || !token.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided or invalid format' });
    }

    const actualToken = token.split(' ')[1]; // Extract the token part after 'Bearer'
    console.log(actualToken);
    try {
        const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);
        req.user = decoded; 
        next();
    } catch (error) {
        res.status(403).json({ message: 'Invalid Token' });
    }
};
