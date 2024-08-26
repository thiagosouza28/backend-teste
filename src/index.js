const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = new sqlite3.Database(path.resolve(__dirname, 'database.db'));

// Criar tabela se não existir
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS participants (
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

// Rota para cadastro
app.post('/api/participants', (req, res) => {
    const { name, birthDate, cpf, church, district, whatsapp, acceptTerms } = req.body;

    if (!acceptTerms) {
        return res.status(400).json({ message: 'Você deve aceitar os termos de uso.' });
    }

    const id = uuidv4();
    const age = calculateAge(birthDate);

    const newParticipant = {
        id,
        name,
        birthDate,
        age,
        cpf,
        church,
        district,
        whatsapp
    };

    const sql = `INSERT INTO participants (id, name, birthDate, age, cpf, church, district, whatsapp)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [id, name, birthDate, age, cpf, church, district, whatsapp], function (err) {
        if (err) {
            return res.status(500).json({ message: 'Erro ao cadastrar participante.' });
        }

        QRCode.toDataURL(JSON.stringify(newParticipant), (err, url) => {
            if (err) {
                return res.status(500).json({ message: 'Erro ao gerar o QR Code.' });
            }
            res.json({ participant: newParticipant, qrCode: url });
        });
    });
});

// Rota para consulta de participante por ID
app.get('/api/participants/:id', (req, res) => {
    const participantId = req.params.id;

    const sql = `SELECT * FROM participants WHERE id = ?`;
    db.get(sql, [participantId], (err, row) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao buscar participante.' });
        }
        if (!row) {
            return res.status(404).json({ message: 'Participante não encontrado.' });
        }
        res.json(row);
    });
});

// Rota para gerar QR Code com base no ID
app.get('/api/participants/:id/qrcode', (req, res) => {
    const participantId = req.params.id;

    const sql = `SELECT * FROM participants WHERE id = ?`;
    db.get(sql, [participantId], (err, row) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao buscar participante.' });
        }
        if (!row) {
            return res.status(404).json({ message: 'Participante não encontrado.' });
        }
        QRCode.toDataURL(JSON.stringify(row), (err, url) => {
            if (err) {
                return res.status(500).json({ message: 'Erro ao gerar o QR Code.' });
            }
            res.json({ qrCode: url });
        });
    });
});

// Rota para consulta geral de participantes
app.get('/api/participants', (req, res) => {
    const { name, id, cpf } = req.query;
    let sql = `SELECT * FROM participants WHERE 1=1`;
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
            return res.status(500).json({ message: 'Erro ao consultar participantes.' });
        }
        res.json(rows);
    });
});

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

// Use a variável PORT fornecida pelo Render ou 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API rodando na porta ${PORT}`);
});
