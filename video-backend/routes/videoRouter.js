const express = require('express');
const { uploadVideo, uploadVideo2 } = require('../controllers/videoController');
const multer = require('multer');
const auth = require('../middleware/auth');
const session = require('../middleware/session')
const upload = multer({ dest: './uploads/' });
const router = express.Router();

// router.post('/upload', session, auth, upload.single('file'),  uploadVideo)
router.post('/upload', upload.single('file'),  uploadVideo)
// router.post('/upload', uploadVideo2)
module.exports = router;