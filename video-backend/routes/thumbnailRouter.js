const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const { upload_thumbnail } = require('../controllers/thumbnailController');
const upload = multer({ dest: './uploads/' });
const router = express.Router();

router.post('/upload', auth, upload.single('file'),  upload_thumbnail)
module.exports = router;