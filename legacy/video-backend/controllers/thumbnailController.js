// [AWS DISABLED] AWS (S3/SQS) is no longer used in VidCraft. Lines prefixed with "// [AWS] " are kept only for reference.
const mime = require('mime-types')
const fs = require('fs')
// [AWS] const AWS = require('aws-sdk')
const client = require('../db/conn')

// [AWS] const s3 = new AWS.S3({
// [AWS]     accessKeyId: process.env.AWS_ACCESS_ID,
// [AWS]     secretAccessKey: process.env.AWS_SECRET_KEY
// [AWS] })


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
    
// [AWS]     s3.upload(params, (err, data) => {
// [AWS]         if (err) console.log(err);
// [AWS]         else {
// [AWS]             const urlParams = {
// [AWS]                 Bucket: process.env.AWS_BUCKET_NAME,
// [AWS]                 Key: 'sample_image',    
// [AWS]                 // Expires: 60 * 60, // 1 hour
// [AWS]                 ResponseContentType: fileMime
// [AWS]             };
// [AWS]             s3.getSignedUrl('getObject', urlParams, (err, url) => {
// [AWS]                 if (err) console.log(err);
// [AWS]                 else {
// [AWS]                     //Now save the meta data in PostgreSql
// [AWS]                     const query = 'INSERT INTO thumbnails (url, posted_by) VALUES ($1, $2) RETURNING *'
// [AWS]                     client.query(query, [url, req.user], (err, result) => {
// [AWS]                         if (err) {
// [AWS]                             console.log(err)
// [AWS]                             res.status(400).json({ msg: "Failed to upload image!" })
// [AWS]                         }
// [AWS]                         else {
// [AWS]                             res.status(200).json({ msg: "File uploaded successfully!", url: url })
// [AWS]                         }
// [AWS]                     })
// [AWS]                 }
// [AWS]             })
// [AWS]             console.log("Image uploaded successfully!");
// [AWS]             fs.unlink(filePath, (err) => {
// [AWS]                 if(err) console.log(err);
// [AWS]             })
// [AWS]         }
// [AWS]     })
}
