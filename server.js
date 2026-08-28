const express = require('express');
const app = express();

app.use(express.json());

// ====== HẰNG SỐ & CẤU HÌNH ======
const MAX_LOGS = 100;   // /logs viewer
const MAX_CHAT = 200;   // /chat-logs viewer, lưu MỌI chat kể cả incoming
const PORT     = process.env.PORT || 3000;

// ====== TIỆN ÍCH HTML ======
function escapeHtml(s) {
    if (typeof s !== 'string') return '';
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
function safePre(arr, emptyText) {
    if (!Array.isArray(arr) || arr.length === 0) return emptyText;
    return arr.map(escapeHtml).join('\n');
}

// ====== MẢNG LỊCH SỬ ======
const logHistory  = [];   // log server-side (login/check-status/keep-alive)
const chatHistory = [];   // log chat/lệnh (POST /api/chat/log) — KHÔNG filter

// ====== writeLog ======
function writeLog(message) {
    const timeString = new Date().toLocaleString('vi-VN');
    const logEntry = `[${timeString}] ${message}`;
    console.log(logEntry);
    logHistory.unshift(logEntry);
    if (logHistory.length > MAX_LOGS) logHistory.length = MAX_LOGS;
}

// ====== USERS DB (giữ nguyên) ======
const usersDB = {
    "trap":   { password: "1234",   expire_at: "2026-08-29T23:59:59+07:00", allowed_ip: "" },
    "thinh":  { password: "thinhh", expire_at: "2026-08-28T21:39:00+07:00", allowed_ip: "" },
    "peak":   { password: "1002",   expire_at: "2026-08-28T21:39:00+07:00", allowed_ip: "" },
    "lumi":   { password: "1003",   expire_at: "2026-08-28T23:59:59+07:00", allowed_ip: "" },
    "noname": { password: "10314",  expire_at: "2026-08-21T23:59:59+07:00", allowed_ip: "" },
    "belanh":    { password: "2222",   expire_at: "2026-08-28T23:59:59+07:00", allowed_ip: "" }
};

// ====== ROUTES ======

app.get('/', (req, res) => {
    res.status(200)
       .type('text/plain; charset=utf-8')
       .send("Auth Server is running! Truy cập /logs để xem lịch sử hoạt động.");
});

// /logs — server-side logs
app.get('/logs', (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>Server Logs</title>
            <meta http-equiv="refresh" content="5">
            <style>
                body { font-family: monospace; background-color: #1e1e1e; color: #d4d4d4; padding: 20px; }
                h2 { color: #4ec9b0; }
                pre { background-color: #252526; padding: 15px; border-radius: 5px; border: 1px solid #333; max-height: 80vh; overflow-y: auto; }
                .info { color: #9cdcfe; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <h2>Lịch sử hoạt động của Server (Real-time Logs)</h2>
            <div class="info">Trang sẽ tự động làm mới sau mỗi 5 giây để cập nhật log mới nhất.</div>
            <pre>${safePre(logHistory, 'Chưa có log nào được ghi nhận.')}</pre>
        </body>
        </html>`;
    res.status(200).type('text/html; charset=utf-8').send(html);
});

// /api/auth/login (giữ nguyên)
app.post('/api/auth/login', (req, res) => {
    const username  = (req.body.username || '').toString().trim().toLowerCase();
    const password  = (req.body.password || '').toString().trim();
    const rawIp     = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const clientIp  = rawIp.split(',')[0].trim();
    const user      = usersDB[username];

    if (!user || user.password !== password) {
        writeLog(`[LOGIN THẤT BẠI] Username: '${username}' | IP: ${clientIp} | Lý do: Sai tài khoản hoặc mật khẩu`);
        return res.status(401).json({ valid: false, message: "Sai tài khoản hoặc mật khẩu!" });
    }

    const expireTime = new Date(user.expire_at).getTime();
    if (isNaN(expireTime) || Date.now() >= expireTime) {
        writeLog(`[LOGIN THẤT BẠI] Username: '${username}' | IP: ${clientIp} | Lý do: Tài khoản đã hết hạn (${user.expire_at})`);
        return res.status(403).json({ valid: false, message: "Tài khoản của bạn đã hết hạn sử dụng!" });
    }

    if (!user.allowed_ip) {
        user.allowed_ip = clientIp;
        writeLog(`[GÁN IP MỚI] Username: '${username}' chưa có IP trước đó. Đã khóa cố định với IP: ${clientIp} (Hợp lệ)`);
    } else if (user.allowed_ip === clientIp) {
        writeLog(`[KIỂM TRA IP] Username: '${username}' đăng nhập với IP hiện tại: ${clientIp} -> Trùng khớp, HỢP LỆ!`);
    } else {
        writeLog(`[CẬP NHẬT IP] Username: '${username}' đổi IP từ [${user.allowed_ip}] sang [${clientIp}] -> Chấp nhận IP mới`);
        user.allowed_ip = clientIp;
    }

    writeLog(`[LOGIN THÀNH CÔNG] Username: '${username}' | IP: ${clientIp}`);
    return res.status(200).json({ valid: true, message: "Đăng nhập thành công!" });
});

// /api/auth/check-status (giữ nguyên)
app.post('/api/auth/check-status', (req, res) => {
    const username = (req.body.username || '').toString().trim().toLowerCase();
    const rawIp    = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const clientIp = rawIp.split(',')[0].trim();
    const user     = usersDB[username];

    if (!user || user.allowed_ip !== clientIp) {
        writeLog(`[CHECK-STATUS TỪ CHỐI] Username: '${username}' | IP (${clientIp}) không khớp (${user ? user.allowed_ip : 'Không tồn tại'})`);
        return res.status(403).json({ valid: false, message: "IP không hợp lệ!" });
    }

    const expireTime = new Date(user.expire_at).getTime();
    if (isNaN(expireTime) || Date.now() >= expireTime) {
        writeLog(`[CHECK-STATUS HẾT HẠN] Username: '${username}' đã hết hạn sử dụng.`);
        return res.status(403).json({ valid: false, message: "Tài khoản đã hết hạn!" });
    }

    return res.status(200).json({ valid: true, message: "Trạng thái hợp lệ" });
});

// ====== /api/chat/log — ĐÃ XOÁ FILTER ======
//
// Schema JSON mà add-on gửi (AddonTemplate.java mới):
//   { "direction": "out"|"in", "username": "...", "message": "..." }
//
// Ghi tất cả, không drop. Bất kỳ log nào đến đều vào chatHistory.
app.post('/api/chat/log', (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ success: false, message: "Body phải là JSON object!" });
    }

    const direction = (req.body.direction || '').toString().trim() || "?";
    const username  = (req.body.username  || '').toString().trim();
    const message   = (req.body.message   || '').toString().trim();

    if (!username || !message) {
        console.warn('[chat-log] 400 thiếu trường:', { direction, username, message });
        return res.status(400).json({ success: false, message: "Thiếu thông tin!" });
    }

    // Bỏ color-code Minecraft (§) để viewer hiển thị sạch
    const cleanMsg = message.replace(/§./g, '').replace(/\[color\]/g, '');

    const timeString = new Date().toLocaleString('vi-VN');
    const arrow      = direction === 'in' ? '←' : (direction === 'out' ? '→' : '·');
    const logEntry   = `[${timeString}] ${arrow} ${username}: ${cleanMsg}`;

    chatHistory.unshift(logEntry);
    if (chatHistory.length > MAX_CHAT) chatHistory.length = MAX_CHAT;

    console.log(logEntry);
    return res.status(200).json({ success: true });
});

// /chat-logs — viewer, hiển thị URL trên tab + header
app.get('/chat-logs', (req, res) => {
    const VIEWER_URL = "https://sever-8wln.onrender.com/chat-logs";
    const html = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>/chat-logs — Chat &amp; Command In-game (Real-time)</title>
            <meta http-equiv="refresh" content="3">
            <style>
                body { font-family: monospace; background-color: #1e1e1e; color: #d4d4d4; padding: 20px; }
                h2 { color: #4ec9b0; }
                pre { background-color: #252526; padding: 15px; border-radius: 5px; border: 1px solid #333; max-height: 80vh; overflow-y: auto; line-height: 1.5; font-size: 14px; }
                .info { color: #9cdcfe; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <h2>${escapeHtml(VIEWER_URL)}</h2>
            <div class="info">Hiển thị mọi tin nhắn và câu lệnh (/pv, /home, /dn...) người chơi thực hiện. Tự động cập nhật sau mỗi 3 giây.</div>
            <pre>${safePre(chatHistory, 'Chưa có hoạt động chat hoặc lệnh nào được ghi nhận.')}</pre>
        </body>
        </html>`;
    res.status(200).type('text/html; charset=utf-8').send(html);
});

// ====== KHỞI ĐỘNG ======
app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});

// ====== KEEP-ALIVE ======
const INTERVAL = 10 * 60 * 1000;
const SELF_URL = "https://sever-8wln.onrender.com";

setInterval(() => {
    const https = require('https');
    https.get(SELF_URL, (res) => {
        writeLog(`[KEEP-ALIVE] Auto-ping thành công. Status code: ${res.statusCode}`);
    }).on('error', (err) => {
        writeLog(`[KEEP-ALIVE LỖI] ${err.message}`);
    });
}, INTERVAL);
    // ===== TỐI ƯU: CHỈ nhận LỆNH (message bắt đầu bằng '/') — bỏ chat thường =====
    // Xoá ký tự zero-width/BOM phòng addon gửi kèm, rồi kiểm tra dấu '/'
    const cmdText = message.replace(/[\u200B-\u200D\uFEFF]/g, '');
    if (!cmdText.startsWith('/')) {
        console.log(`[${new Date().toISOString()}] SKIP non-command: ${username}: ${message}`);
        return res.status(200).json({ success: true, filtered: true, skipped: 1, accepted: 0 });
    }

    // Lọc nhiễu (dự phòng cho lệnh, ví dụ server echo): không ghi vào chatHistory, vẫn trả 200
    if (isNoise(cmdText) || isNoise(username)) {
        console.log(`[${new Date().toISOString()}] NOISE-DROP ${username}: ${cmdText}`);
        return res.status(200).json({ success: true, filtered: true, skipped: 1, accepted: 0 });
    }

    const timeString = new Date().toLocaleString('vi-VN');
    const logEntry = `[${timeString}] ${username}: ${cmdText}`;

    chatHistory.unshift(logEntry);
    if (chatHistory.length > MAX_CHAT) chatHistory.length = MAX_CHAT;

    console.log(logEntry);
    return res.status(200).json({ success: true, accepted: 1, skipped: 0 });
