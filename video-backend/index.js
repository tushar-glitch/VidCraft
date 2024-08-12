const express = require('express')
require('dotenv').config()
const app = express()
app.use(express.json())
const fs = require('fs')
const client = require('./db/conn')
const videoRouter = require('./routes/videoRouter')
const authRouter = require('./routes/authRouter')
const thumbnailRouter = require('./routes/thumbnailRouter')
const cookieParser = require('cookie-parser');
const cors = require('cors')

app.use(cookieParser());
app.use(cors())


client.connect(function (err) {
  if (err) throw err;
  client.query("select * from video", [], function (err, result) {
    if (err) throw err;

    console.log(result.rows[0]);
    //   client.end(function (err) {
    //     if (err) throw err;
    //   });
  });
});


app.use('/api/v1/video', videoRouter)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/thumbnail', thumbnailRouter)


// Check status of the video
app.get('/api/v1/status', async (req, res) => {
  const { video_id } = req.query
  if (video_id) {
    const result = await client.query('SELECT * FROM video WHERE file_key_name = $1', [video_id])
    if (result.rows.length === 0) {
      return res.status(204).json({ message: 'Video not found!' })
    }
    else {
      const { status } = result.rows[0]
      if (status != 3) {
        return res.status(200).json({ status })
      }
      else {
        const { url, output_video_size, output_video_unit } = result.rows[0]
        return res.status(200).json({ status, url, size: output_video_size, unit: output_video_unit})
      }
    }
  }
  else {
    return res.status(400).json({ message: 'Invalid request!' })
  }
})

// Change status of the video
app.post('/api/v1/changestatus', async (req, res) => {
  const { video_id, status } = req.body
  if (video_id && status) {
    await client.query('UPDATE video SET status = $1 WHERE file_key_name = $2', [status, video_id])
    return res.status(200).json({ message: 'Status updated successfully!' })
  }
  else {
    return res.status(400).json({ message: 'Invalid request!' })
  }
})


app.listen(4000)



// Services -
// 1 -> Compress Video
// 2 -> Resize video
