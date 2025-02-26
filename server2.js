const express = require('express');
const mariadb = require('mariadb');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const port = 80;

// On the second VM, the local connection uses user 'rodolfo'
const pool = mariadb.createPool({
    host: '127.0.0.1', // Local database on this VM
    port: 3306,
    user: 'rodolfo', // Local MariaDB username on this machine
    password: 'secret', // Local MariaDB password
    database: 'Users', // Database name remains the same
    connectionLimit: 5
});

// The remote pool connects to the first VM 
// and uses its credentials (user 'rudy')
const poolRemote = mariadb.createPool({
    host: '35.192.31.171', // Internal IP address of the first VM
    port: 3306,
    user: 'rudy', // Remote MariaDB username from the first VM
    password: 'secret', // Remote MariaDB password
    database: 'Users',
    connectionLimit: 5
});

// Set up view engine and middleware as before
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());

// Example route: /greeting to display "Hello World!"
app.get('/greeting', (req, res) => {
    console.log("Hello, World!");
    res.render('greeting'); // Make sure this file exists in your views folder
});

// Route: Register a new user (write to both local and remote databases)
app.post('/register', async (req, res) => {
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    let connLocal, connRemote;
    try {
        connLocal = await pool.getConnection();
        connRemote = await poolRemote.getConnection();

        // Write to local (this VM's) database
        await connLocal.query('INSERT INTO Users (username) VALUES (?)', [username]);
        // Write to remote (first VM's) database
        await connRemote.query('INSERT INTO Users (username) VALUES (?)', [username]);

        res.status(201).json({ message: 'User added successfully' });
    } catch (err) {
        res.status(500).json({ error: `Error adding user: ${err.message}` });
    } finally {
        if (connLocal) connLocal.release();
        if (connRemote) connRemote.release();
    }
});

// Route: List users from the local database
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
