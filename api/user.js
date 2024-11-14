import { Router } from 'express';
import { generate } from 'randomstring';
import { createHash } from 'crypto';

export default (db) => {
    const router = Router();

    // Middleware kiểm tra đăng nhập
    function ensureAuthenticated(req, res, next) {
        console.log(req.session); // Kiểm tra session có tồn tại không
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập trước' });
        }
        next();
    }
    // Get all users
    router.get('/',ensureAuthenticated, (req, res) => {
        db.all('SELECT id, ten, sdt, diachi, email, chucvu, is_admin FROM users', [], (err, rows) => {
            if (err) {
                console.error(err.message);
                return;
            }
            console.log(rows); // Hiển thị dữ liệu mà không có cột `pw`
        });
    });
    
    // Get all users (only id and ten)
    router.get('/basic', ensureAuthenticated, (req, res) => {
        db.all('SELECT id, ten FROM users', [], (err, rows) => {
            if (err) {
                console.error(err.message);
                return res.status(500).json({ error: 'Database error' });
            }
            console.log(rows); // Hiển thị dữ liệu với chỉ id và ten
            res.json(rows); // Trả về dữ liệu cho client
        });
    });


    // Add a new user
    router.post('/', (req, res) => {
        const { name, phone, address, email, position, isAdmin } = req.body;
        const randomPassword = generate({ length: 12, charset: 'alphanumeric' });
        const hashedPassword = createHash('sha256').update(randomPassword).digest('hex');

        if (!name || !phone || !address || !email || !position || isAdmin === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const sql = `INSERT INTO users (ten, sdt, diachi, email, pw, chucvu, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [name, phone, address, email, hashedPassword, position, isAdmin], function (err) {
            if (err) {
                return res.status(500).send(err.message);
            }
            res.status(201).json({ id: this.lastID, name, phone, address, email, randomPassword, position, isAdmin });
        });
    });

    // Update user
    router.put('/:id', (req, res) => {
        const { name, phone, address, email, position, isAdmin } = req.body;
        const userId = parseInt(req.params.id);
        // Check if email already exists
        db.get('SELECT * FROM users WHERE email = ? AND id != ?', [email, userId], (err, row) => {
            if (err) return res.status(500).send('Lỗi khi kiểm tra email.');
            if (row) {
                return res.status(400).json({ error: 'Email này đã tồn tại. Vui lòng chọn email khác.' });
            }

            const sql = `UPDATE users SET ten = ?, sdt = ?, diachi = ?, email = ?, chucvu = ?, is_admin = ? WHERE id = ?`;
            db.run(sql, [name, phone, address, email, position, isAdmin, userId], function (err) {
                if (err) return res.status(500).send('Đã xảy ra lỗi khi cập nhật người dùng.');
                if (this.changes === 0) {
                    return res.status(404).json({ success: false, message: 'Người dùng không tìm thấy.' });
                }
                res.json({ success: true, message: 'Cập nhật thông tin người dùng thành công.' });
            });
        });
    });

    // Delete user
    router.delete('/:id', (req, res) => {
        const userId = parseInt(req.params.id);
        db.run(`DELETE FROM users WHERE id = ?`, userId, function (err) {
            if (err) {
                return res.status(500).json({ message: 'Lỗi khi xóa người dùng.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ message: 'Người dùng không tồn tại.' });
            }
            res.status(200).json({ message: 'Người dùng đã được xóa thành công.' });
        });
    });

    return router;
};