const express = require('express');
const app = express();
app.use(express.json({ limit: '256kb' }));

// Tin tưởng proxy của Render để lấy đúng IP của người dùng thực tế
app.set('trust proxy', true);

// ====== CẤU HÌNH ======
const MAX_LOGS  = 100;   // /logs viewer
const MAX_CHAT  = 200;  // /chat-logs viewer

const usersDB = {
    "trap":   { password: "1234",   expire_at: "2026-08-30T23:59:59+07:00" },
    "thinh":  { password: "thinhh", expire_at: "2026-08-30T21:39:00+07:00" },
    "peak":   { password: "1002",   expire_at: "2026-08-30T21:39:00+07:00" },
    "lumi":   { password: "1003",   expire_at: "2026-08-30T23:59:59+07:00" },
    "noname": { password: "10314",  expire_at: "2026-08-30T23:59:59+07:00" },
    "belanh":    { password: "2222",   expire_at: "2026-08-30T23:59:59+07:00" },
    "dyo":    { password: "1005",   expire_at: "2026-08-30T23:59:59+07:00" },
    "linh":    { password: "1005",   expire_at: "2026-08-30T23:59:59+07:00" }
};

const logHistory  = [];
const chatHistory = [];

function writeLog(message) {
    const ts = new Date().toLocaleString('vi-VN');
    const entry = `[${ts}] ${message}`;
    logHistory.unshift(entry);
    if (logHistory.length > MAX_LOGS) logHistory.length = MAX_LOGS;
    console.log(entry);
}

const NOISE_PATTERNS = [
    /^§[0-9a-fk-or]/i,
    /^\[color\]/i,
    /\[server\]/i,
    /\[system\]/i
];

function isNoise(text) {
    if (typeof text !== 'string') return false;
    return NOISE_PATTERNS.some(re => re.test(text));
}

// ====== AUTH & LOGIN LOGS ======
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'UNKNOWN_IP';
    
    const user = usersDB[username];
    if (!user || user.password !== password) {
        writeLog(`[LOGIN-FAIL] User: "${username}" đăng nhập thất bại từ IP: ${clientIp}`);
        return res.status(401).json({ valid: false });
    }
    if (new Date(user.expire_at) < new Date()) {
        writeLog(`[LOGIN-EXPIRED] User: "${username}" đã hết hạn cố gắng đăng nhập từ IP: ${clientIp}`);
        return res.status(403).json({ valid: false });
    }

    writeLog(`[LOGIN-SUCCESS] User: "${username}" đăng nhập thành công từ IP: ${clientIp}`);
    return res.status(200).json({ valid: true });
});

app.post('/api/auth/check-status', (req, res) => {
    const { username } = req.body || {};
    const user = usersDB[username];
    if (!user || new Date(user.expire_at) < new Date()) {
        return res.status(403).json({ valid: false });
    }
    return res.status(200).json({ valid: true });
});

// ====== POST log: CHỈ nhận LỆNH (bắt đầu bằng '/') ======
app.post('/api/chat/log', (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ success: false, message: "Body phải là JSON object!" });
    }

    const username = (req.body.username || '').toString().trim();
    const message  = (req.body.message  || '').toString().trim();

    if (!username || !message) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin!" });
    }

    const cmdText = message.replace(/[\u200B-\u200D\uFEFF]/g, '');
    if (!cmdText.startsWith('/')) {
        return res.status(200).json({ success: true, skipped: 1, accepted: 0 });
    }

    if (isNoise(cmdText)) {
        return res.status(200).json({ success: true, skipped: 1, accepted: 0 });
    }

    const ts = new Date().toLocaleString('vi-VN');
    const entry = `[${ts}] ${username}: ${cmdText}`;
    chatHistory.unshift(entry);
    if (chatHistory.length > MAX_CHAT) chatHistory.length = MAX_CHAT;
    console.log(entry);
    return res.status(200).json({ success: true, accepted: 1, skipped: 0 });
});

// ====== Viewer /logs (Xem log đăng nhập và hệ thống) ======
app.get('/logs', (req, res) => {
    const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="3">
<title>/logs — System & Login</title>
<style>
  body{font-family:Consolas,monospace;background:#0e0e10;color:#d4d4d4;padding:16px;margin:0}
  h1{color:#5fafff;font-size:16px;margin:0 0 8px}
  .url{color:#7a7a7a;font-size:12px;margin-bottom:12px}
  pre{margin:0;font-size:13px;white-space:pre-wrap}
</style></head>
<body>
<h1>Lịch sử Đăng nhập & Hệ thống (Real-time)</h1>
<pre>${logHistory.length === 0 ? 'Chưa có log hệ thống hoặc đăng nhập nào.' : logHistory.map(e => e.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('\n')}</pre>
</body></html>`;
    res.set('Content-Type', 'text/html').send(html);
});

// ====== Viewer /chat-logs ======
app.get('/chat-logs', (req, res) => {
    const url = "https://sever-8wln.onrender.com/chat-logs";
    const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="3">
<title>/chat-logs — Live</title>
<style>
  body{font-family:Consolas,monospace;background:#0e0e10;color:#d4d4d4;padding:16px;margin:0}
  h1{color:#5fafff;font-size:16px;margin:0 0 8px}
  .url{color:#7a7a7a;font-size:12px;margin-bottom:12px}
  pre{margin:0;font-size:13px;white-space:pre-wrap}
</style></head>
<body>
<h1>Lịch sử Chat & Lệnh In-game (Real-time)</h1>
<div class="url">${url}</div>
<pre>${chatHistory.length === 0 ? 'Chưa có hoạt động lệnh nào được ghi nhận.' : chatHistory.map(e => e.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('\n')}</pre>
</body></html>`;
    res.set('Content-Type', 'text/html').send(html);
});

app.get('/', (req, res) => {
    res.json({ status: "Auth Server running", endpoints: ["/logs", "/chat-logs"] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server đang chạy trên cổng ${PORT}`));

// Keep-alive
setInterval(() => {
    require('https').get("https://sever-8wln.onrender.com", r => {}).on('error', ()=>{});
}, 10*60*1000);
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'UNKNOWN';
    
    const user = usersDB[username];
    if (!user || user.password !== password) {
        return res.status(401).json({ valid: false, message: "Sai tài khoản hoặc mật khẩu" });
    }

    if (new Date(user.expire_at) < new Date()) {
        return res.status(403).json({ valid: false, message: "Tài khoản đã hết hạn" });
    }

    // Kiểm tra khóa IP duy nhất
    if (user.allowedIp && user.allowedIp !== clientIp) {
        writeLog(`[IP-BLOCK] User "${username}" bị từ chối do khác IP (Đăng ký: ${user.allowedIp}, Thực tế: ${clientIp})`);
        return res.status(403).json({ valid: false, message: "Tài khoản bị khóa với địa chỉ IP này!" });
    }

    // Nếu tài khoản chưa gán IP nào, tự động gán IP lần đầu tiên đăng nhập
    if (!user.allowedIp) {
        user.allowedIp = clientIp;
        writeLog(`[IP-BIND] User "${username}" đã được gán cố định với IP: ${clientIp}`);
    }

    writeLog(`[LOGIN-SUCCESS] User: "${username}" thành công từ IP: ${clientIp}`);
    return res.status(200).json({ valid: true });
});
