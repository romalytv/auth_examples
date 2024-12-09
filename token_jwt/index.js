const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const port = 3000;

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// JWT секретний ключ
const SECRET_KEY = 'roma12';
const SESSION_KEY = 'Authorization';

// Клас для роботи з сесіями
class Session {
    #sessions = {}

    constructor() {
        try {
            this.#sessions = fs.readFileSync('./sessions.json', 'utf8');
            this.#sessions = JSON.parse(this.#sessions.trim());
            console.log(this.#sessions);
        } catch (e) {
            this.#sessions = {};
        }
    }

    #storeSessions() {
        fs.writeFileSync('./sessions.json', JSON.stringify(this.#sessions), 'utf-8');
    }

    set(key, value) {
        if (!value) {
            value = {};
        }
        this.#sessions[key] = value;
        this.#storeSessions();
    }

    get(key) {
        return this.#sessions[key];
    }

    destroy(sessionId) {
        delete this.#sessions[sessionId];
        this.#storeSessions();
    }
}

const sessions = new Session();

// Middleware для перевірки JWT і сесій
app.use((req, res, next) => {
    const token = req.get(SESSION_KEY);
    let currentSession = {};

    if (token) {
        try {
            const decoded = jwt.verify(token, SECRET_KEY);
            const sessionId = decoded.sessionId;

            // Отримуємо сесію з серверного сховища
            currentSession = sessions.get(sessionId) || {};
            req.session = currentSession;
            req.sessionId = sessionId;
        } catch (e) {
            return res.status(401).send('Invalid or expired token.');
        }
    } else {
        req.session = {};
    }

    // Зберігаємо сесію після завершення запиту
    res.on('finish', () => {
        if (req.sessionId) {
            sessions.set(req.sessionId, req.session);
        }
    });

    next();
});

const users = [
    {
        login: 'Login',
        password: 'Password',
        username: 'Username',
    },
    {
        login: 'Login1',
        password: 'Password1',
        username: 'Username1',
    }
];

app.get('/', (req, res) => {
    if (req.session.username) {
        return res.json({
            username: req.session.username,
            logout: 'http://localhost:3000/logout'
        });
    }
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/logout', (req, res) => {
    if (req.sessionId) {
        sessions.destroy(req.sessionId);
    }
    res.send('You have been logged out.');
});

app.post('/api/login', (req, res) => {
    const { login, password } = req.body;

    const user = users.find((user) => user.login === login && user.password === password);

    if (user) {
        const sessionId = new Date().getTime().toString(); // Унікальний ідентифікатор
        sessions.set(sessionId, { username: user.username, login: user.login });

        const token = jwt.sign(
            { sessionId },
            SECRET_KEY,
            { expiresIn: '1h' }
        );

        return res.json({ token });
    }

    res.status(401).send('Invalid login or password.');
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
