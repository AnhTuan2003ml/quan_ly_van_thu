const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const apiUsers = require('./api/user').default;
const apiVbDen = require('./api/vb_den').default;
const apiAuth = require('./api/auth').default;

const app = express();
const db = new sqlite3.Database('./data/db.db');

// Middleware

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/doc', express.static(path.join(__dirname, 'doc'))); 
// API Routes
app.use('/api/users', apiUsers(db));
app.use('/api/vb_den', apiVbDen(db));
app.use('/auth', apiAuth(db));

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});