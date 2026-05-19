const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const qrcode = require('qrcode');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PHP_WEBHOOK_URL = 'https://randevum.store/db/Webhook/wp_webhook.php';

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './wp-session' }),
    puppeteer: {
        headless: true, // Render'da mutlaka true olmalı
       // executablePath: '/usr/bin/google-chrome-stable', // apt-get ile kurduğumuz Chrome yolu
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Render için kritik
            '--disable-gpu'
        ]
    }
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Bot Paneli</title>
            <style>body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }</style>
        </head>
        <body>
            <h2>Randevum.store WhatsApp Bağlantı Paneli</h2>
            <div id="status">Durum: Sistem başlatılıyor, lütfen bekleyin...</div>
            <br>
            <img id="qrcode" src="" alt="QR Kod Yükleniyor..." style="display:none; margin: 0 auto; width: 300px;"/>
            
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const qrImg = document.getElementById('qrcode');
                const statusDiv = document.getElementById('status');

                socket.on('qr', (data) => {
                    qrImg.src = data;
                    qrImg.style.display = 'block';
                    statusDiv.innerText = 'Durum: Lütfen QR Kodu WhatsApp uygulamanızdan taratın.';
                });

                socket.on('ready', () => {
                    qrImg.style.display = 'none';
                    statusDiv.innerText = 'Durum: WhatsApp Başarıyla Bağlandı! Sistem 7/24 Aktif.';
                });
            </script>
        </body>
        </html>
    `);
});

client.on('qr', (qr) => {
    qrcode.toDataURL(qr, (err, url) => {
        io.emit('qr', url);
    });
});

client.on('ready', () => {
    console.log('WhatsApp Bağlantısı Hazır!');
    io.emit('ready');
});

client.on('message', async (msg) => {
    if (msg.from.includes('@g.us')) return;

    try {
        const response = await axios.post(PHP_WEBHOOK_URL, {
            phone: msg.from,
            message: msg.body
        });

        if (response.data && response.data.reply) {
            msg.reply(response.data.reply);
        }
    } catch (error) {
        console.error('PHP sunucu hatası:', error.message);
    }
});

client.initialize();

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log('Port aktif: ' + PORT);
});
