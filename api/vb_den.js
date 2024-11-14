import { Router } from 'express';
import multer, { diskStorage } from 'multer';
import { existsSync, unlinkSync } from 'fs';
import path, { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export default (db) => {
    const router = Router();

    // Định nghĩa __filename và __dirname
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Định nghĩa thư mục để lưu file tải lên
    const uploadDir = join(__dirname, '../doc');
    const storage = diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const filePath = join(uploadDir, file.originalname);
            if (existsSync(filePath)) {
                unlinkSync(filePath); // Xóa tệp cũ nếu tồn tại
            }
            cb(null, file.originalname);
        }
    });


    const upload = multer({ storage: storage });

    // Middleware kiểm tra đăng nhập
    function ensureAuthenticated(req, res, next) {
        console.log(req.session); // Kiểm tra session có tồn tại không
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập trước' });
        }
        next();
    }


    // API lấy dữ liệu vb_den
    router.get('/', ensureAuthenticated, (req, res) => {
        const userId = req.session.userId;
        const userRole = req.session.userRole;

        let sql = `
        SELECT
            vb_den.*,
            users.id AS nguoiphutrach_id,
            users.ten AS nguoiphutrach
        FROM
            vb_den
        JOIN
            users
        ON
            vb_den.nguoiphutrach = users.id;
    `;

        if (userRole === 'user') {
            sql += ` WHERE vb_den.nguoiphutrach = ?`;
            db.all(sql, [userId], (err, rows) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Lỗi khi truy vấn dữ liệu.' });
                }
                res.json(rows);
            });
        } else {
            db.all(sql, [], (err, rows) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Lỗi khi truy vấn dữ liệu.' });
                }
                res.json(rows);
            });
        }
    });

    // API cập nhật thông tin văn bản đến
    router.put('/:id', upload.single('documentFile'), (req, res) => {
        const documentId = parseInt(req.params.id);
        const { tenvb, noidung, ngayden, so, han, nguoiphutrach } = req.body;
        const documentFile = req.file; // Tệp mới nếu có

        // Kiểm tra nếu không có tệp mới, sử dụng tệp cũ
        const filePath = documentFile ? `../../doc/${path.basename(documentFile.filename)}` : req.body.oldFilePath || null;

        // Cập nhật thông tin văn bản, sử dụng filePath mới hoặc cũ
        updateDocument(documentId, tenvb, noidung, ngayden, parseInt(so), han, parseInt(nguoiphutrach), filePath)
            .then(() => {
                // Lưu log vào bản
                const userId = parseInt(req.session.userId);
                saveLog(userId, documentId, filePath, 0, "")
                    .then(() => {
                        res.json({ success: true, message: 'Văn bản đã được cập nhật thành công.' });
                    })
                    .catch(err => {
                        res.status(500).json({ success: false, message: 'Lỗi khi lưu log.' });
                    });
            })
            .catch(err => {
                res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi cập nhật văn bản.' });
            });
    });


    // API thêm thông tin văn bản đến
    router.post('/', upload.single('documentFile'), (req, res) => {
        const { tenvb, noidung, ngayden, so, han, nguoiphutrach } = req.body;
        const documentFile = req.file;
        const filePath = documentFile ? `../../doc/${path.basename(documentFile.filename)}` : req.body.oldFilePath || null;

        // Thêm thông tin văn bản
        addDocument(tenvb, noidung, ngayden, so, han, nguoiphutrach, filePath)
            .then((documentId) => {
                // Lưu log vào bảng log
                const userId = req.session.userId;
                // console.log('Dữ liệu sẽ được insert:', [userId,tenvb, noidung, ngayden, so, han, nguoiphutrach, documentId,filePath]);
                saveLog(userId, documentId, filePath, 0, "")
                    .then(() => {
                        res.json({ success: true, message: 'Văn bản đã được thêm thành công.' });
                    })
                    .catch(err => {
                        res.status(500).json({ success: false, message: 'Lỗi khi lưu log.' });
                    });
            })
            .catch(err => {
                res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi thêm văn bản.' });
            });
    });

    // Cập nhật thông tin văn bản vào bảng vb_den
    function updateDocument(id, tenvb, noidung, ngayden, so, han, nguoiphutrach, link) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE vb_den SET tenvb = ?, noidung = ?, ngayden = ?, so = ?, han = ?, nguoiphutrach = ?, link = ? WHERE id = ?`;
            db.run(sql, [tenvb, noidung, ngayden, so, han, nguoiphutrach, link, id], function (err) {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }



    // Thêm thông tin văn bản vào bảng vb_den
    function addDocument(tenvb, noidung, ngayden, so, han, nguoiphutrach, link) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO vb_den (tenvb, noidung, ngayden, so, han, nguoiphutrach, link) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            db.run(sql, [tenvb, noidung, ngayden, so, han, nguoiphutrach, link], function (err) {
                if (err) {
                    return reject(err);
                }
                // Lấy ID của văn bản vừa chèn vào
                resolve(this.lastID);
            });
        });
    }


    // Lưu log vào bảng log
    function saveLog(userId, id_vb_den, link_vb_den, id_vb_di, link_vb_di) {
        return new Promise((resolve, reject) => {
            const currentTime = new Date().toISOString();

            // Đảm bảo id_vb_den và id_vb_di là kiểu số nguyên
            const documentIdDen = parseInt(id_vb_den);
            const documentIdDi = parseInt(id_vb_di);
            // Sử dụng path.basename để đảm bảo chỉ lấy phần đuôi của link
            const cleanedLinkVbDen = link_vb_den ? `doc/${path.basename(link_vb_den)}` : null;
            const cleanedLinkVbDi = link_vb_di ? `doc/${path.basename(link_vb_di)}` : null;

            console.log('Dữ liệu sẽ được insert:', [userId, cleanedLinkVbDen, currentTime, documentIdDen, cleanedLinkVbDi, documentIdDi]);
            const sql = `INSERT INTO log (id_user, link_vb_den, thoi_gian, id_vb_den, link_vb_di, id_vb_di) VALUES (?, ?, ?, ?, ?, ?)`;
            db.run(sql, [userId, cleanedLinkVbDen, currentTime, documentIdDen, cleanedLinkVbDi, documentIdDi], function (err) {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }


    // API xóa văn bản
    router.delete('/:id', ensureAuthenticated, (req, res) => {
        const documentId = req.params.id;

        // Kiểm tra xem văn bản có tồn tại hay không
        const sql = `SELECT * FROM vb_den WHERE id = ?`;
        db.get(sql, [documentId], (err, row) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Lỗi khi kiểm tra văn bản.' });
            }

            if (!row) {
                return res.status(404).json({ success: false, message: 'Văn bản không tồn tại.' });
            }

            // Tiến hành xóa văn bản
            const deleteSql = `DELETE FROM vb_den WHERE id = ?`;
            db.run(deleteSql, [documentId], function (err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Lỗi khi xóa văn bản.' });
                }

                // Lưu log nếu cần
                const userId = req.session.userId;
                saveLog(userId, documentId, null, null, null)
                    .then(() => {
                        res.json({ success: true, message: 'Văn bản đã được xóa thành công.' });
                    })
                    .catch(err => {
                        res.status(500).json({ success: false, message: 'Lỗi khi lưu log.' });
                    });
            });
        });
    });



    return router;
};
