const { v4: uuidv4 } = require('uuid')
const client = require('../db/conn')

exports.updatePlan = async (req, res) => {
    const { plan, id } = req.body

    if (plan && id) {
        if (plan < 0 || plan > 3) return res.status(400).json({ message: "Invalid plan!" });
        const number_of_req = (plan == 1) ? 50 : (plan == 2) ? 100 : 200;
        client.query('UPDATE users SET membership_type = $1, number_of_req = $2 WHERE id = $3', [plan, number_of_req, id], async (error, result) => {
            if (error) {
                return res.status(400).json({ message: 'Failed to update plan!' })
            }
            if (!result || !result.rowCount)
                return res.status(400).json({ message: 'User not found!' })

            // Create new api_token
            const api_token = uuidv4()

            client.query('Update users set api_token = $1 where id = $2', [api_token, id], async (error, result) => {
                if (error) return res.status(400).json({ message: "Something went wrong!" })
                if (!result || !result.rowCount)
                    return res.status(400).json({ message: 'User not found!' })
                return res.status(200).json({ message: 'Plan updated successfully!' })
            })
        })
    }
    else {
        return res.status(400).json({ message: 'Invalid request!' })
    }
}



