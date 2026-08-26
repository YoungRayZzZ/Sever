const usersDB = {
    "admin": {
        password: "0005",
        expire_at: "2026-08-29T22:05:00+07:00",
        allowed_ip: "42.113.171.240" // Ban đầu để trống, ai đăng nhập đầu tiên sẽ tự động khóa chết IP vào đây vĩnh viễn
    },
    "peak": {
        password: "1002",
        expire_at: "2026-08-27T21:39:00+07:00",
        allowed_ip: ""
    },
    "kana": {
        password: "1001",
        expire_at: "2026-08-27T21:39:00+07:00",
        allowed_ip: ""
    }
};

// API 1: Đăng nhập
app.post('/api/auth/login', (req, res) => {
    const username = (req.body.username || '').trim().toLowerCase();
    const password = (req.body.password || '').trim();
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

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

    // --- CƠ CHẾ KHÓA CỨNG IP VĨNH VIỄN CHO NGƯỜI ĐẦU TIÊN ---
    if (!user.allowed_ip) {
        // Nếu chưa có IP nào được gán, khóa cứng IP của người đầu tiên vào đây
        user.allowed_ip = clientIp;
        writeLog(`[KHÓA IP CỐ ĐỊNH] Username: '${username}' đã gắn chết với IP: ${clientIp}`);
    } else if (user.allowed_ip !== clientIp) {
        // Nếu đã có IP mà máy khác cố tình đăng nhập vào (dù tài khoản đang offline) -> TỪ CHỐI LUÔN
        writeLog(`[CHẶN TRUY CẬP] Username: '${username}' cố gắng đăng nhập từ IP lạ: ${clientIp} (IP chuẩn: ${user.allowed_ip})`);
        return res.status(403).json({ valid: false, message: "Tài khoản này đã bị khóa với thiết bị khác!" });
    }

    writeLog(`[LOGIN THÀNH CÔNG] Username: '${username}' | IP: ${clientIp}`);
    return res.status(200).json({ valid: true, message: "Đăng nhập thành công!" });
});
