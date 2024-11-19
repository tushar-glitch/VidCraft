const AWS = require('aws-sdk');
const fs = require('fs')
const path = require('path')
const { promisify, formatWithOptions } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const client = require('./db/conn')
const axios = require('axios')
require('dotenv').config()

client.connect(function (err) {
    if (err) throw err;
    client.query("", [], function (err, result) {
        if (err) throw err;

        console.log(result.rows[0]);
        //   client.end(function (err) {
        //     if (err) throw err;
        //   });
    });
});

const service = {
    1: 'compressor',
    2: 'resizer'
}


const sqs = new AWS.SQS({
    accessKeyId: process.env.AWS_ACCESS_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY
});

const queueUrl = process.env.SQS_QUEUE_URL;

const params = {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 1,
    VisibilityTimeout: 20,
    WaitTimeSeconds: 3
};

const get_service = async (key) => {
    const query = 'SELECT * FROM video where file_key_name = $1';
    try {
        const result = await new Promise((resolve, reject) => {
            client.query(query, [key], (err, result) => {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });

        if (result && result.rows[0]) {
            const service_number = result.rows[0].service;
            if (service_number) {
                const data = service[parseInt(service_number)];
                return data;
            }
        }
    } catch (err) {
        console.log(err);
    }
    return 'no_service_found'; // Default return value if no service found or error occurs
}

const processMessage = async (message) => {
    console.log('Processing started!')
    if (message && message.Body) {
        const body = JSON.parse(message.Body);

        const { bucket, key, videoId } = body;

        try {
            var forward_to_service = '';
            forward_to_service = await get_service(key)

            // call service here
            if (forward_to_service == 'compressor') {
                // await axios.post(`${process.env.backend_endpoint_compressor}${forward_to_service}`, { bucket, key });
                await axios.post(`${process.env.backend_endpoint_compressor}api/v1/compressor`, { bucket, key }) //for docker
            }
            else if (forward_to_service == 'resizer') {
                // await axios.post(`${process.env.backend_endpoint_transcoder}${forward_to_service}`, { bucket, key, })
                await axios.post(`${process.env.backend_endpoint_transcoder}api/v1/resizer`, {bucket, key}) //for docker
            }
            else {
                console.log('Kya kar raha bhai!!');
            }
            // After processing, delete the message from the queue
            const deleteParams = {
                QueueUrl: queueUrl,
                ReceiptHandle: message.ReceiptHandle
            };

            sqs.deleteMessage(deleteParams, (err, data) => {
                if (err) {
                    console.error('Error deleting message from SQS', err);
                } else {
                    console.log('Message deleted', data);
                }
            });

        } catch (error) {
            console.error('Error downloading video from S3', error);
        }
        finally {
            // After processing, delete the message from the queue
            const deleteParams = {
                QueueUrl: queueUrl,
                ReceiptHandle: message.ReceiptHandle
            };

            sqs.deleteMessage(deleteParams, (err, data) => {
                if (err) {
                    console.error('Error deleting message from SQS', err);
                } else {
                    console.log('Message deleted', data);
                }
            });
        }
    }
};

const pollQueue = () => {
    sqs.receiveMessage(params, (err, data) => {
        if (err) {
            console.error('Error receiving message from SQS', err);
        } else if (data.Messages[0]) {
            processMessage(data.Messages[0]);
        } else {
            console.log('No messages to process');
        }
    });
};

// Poll the queue at regular intervals
setInterval(pollQueue, 10000); 

const PORT = process.env.PORT || 5500;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Polling worker is running.\n');
});

server.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
});