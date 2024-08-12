const express = require('express');
const { uploadVideo } = require('../controllers/videoController');
const multer = require('multer');
const auth = require('../middleware/auth');
const session = require('../middleware/session')
const upload = multer({ dest: './uploads/' });
const router = express.Router();

// router.post('/upload', session, auth, upload.single('file'),  uploadVideo)
router.post('/upload', upload.single('file'),  uploadVideo)
module.exports = router;