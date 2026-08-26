const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// File lưu nhật ký hoạt động
const LOG_FILE = path.join(__dirname, 'server.log');

// Hàm ghi log vào file và console
function writeLog(message) {
    const timestamp = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    const logLine = `[${timestamp}] ${message}\n`;
    console.log(logLine.trim());
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');
}

// Cơ sở dữ liệu người dùng (Thay đổi thông tin tài khoản tại đây)
const usersDB = {
    "admin": {
        password: "0005",
        expire_at: "2026-08-29T22:05:00+07:00", // Định dạng ISO-8601 chuẩn
        allowed_ip: ""
    },
    "peak": {
        password: "1002",
        expire_at: "2026-08-27T21:39:00+07:00",
        allowed_ip: ""
    }
};
    "kana": {
        password: "1001",
        expire_at: "2026-08-27T21:39:00+07:00",
        allowed_ip: ""
    }
};
// API 1: Đăng nhập
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

    const user = usersDB[username];

    if (!user || user.password !== password) {
        writeLog(`[LOGIN THẤT BẠI] Username: '${username}' | IP: ${clientIp} | Lý do: Sai tài khoản hoặc mật khẩu`);
        return res.status(401).json({ valid: false, message: "Sai tài khoản hoặc mật khẩu!" });
    }

    const currentTime = Date.now();
    const expireTime = new Date(user.expire_at).getTime();

    // Kiểm tra tính hợp lệ của thời gian hết hạn
    if (isNaN(expireTime) || currentTime >= expireTime) {
        writeLog(`[LOGIN THẤT BẠI] Username: '${username}' | IP: ${clientIp} | Lý do: Tài khoản đã hết hạn (${user.expire_at})`);
        return res.status(403).json({ valid: false, message: "Tài khoản của bạn đã hết hạn sử dụng!" });
    }

    // Kiểm tra khóa IP (Nếu tài khoản chưa gán IP thì tự động gán IP lần đầu)
    if (!user.allowed_ip) {
        user.allowed_ip = clientIp;
        writeLog(`[GÁN IP MỚI] Username: '${username}' đã đăng ký IP: ${clientIp}`);
    } else if (user.allowed_ip !== clientIp) {
        writeLog(`[LOGIN THẤT BẠI] Username: '${username}' | IP gửi: ${clientIp} | IP chuẩn: ${user.allowed_ip}`);
        return res.status(403).json({ valid: false, message: "Tài khoản đang được dùng trên thiết bị/IP khác!" });
    }

    writeLog(`[LOGIN THÀNH CÔNG] Username: '${username}' | IP: ${clientIp}`);
    return res.status(200).json({ valid: true, message: "Đăng nhập thành công!" });
});

// API 2: Kiểm tra trạng thái liên tục (Heartbeat cho AuthChecker.java)
app.post('/api/auth/check-status', (req, res) => {
    const { username } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

    const user = usersDB[username];

    if (!user) {
        return res.status(401).json({ valid: false, message: "Tài khoản không tồn tại!" });
    }

    const currentTime = Date.now();
    const expireTime = new Date(user.expire_at).getTime();

    if (isNaN(expireTime) || currentTime >= expireTime) {
        writeLog(`[HEARTBEAT NGẮT] Username: '${username}' bị ngắt do hết hạn (${user.expire_at})`);
        return res.status(403).json({ valid: false, message: "Tài khoản đã hết hạn!" });
    }

    if (user.allowed_ip && user.allowed_ip !== clientIp) {
        writeLog(`[HEARTBEAT NGẮT] Username: '${username}' bị ngắt do sai IP (${clientIp})`);
        return res.status(403).json({ valid: false, message: "Phát hiện thay đổi IP bất thường!" });
    }

    return res.status(200).json({ valid: true, message: "Tài khoản hợp lệ." });
});

// Xem nhật ký trực tiếp qua trình duyệt
app.get('/logs', (req, res) => {
    if (fs.existsSync(LOG_FILE)) {
        res.sendFile(LOG_FILE);
    } else {
        res.send("Chưa có nhật ký hoạt động nào.");
    }
});

// Route kiểm tra máy chủ
app.get('/', (req, res) => {
    res.send("Auth Server đang hoạt động bình thường!");
});

// Khởi chạy Máy chủ
app.listen(PORT, () => {
    writeLog(`[SERVER START] Máy chủ Auth đang chạy trên cổng: ${PORT}`);

    // Cơ chế Self-Ping giữ Server không bị ngủ đông trên Render
    const SERVER_URL = "https://sever-8wln.onrender.com/";
    setInterval(() => {
        https.get(SERVER_URL, (res) => {
            writeLog(`[KEEP-ALIVE] Auto-ping thành công. Status code: ${res.statusCode}`);
        }).on('error', (err) => {
            writeLog(`[KEEP-ALIVE LỖI] Auto-ping thất bại: ${err.message}`);
        });
    }, 10 * 60 * 1000); // Tự động gửi request mỗi 10 phút
});
