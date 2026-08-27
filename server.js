const express = require('express');
const app = express();

app.use(express.json());

// Hàm ghi log chuẩn thời gian
function writeLog(message) {
    const timeString = new Date().toLocaleString('vi-VN');
    console.log(`[${timeString}] ${message}`);
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

// API 1: Đăng nhập
app.post('/api/auth/login', (req, res) => {
    const username = (req.body.username || '').trim().toLowerCase();
    const password = (req.body.password || '').trim();
    
    // Lấy chuẩn IP từ Proxy của Render hoặc Cloud
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

    // Cơ chế IP
    if (!user.allowed_ip) {
        user.allowed_ip = clientIp;
        writeLog(`[KHÓA IP CỐ ĐỊNH] Username: '${username}' đã gắn chết với IP: ${clientIp}`);
    } else if (user.allowed_ip !== clientIp) {
        writeLog(`[CẬP NHẬT IP MỚI] Username: '${username}' đổi IP từ ${user.allowed_ip} sang ${clientIp}`);
        user.allowed_ip = clientIp;
    }

    writeLog(`[LOGIN THÀNH CÔNG] Username: '${username}' | IP: ${clientIp}`);
    return res.status(200).json({ valid: true, message: "Đăng nhập thành công!" });
});

// API 2: Kiểm tra định kỳ trạng thái từ AuthChecker của Client (mỗi 15 giây)
app.post('/api/auth/check-status', (req, res) => {
    const username = (req.body.username || '').trim().toLowerCase();
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const clientIp = rawIp.split(',')[0].trim();

    const user = usersDB[username];

    // Nếu không tìm thấy user hoặc IP bị lệch/thay đổi bất thường so với lúc đăng nhập
    if (!user || user.allowed_ip !== clientIp) {
        return res.status(403).json({ valid: false, message: "IP không hợp lệ!" });
    }

    const currentTime = Date.now();
    const expireTime = new Date(user.expire_at).getTime();

    // Nếu thời gian hiện tại đã quá hạn
    if (isNaN(expireTime) || currentTime >= expireTime) {
        return res.status(403).json({ valid: false, message: "Tài khoản đã hết hạn!" });
    }

    return res.status(200).json({ valid: true, message: "Trạng thái hợp lệ" });
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});
