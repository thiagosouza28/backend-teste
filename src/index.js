const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const QRCode = require('qrcode');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = new sqlite3.Database(path.resolve(__dirname, 'database.db'));

// Criação da tabela, se não existir
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        birthDate TEXT NOT NULL,
        age INTEGER,
        cpf TEXT NOT NULL,
        church TEXT NOT NULL,
        district TEXT NOT NULL,
        whatsapp TEXT NOT NULL
    )`, (err) => {
        if (err) {
            console.error('Erro ao criar a tabela:', err);
        } else {
            console.log('Tabela criada ou já existente.');
        }
    });
});

// Função para gerar um ID sequencial baseado no ano
function generateId(callback) {
    const year = new Date().getFullYear();
    const sql = `SELECT COUNT(*) AS count FROM participants WHERE id LIKE ?`;
    db.get(sql, [`${year}%`], (err, row) => {
        if (err) {
            console.error('Erro ao gerar ID:', err);
            return callback(err);
        }
        const count = row.count + 1;
        const id = `${year}-${count.toString().padStart(4, '0')}`;
        callback(null, id);
    });
}

// Rota para cadastro
app.post('/api/participants', (req, res) => {
    const { name, birthDate, cpf, church, district, whatsapp, acceptTerms } = req.body;

    if (!acceptTerms) {
        return res.status(400).json({ message: 'Você deve aceitar os termos de uso.' });
    }

    if (!name || !birthDate || !cpf || !church || !district || !whatsapp) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    generateId((err, id) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao gerar o ID.' });
        }

        const age = calculateAge(birthDate);

        const sql = `INSERT INTO participants (id, name, birthDate, age, cpf, church, district, whatsapp)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        db.run(sql, [id, name, birthDate, age, cpf, church, district, whatsapp], function (err) {
            if (err) {
                console.error('Erro ao cadastrar participante:', err);
                return res.status(500).json({ message: 'Erro ao cadastrar participante.' });
            }

            QRCode.toDataURL(JSON.stringify({ id, name, birthDate, age, cpf, church, district, whatsapp }), (err, url) => {
                if (err) {
                    console.error('Erro ao gerar o QR Code:', err);
                    return res.status(500).json({ message: 'Erro ao gerar o QR Code.' });
                }
                res.json({ participant: { id, name, birthDate, age, cpf, church, district, whatsapp }, qrCode: url });
            });
        });
    });
});

// Rota para consulta de participante por ID
app.get('/api/participants/:id', (req, res) => {
    const participantId = req.params.id;

    const sql = `SELECT * FROM participants WHERE id = ?`;
    db.get(sql, [participantId], (err, row) => {
        if (err) {
            console.error('Erro ao buscar participante:', err);
            return res.status(500).json({ message: 'Erro ao buscar participante.' });
        }
        if (!row) {
            return res.status(404).json({ message: 'Participante não encontrado.' });
        }
        res.json({ participant: row });  // Ajuste aqui para que a resposta tenha a chave `participant`
    });
});


// Rota para gerar QR Code com base no ID
app.get('/api/participants/:id/qrcode', (req, res) => {
    const participantId = req.params.id;

    const sql = `SELECT * FROM participants WHERE id = ?`;
    db.get(sql, [participantId], (err, row) => {
        if (err) {
            console.error('Erro ao buscar participante:', err);
            return res.status(500).json({ message: 'Erro ao buscar participante.' });
        }
        if (!row) {
            return res.status(404).json({ message: 'Participante não encontrado.' });
        }
        const url = `https://frontend-teste-six.vercel.app/src/public/confirmation.html?id=${participantId}`;
        QRCode.toDataURL(url, (err, qrcodeUrl) => {
            if (err) {
                console.error('Erro ao gerar o QR Code:', err);
                return res.status(500).json({ message: 'Erro ao gerar o QR Code.' });
            }
            res.json({ qrCode: qrcodeUrl });
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
            console.error('Erro ao consultar participantes:', err);
            return res.status(500).json({ message: 'Erro ao consultar participantes.' });
        }
        res.json(rows);
    });
});

// Rota para edição de participante
app.put('/api/participants/:id', (req, res) => {
    const participantId = req.params.id;
    const { name, birthDate, cpf, church, district, whatsapp } = req.body;

    const age = calculateAge(birthDate);

    const sql = `UPDATE participants SET name = ?, birthDate = ?, age = ?, cpf = ?, church = ?, district = ?, whatsapp = ? WHERE id = ?`;

    db.run(sql, [name, birthDate, age, cpf, church, district, whatsapp, participantId], function (err) {
        if (err) {
            console.error('Erro ao editar participante:', err);
            return res.status(500).json({ message: 'Erro ao editar participante.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Participante não encontrado.' });
        }
        res.json({ message: 'Participante atualizado com sucesso.' });
    });
});

// Rota para exclusão de participante
app.delete('/api/participants/:id', (req, res) => {
    const participantId = req.params.id;

    const sql = `DELETE FROM participants WHERE id = ?`;

    db.run(sql, [participantId], function (err) {
        if (err) {
            console.error('Erro ao excluir participante:', err);
            return res.status(500).json({ message: 'Erro ao excluir participante.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Participante não encontrado.' });
        }
        res.json({ message: 'Participante excluído com sucesso.' });
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
