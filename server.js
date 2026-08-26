const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Đường dẫn tới file log
const logFilePath = path.join(__dirname, 'server.log');

// Hàm hỗ trợ ghi log ra cả Terminal lẫn File log
function writeLog(message) {
    const vnTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const logMessage = `[${vnTime}] ${message}\n`;

    // In ra Terminal Render
    console.log(logMessage.trim());

    // Ghi nối tiếp vào file server.log
    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) console.error("Lỗi khi ghi file log:", err);
    });
}

// Danh sách tài khoản
const usersDB = {
    "user1": {
        password: "123",
        expire_at: "2026-12-31T23:59:59+07:00",
        allowed_ip: ""
    },
    "user2": {
        password: "456",
        expire_at: "2026-08-01T12:00:00+07:00",
        allowed_ip: ""
    }
};

// Trang chủ + API tải file log trực tiếp trên trình duyệt
app.get('/', (req, res) => {
    res.send("Server Auth Minecraft Client đang hoạt động!");
});

// API xem/tải file log (Mở https://sever-8wln.onrender.com/logs trên trình duyệt)
app.get('/logs', (req, res) => {
    if (fs.existsSync(logFilePath)) {
        res.sendFile(logFilePath);
    } else {
        res.status(444).send("Chưa có dữ liệu log nào được tạo!");
    }
});

// =========================================================================
// 1. API ĐĂNG NHẬP BAN ĐẦU
// =========================================================================
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

    const user = usersDB[username];

    if (!user) {
        writeLog(`[LOGIN THẤT BẠI] Username: '${username}' | IP: ${clientIp} | Lý do: Tài khoản không tồn tại`);
        return res.status(401).json({ valid: false, message: "Tài khoản không tồn tại!" });
    }

    if (user.password !== password) {
        writeLog(`[LOGIN THẤT BẠI] Username: '${username}' | IP: ${clientIp} | Lý do: Sai mật khẩu`);
        return res.status(401).json({ valid: false, message: "Mật khẩu không chính xác!" });
    }

    const currentTime = Date.now();
    const expireTime = new Date(user.expire_at).getTime();

    if (currentTime > expireTime) {
        writeLog(`[LOGIN THẤT BẠI] Username: '${username}' | IP: ${clientIp} | Lý do: Tài khoản đã hết hạn`);
        return res.status(403).json({ valid: false, message: "Tài khoản đã hết hạn!" });
    }

    if (!user.allowed_ip) {
        user.allowed_ip = clientIp;
        writeLog(`[GHI NHẬN IP MỚI] Username: '${username}' -> Đã gán IP: ${clientIp}`);
    } else if (user.allowed_ip !== clientIp) {
        writeLog(`[CẢNH BÁO IP] Username: '${username}' | IP Đăng nhập: ${clientIp} | IP Gốc: ${user.allowed_ip}`);
        return res.status(403).json({ valid: false, message: "Tài khoản đang được sử dụng ở thiết bị/IP khác!" });
    }

    writeLog(`[LOGIN THÀNH CÔNG] Username: '${username}' | IP: ${clientIp}`);
    return res.status(200).json({ valid: true, message: "Đăng nhập thành công!" });
});

// =========================================================================
// 2. API KIỂM TRA TRẠNG THÁI ĐỊNH KỲ (HEARTBEAT)
// =========================================================================
app.post('/api/auth/check-status', (req, res) => {
    const { username } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

    const user = usersDB[username];

    if (!user) {
        return res.status(401).json({ valid: false, message: "Tài khoản không tồn tại!" });
    }

    const currentTime = Date.now();
    const expireTime = new Date(user.expire_at).getTime();

    if (currentTime > expireTime) {
        writeLog(`[HEARTBEAT NGẮT] Username: '${username}' bị kick do vừa hết hạn`);
        return res.status(403).json({ valid: false, message: "Tài khoản đã hết hạn!" });
    }

    if (user.allowed_ip && user.allowed_ip !== clientIp) {
        writeLog(`[HEARTBEAT NGẮT] Username: '${username}' bị kick do sai IP (${clientIp})`);
        return res.status(403).json({ valid: false, message: "Phát hiện IP không hợp lệ!" });
    }

    return res.status(200).json({ valid: true, message: "Tài khoản hợp lệ." });
});

app.listen(PORT, () => {
    writeLog(`Server khởi chạy thành công trên port ${PORT}`);
});
