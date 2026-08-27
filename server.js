const express = require('express');
const app = express();

app.use(express.json());

// Mảng lưu trữ tối đa 100 dòng log gần nhất để xem trên web
const logHistory = [];
const MAX_LOGS = 100;

// Hàm ghi log: vừa hiển thị console vừa lưu vào mảng
function writeLog(message) {
    const timeString = new Date().toLocaleString('vi-VN');
    const logEntry = `[${timeString}] ${message}`;
    
    // In ra console như bình thường
    console.log(logEntry);
    
    // Lưu vào mảng lịch sử log
    logHistory.unshift(logEntry); // Đưa log mới lên đầu danh sách
    if (logHistory.length > MAX_LOGS) {
        logHistory.pop(); // Giới hạn số lượng log tránh tốn bộ nhớ
    }
}

const usersDB = {
    "trap": {
        password: "1234",
        expire_at: "2026-08-29T23:59:59+07:00",
        allowed_ip: ""
    },
    "thinh": {
        password: "thinhh",
        expire_at: "2026-08-28T21:39:00+07:00",
        allowed_ip: ""
    },
    "peak": {
        password: "1002",
        expire_at: "2026-08-28T21:39:00+07:00",
        allowed_ip: ""
    },
    "lumi": {
        password: "1003",
        expire_at: "2026-08-28T23:59:59+07:00",
        allowed_ip: ""
    },
    "noname": {
        password: "1004",
        expire_at: "2026-08-28T23:59:59+07:00",
        allowed_ip: ""
    },
    "dyo": {
        password: "1005",
        expire_at: "2026-08-28T23:59:59+07:00",
        allowed_ip: ""
    }
};

// Route trang chủ
app.get('/', (req, res) => {
    res.status(200).send("Auth Server is running! Truy cập /logs để xem lịch sử hoạt động.");
});

// Route mới: Xem log trực tiếp trên trình duyệt tại /logs
app.get('/logs', (req, res) => {
    // Trả về giao diện HTML đơn giản hiển thị danh sách log, có nút tải lại trang (F5)
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>Server Logs</title>
            <meta http-equiv="refresh" content="5"> <!-- Tự động tải lại trang sau mỗi 5 giây -->
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
            <pre>${logHistory.length > 0 ? logHistory.join('\n') : 'Chưa có log nào được ghi nhận.'}</pre>
        </body>
        </html>
    `;
    res.status(200).send(htmlContent);
});

// API 1: Đăng nhập
app.post('/api/auth/login', (req, res) => {
    const username = (req.body.username || '').trim().toLowerCase();
    const password = (req.body.password || '').trim();
    
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const clientIp = rawIp.split(',')[0].trim();

    const user = usersDB[username];

    if (!user || user.password !== password) {
        writeLog(`[LOGIN THẤT BẠI] Username: '${username}' | IP: ${clientIp} | Lý do: Sai tài khoản hoặc mật khẩu`);
        return res.status(401).json({ valid: false, message: "Sai tài khoản hoặc mật khẩu!" });
    }

    const currentTime = Date.now();
    const expireTime = new Date(user.expire_at).getTime();

    if (isNaN(expireTime) || currentTime >= expireTime) {
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

// API 2: Kiểm tra định kỳ trạng thái từ AuthChecker của Client
app.post('/api/auth/check-status', (req, res) => {
    const username = (req.body.username || '').trim().toLowerCase();
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const clientIp = rawIp.split(',')[0].trim();

    const user = usersDB[username];

    if (!user || user.allowed_ip !== clientIp) {
        writeLog(`[CHECK-STATUS TỪ CHỐI] Username: '${username}' | IP hiện tại (${clientIp}) không khớp với IP đã gán (${user ? user.allowed_ip : 'Không tồn tại'})`);
        return res.status(403).json({ valid: false, message: "IP không hợp lệ!" });
    }

    const currentTime = Date.now();
    const expireTime = new Date(user.expire_at).getTime();

    if (isNaN(expireTime) || currentTime >= expireTime) {
        writeLog(`[CHECK-STATUS HẾT HẠN] Username: '${username}' đã hết hạn sử dụng.`);
        return res.status(403).json({ valid: false, message: "Tài khoản đã hết hạn!" });
    }

    return res.status(200).json({ valid: true, message: "Trạng thái hợp lệ" });
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});

// Tự động ping server mỗi 10 phút để tránh bị sleep trên Render
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
