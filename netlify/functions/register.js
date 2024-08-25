const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Inicializar o banco de dados
const db = new sqlite3.Database(path.resolve('/tmp', 'database.db'));  // Netlify Functions não permitem arquivos no sistema de arquivos permanente

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

// Função handler
exports.handler = async (event) => {
    // Adicionar cabeçalhos CORS
    const headers = {
        'Access-Control-Allow-Origin': 'https://frontend-teste-y1xb.vercel.app',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'OK' })
        };
    }

    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body);
        const { name, birthDate, cpf, church, district, whatsapp, acceptTerms } = body;

        if (!acceptTerms) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ message: 'Você deve aceitar os termos de uso.' })
            };
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

        return new Promise((resolve, reject) => {
            db.run(sql, [id, name, birthDate, age, cpf, church, district, whatsapp], function (err) {
                if (err) {
                    resolve({
                        statusCode: 500,
                        headers,
                        body: JSON.stringify({ message: 'Erro ao cadastrar usuário.' })
                    });
                } else {
                    QRCode.toDataURL(JSON.stringify(newUser), (err, url) => {
                        if (err) {
                            resolve({
                                statusCode: 500,
                                headers,
                                body: JSON.stringify({ message: 'Erro ao gerar o QR Code.' })
                            });
                        } else {
                            resolve({
                                statusCode: 200,
                                headers,
                                body: JSON.stringify({ user: newUser, qrCode: url })
                            });
                        }
                    });
                }
            });
        });
    } else {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ message: 'Método não permitido' })
        };
    }
};
