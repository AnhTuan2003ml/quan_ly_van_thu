import { Router } from 'express';

export default (db) => {
    const router = Router();

    // Login API
    router.post('/login', (req, res) => {
        const { email, password } = req.body;
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
            if (err) {
                return res.status(500).send('Đã xảy ra lỗi.');
            }
            if (row && password === row.pw) {
                req.session.userId = row.id;
                req.session.userRole = row.is_admin === 1 ? 'admin' : 'user';
                res.json({ success: true, role: req.session.userRole });
            } else {
                res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu!' });
            }
        });
    });

    // Logout API
    router.get('/logout', (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).send('Đã xảy ra lỗi khi đăng xuất.');
            }
            res.redirect('/');
        });
    });

    return router;
};