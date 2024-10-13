const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  try {
    const {token} = req.cookies
    const verifyToken = jwt.verify(token, process.env.JWT_SECRET);
    if (!verifyToken) {
      return res.status(401).send("Token error");
    }
    req.id = verifyToken.id;
    next();
  } catch (error) {
    console.log(error);
    return error;
  }
};

module.exports = auth;
