const jwt = require("jsonwebtoken");
const client = require('../db/conn')
const auth = (req, res, next) => {
  try {
    //First check api token before checking for any cookie

    const api_token = req.headers['x-vidcraft-token']
    if (api_token) {
      // Premium user
      
      client.query('select number_of_req, membership_type from users where api_token = $1', [api_token], async (error, result) => {
        if (error) {
          console.log(error);
          res.status(400).json({ msg: "Failed to upload video!" })
        }
        else {
          if (!result.rows.length) {
            return res.status(401).send("Api token wrong or expired!");
          }
          const { number_of_req, membership_type } = result.rows[0];
          if (number_of_req <= 0) {
            return res.status(401).send("You have exhausted your plan!");
          }
          client.query('update users set number_of_req = $1 where api_token = $2', [number_of_req-1, api_token], async (error, result) => {
            if (error) {
              console.log(error);
              res.status(400).json({ msg: "Failed to upload video!" })
            }
            else {
              const max_video_size = membership_type
              req.max_video_size = max_video_size
              next();
              return;
            }
          })
        }
      })
    } else {
      //Now no api token present so check for json token

      // const { token } = req.cookies
      // if (token) {
        // const verifyToken = jwt.verify(token, process.env.JWT_SECRET);
        // if (!verifyToken) {
        //   return res.status(401).send("Token error");
        // }
        // req.id = verifyToken.id;
        
      //Later remove this line
      req.id = 2;
        req.max_video_size = 100/1024
      // }
      if(!req.max_video_size) req.max_video_size = 50/1024
      next();
      return;
    }
  }
  catch (error) {
    console.log(error);
    return error;
  }
};

module.exports = auth;
