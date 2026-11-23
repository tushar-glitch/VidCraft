const express = require('express');
const { getAllTasks } = require('../controllers/accountController');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/getalltasks', auth, getAllTasks)
module.exports = router;