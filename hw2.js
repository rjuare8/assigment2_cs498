const express = require('express');
const mariadb = require('mariadb');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const port = 80;

// Create a MariaDB connection pool for the local database
const pool = mariadb.createPool({
    host: '127.0.0.1', // local instance
    port: 3306,
    user: 'rudy', // local MariaDB username
    password: 'secret', // local MariaDB password
    database: 'Users', // database name
    connectionLimit: 5
});

// Create a MariaDB connection pool for the remote database
const poolRemote = mariadb.createPool({
    host: '35.202.52.57', // remote instance internal IP in GCP
    port: 3306,
    user: 'rodolfo', // remote MariaDB username
    password: 'secret', // remote MariaDB password
    database: 'Users', // same database name
    connectionLimit: 5
});

// Set EJS as the view engine and set the views directory
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Use body-parser middleware to parse JSON
app.use(bodyParser.json());

// Route: /greeting should display "Hello World!"
app.get('/greeting', (req, res) => {
    console.log("Hello, World!");
    res.render('greeting'); // Make sure views/greeting.ejs exists
});

// Route: Register a new user (writes to both local and remote databases)
app.post('/register', async (req, res) => {
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    let connLocal, connRemote;
    try {
        // Get connections from both local and remote pools
        connLocal = await pool.getConnection();
        connRemote = await poolRemote.getConnection();

        // Write to the local database
        await connLocal.query('INSERT INTO Users (username) VALUES (?)', [username]);

        // Write to the remote database
        await connRemote.query('INSERT INTO Users (username) VALUES (?)', [username]);

        res.status(201).json({ message: 'User added successfully' });
    } catch (err) {
        res.status(500).json({ error: `Error adding user: ${err.message}` });
    } finally {
        if (connLocal) connLocal.release();
        if (connRemote) connRemote.release();
    }
});

// Route: GET /list should return a JSON-formatted list of usernames (read from the local database)
app.get('/list', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT username FROM Users');
        const usernames = rows.map(row => row.username);
        res.json({ users: usernames });
    } catch (err) {
        res.status(500).json({ error: `Error retrieving users: ${err.message}` });
    } finally {
        if (conn) conn.release();
    }
});

// Route: Clear all users (delete from both local and remote databases)
app.post('/clear', async (req, res) => {
    let connLocal, connRemote;
    try {
        connLocal = await pool.getConnection();
        connRemote = await poolRemote.getConnection();

        await connLocal.query('DELETE FROM Users');
        await connRemote.query('DELETE FROM Users');

        res.status(201).json({ message: 'Users deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: `Error clearing users: ${err.message}` });
    } finally {
        if (connLocal) connLocal.release();
        if (connRemote) connRemote.release();
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://<external ip>:${port}`);
});
