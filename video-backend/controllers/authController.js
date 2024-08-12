
const client = require('../db/conn')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const saltRounds = 10

const is_username_present = async (username) => {
    try {
        const query = 'SELECT * FROM users WHERE username = $1'
        const result = await client.query(query, [username])
        return result.rows.length > 0
    }
    catch (err) {
        console.log(err)
        return false
    }
}

exports.register = async (req, res) => {
    const { firstname, lastname, email, password } = req.body
    try {
        var username = firstname + Math.floor((((Math.random() * 9) + 1)) * 1000)
        // Generating username
        while (await is_username_present(username)) username = firstname + Math.floor((((Math.random() * 9) + 1)) * 1000);

        //Generating hashed password
        const salt = await bcrypt.genSalt(saltRounds);
        var hashed_password = await bcrypt.hash(password, salt)

        // Inserting into DB
        const query = 'INSERT INTO users (firstname, lastname, email, password, username) VALUES ($1, $2, $3, $4, $5) RETURNING *'
        const result = await client.query(query, [firstname, lastname, email, hashed_password, username])
        res.status(201).json({ user: result.rows[0] })
    }
    catch (err) {
        console.log(err)
        res.status(400).json({ msg: 'Registration failed' })
    }
}

exports.login = async (req, res) => {
    const { username_or_email, password } = req.body
    if (username_or_email.includes('@')) {
        try {
            const query = 'SELECT * FROM users WHERE email = $1'
            const result = await client.query(query, [username_or_email])
            if (result.rows.length > 0) {
                const user = result.rows[0]
                const match = await bcrypt.compare(password, user.password)
                if (match) {
                    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '90d' })

                    // Sending token in cookie
                    res.cookie('token', token, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        maxAge: 90 * 24 * 60 * 60 * 1000,
                    })
                    
                    res.status(200).json({ user: user, token: token })
                }
                else {
                    res.status(401).json({ msg: 'Invalid credentials' })
                }
            }
            else {
                res.status(404).json({ msg: 'User not found' })
            }
        }
        catch (err) {
            console.log(err)
            res.status(400).json({ msg: 'Login failed' })
        }
    }
    else {
        try {
            const query = 'SELECT * FROM users WHERE username = $1'
            const result = await client.query(query, [username_or_email])
            if (result.rows.length > 0) {
                const user = result.rows[0]
                const match = await bcrypt.compare(password, user.password)
                if (match) {
                    res.status(200).json({ user: user })
                }
                else {
                    res.status(401).json({ msg: 'Invalid credentials' })
                }
            }
            else {
                res.status(404).json({ msg: 'User not found' })
            }
        }
        catch (err) {
            console.log(err)
            res.status(400).json({ msg: 'Login failed' })
        }
    }
}