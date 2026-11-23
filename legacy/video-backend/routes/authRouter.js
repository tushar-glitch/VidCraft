const express = require('express');
const { register, login, login_status } = require('../controllers/authController');
const router = express.Router();

router.post('/register',  register)
router.post('/login', login)
router.get('/check-login-status', login_status)
module.exports = router;