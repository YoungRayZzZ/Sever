const express = require('express');
const cors = require('cors');

const app = express();

// Cho phép tất cả các nguồn truy cập API từ xa
app.use(cors());
app.use(express.json());

// Danh sách tài khoản người dùng
// Lưu ý: Múi giờ chuẩn UTC (Giờ VN - 7 tiếng)
const usersDB = {
    "user1": {
        password: "123",
        expire_at: "2026-08-25T4:00:00.000Z" // Hết hạn lúc 21:43 ngày 25/08/2026 giờ VN
    },
    "user2": {
        password: "9123",
        expire_at: "2026-08-30T17:00:00.000Z"
    }
};

// Route kiểm tra trạng thái Server
app.get('/', (req, res) => {
    res.send('Auth Server đang hoạt động!');
});

// API Đăng nhập
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = usersDB[username];

    // Kiểm tra tài khoản và mật khẩu
    if (!user || user.password !== password) {
        return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu!" });
    }

    // So sánh thời gian theo Timestamp (Mili-giây)
    const currentTime = Date.now();
    const expireTime = new Date(user.expire_at).getTime();

    if (currentTime > expireTime) {
        return res.status(403).json({ message: "Tài khoản của bạn đã hết hạn!" });
    }

    return res.status(200).json({ message: "Đăng nhập thành công!" });
});

// Tự động nhận PORT từ Render cấp hoặc dùng 3000 ở máy local
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy trên port ${PORT}`);
});
