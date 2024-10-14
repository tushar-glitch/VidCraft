const express = require('express');
const { updatePlan } = require('../controllers/premiumController');
const router = express.Router();

router.patch('/updateplan', updatePlan)

module.exports = router;