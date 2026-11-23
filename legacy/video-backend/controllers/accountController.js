
const client = require('../db/conn')

exports.getAllTasks = async (req, res) => {
    const allTasks = await client.query('select * from tasks where user_id = $1', [req.id]);
    res.status(200).json(allTasks.rows)
}



