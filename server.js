const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Hàm hỗ trợ lấy thời gian hiện tại theo định dạng chuẩn Việt Nam (YYYY-MM-DD HH:mm:ss)
function getVNTime(dateInput = new Date()) {
    return new Date(dateInput).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

// Danh sách tài khoản (expire_at hỗ trợ cả định dạng UTC ISO hoặc chuỗi thời gian chuẩn)
const usersDB = {
    "user1": {
        password: "0001",
        expire_at: "2026-12-31T23:59:59+07:00", // Giờ Việt Nam (UTC+7)
        allowed_ip: ""
    },
    "user2": {
        password: "0002",
        expire_at: "2026-08-26T9:00:00+07:00", // Đã hết hạn
        allowed_ip: ""
    }
};

// =========================================================================
// 1. API ĐĂNG NHẬP BAN ĐẦU
// =========================================================================
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

    const user = usersDB[username];

    if (!user) {
        return res.status(401).json({ valid: false, message: "Tài khoản không tồn tại!" });
    }

    if (user.password !== password) {
        return res.status(401).json({ valid: false, message: "Mật khẩu không chính xác!" });
    }

    // So sánh thời gian Epoch ms (chuẩn xác 100% không phụ thuộc mốc giờ của server Render)
    const currentTime = Date.now();
    const expireTime = new Date(user.expire_at).getTime();

    if (currentTime > expireTime) {
        console.log(`[${getVNTime()}] Login thất bại: User '${username}' đã hết hạn.`);
        return res.status(403).json({ valid: false, message: "Tài khoản đã hết hạn!" });
    }

    if (!user.allowed_ip) {
        user.allowed_ip = clientIp;
    } else if (user.allowed_ip !== clientIp) {
        return res.status(403).json({ valid: false, message: "Tài khoản đang được sử dụng ở thiết bị/IP khác!" });
    }

    console.log(`[${getVNTime()}] User '${username}' đăng nhập thành công.`);
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
        console.log(`[${getVNTime()}] Heartbeat: User '${username}' hết hạn -> Ngắt kết nối.`);
        return res.status(403).json({ valid: false, message: "Tài khoản đã hết hạn!" });
    }

    if (user.allowed_ip && user.allowed_ip !== clientIp) {
        return res.status(403).json({ valid: false, message: "Phát hiện IP không hợp lệ!" });
    }

    return res.status(200).json({ valid: true, message: "Tài khoản hợp lệ." });
});

app.listen(PORT, () => {
    console.log(`[${getVNTime()}] Server đang chạy trên port ${PORT}`);
});
