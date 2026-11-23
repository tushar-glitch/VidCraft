const { v4: uuidv4 } = require('uuid')
const client = require('../db/conn')

const check_if_session_token_expired = (_date) => {
    const date = new Date(_date)
    const curr_date = new Date();
    const diff_in_time = curr_date - date
    const diff_in_hours = diff_in_time / (1000 * 60 * 60);
    return (diff_in_hours>=8)
}


const session = async (req, res, next) => {
    var session_token = req.cookies.session_token
    var user_id = req.user_id
    try {
        if (session_token) {
            var is_session_expired = false;
            const query = 'SELECT * from session where session_token = $1'
            client.query(query, [session_token], (err, result) => {
                if (err) {
                    console.log(err);
                }
                console.log(result.rows[0].created_at);
                is_session_expired = check_if_session_token_expired(result.rows[0].created_at)
            })

            // Session has expired here
            if (is_session_expired) {
                console.log('Session expired!')
                const new_session_token = uuidv4()
                req.session_token = session_token
                res.cookie('session_token', new_session_token, { maxAge: 8 * 60 * 60 * 1000 }); // 8 hours
                const query = 'UPDATE session SET session_token = $1 where user_id = $2 RETURNING *'
                client.query(query, [new_session_token, user_id], (err, result) => {
                    if (err) {
                        console.log(err)
                        res.status(400).json({ msg: "Failed to update session!" })
                    }
                    else {
                        console.log("Session updated successfully!")
                    }
                })
            }
            else {
                req.session_token = session_token
            }
        }
        else {
            console.log('token not found')
            const new_session_token = uuidv4()
            res.cookie('session_token', new_session_token, { maxAge: 8 * 60 * 60 * 1000 }); // 8 hours
            req.session_token = session_token
            const query = 'INSERT INTO session (session_token, user_id) VALUES ($1, $2) RETURNING *'
            client.query(query, [new_session_token, user_id], (err, result) => {
                if (err) {
                    console.log(err)
                    res.status(400).json({ msg: "Failed to create session!" })
                }
                else {
                    console.log("Session created successfully!")
                }
            })
        }
    }   
    catch (err) {
        console.log(err);
    }
    next()
}
module.exports = session