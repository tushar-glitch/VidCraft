const mime = require('mime-types')
const fs = require('fs')
const AWS = require('aws-sdk')
const client = require('../db/conn')

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY
})


exports.upload_thumbnail = async (req, res) => {
    console.log("Image uploading started...");
    const filePath = `uploads/${req.file.filename}`;
    const fileMime = mime.lookup(req.file.originalname) || 'application/octet-stream';
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: 'sample_image',
        // ACL: 'public-read',
        Body: fs.createReadStream(filePath),
        ContentType: fileMime
    }
    
    s3.upload(params, (err, data) => {
        if (err) console.log(err);
        else {
            const urlParams = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: 'sample_image',    
                // Expires: 60 * 60, // 1 hour
                ResponseContentType: fileMime
            };
            s3.getSignedUrl('getObject', urlParams, (err, url) => {
                if (err) console.log(err);
                else {
                    //Now save the meta data in PostgreSql
                    const query = 'INSERT INTO thumbnails (url, posted_by) VALUES ($1, $2) RETURNING *'
                    client.query(query, [url, req.user], (err, result) => {
                        if (err) {
                            console.log(err)
                            res.status(400).json({ msg: "Failed to upload image!" })
                        }
                        else {
                            res.status(200).json({ msg: "File uploaded successfully!", url: url })
                        }
                    })
                }
            })
            console.log("Image uploaded successfully!");
            fs.unlink(filePath, (err) => {
                if(err) console.log(err);
            })
        }
    })
}
