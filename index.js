const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configurar o banco de dados
const db = new sqlite3.Database(path.resolve(__dirname, 'database.db'));

// Criar tabela se não existir
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        birthDate TEXT,
        age INTEGER,
        cpf TEXT,
        church TEXT,
        district TEXT,
        whatsapp TEXT
    )`);
});

// Função para calcular a idade
function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDifference = today.getMonth() - birth.getMonth();

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

// Rota para cadastro
app.post('/api/register', (req, res) => {
    const { name, birthDate, cpf, church, district, whatsapp, acceptTerms } = req.body;

    if (!acceptTerms) {
        return res.status(400).json({ message: 'Você deve aceitar os termos de uso.' });
    }

    const id = uuidv4();
    const age = calculateAge(birthDate);

    const newUser = {
        id,
        name,
        birthDate,
        age,
        cpf,
        church,
        district,
        whatsapp
    };

    const sql = `INSERT INTO users (id, name, birthDate, age, cpf, church, district, whatsapp)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [id, name, birthDate, age, cpf, church, district, whatsapp], function (err) {
        if (err) {
            return res.status(500).json({ message: 'Erro ao cadastrar usuário.' });
        }

        QRCode.toDataURL(JSON.stringify(newUser), (err, url) => {
            if (err) {
                return res.status(500).json({ message: 'Erro ao gerar o QR Code.' });
            }
            res.json({ user: newUser, qrCode: url });
        });
    });
});

// Rota para consulta
app.get('/api/users', (req, res) => {
    const { name, id, cpf } = req.query;
    let sql = `SELECT * FROM users WHERE 1=1`;
    const params = [];

    if (name) {
        sql += ` AND name LIKE ?`;
        params.push(`%${name}%`);
    }
    if (id) {
        sql += ` AND id = ?`;
        params.push(id);
    }
    if (cpf) {
        sql += ` AND cpf = ?`;
        params.push(cpf);
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao consultar usuários.' });
        }
        res.json(rows);
    });
});

// Configurar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API rodando na porta ${PORT}`);
});
