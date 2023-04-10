const express = require('express')
const router = express.Router()
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require("child_process")
const contentDisposition = require('content-disposition');

router.get('/', (req, res) => {
    res.send(`
    <form action="/download" method="get">
  <label>URL:</label>
  <input type="text" name="url" required>
  <label>Type:</label>
  <label><input type="radio" name="type" value="video" checked> Video</label>
  <label><input type="radio" name="type" value="audio"> Audio</label>
  <br>
  <label>Quality:</label>
  <select name="quality">
    <option value="highest">Highest</option>
    <optgroup label="Video">
      <option value="1080p">1080p</option>
      <option value="720p">720p</option>
      <option value="480p">480p</option>
      <option value="360p">360p</option>
      <option value="240p">240p</option>
      <option value="144p">144p</option>
    </optgroup>
    <optgroup label="Audio">
      <option value="highestaudio">Highest</option>
      <option value="256k">256k</option>
      <option value="128k">128k</option>
    </optgroup>
  </select>
  <button type="submit">Download</button>
</form>
  `);
})

router.get('/download', async (req, res) => {
    try {
        const { quality, type, url } = req.query
        const info = await ytdl.getInfo(url);
        const name = info.videoDetails.title
        const duration = info.videoDetails.lengthSeconds
        if (type === 'video') {
            const filterFormats = info.formats.filter(f => f.qualityLabel === quality)
            if (filterFormats.length > 0) {
                const itag = filterFormats[0].itag
                console.log(itag)
                const audio = ytdl.downloadFromInfo(info, { quality: [141, 140, 139] });
                const video = ytdl.downloadFromInfo(info, { quality: [itag] });
                const proc = spawn(ffmpeg,
                    [
                        '-loglevel', '8',
                        '-i', 'pipe:3',
                        '-i', 'pipe:4',
                        '-map', '0:a',
                        '-map', '1:v',
                        '-c', 'copy',
                        '-movflags', 'frag_keyframe+empty_moov',
                        '-metadata', `duration=${duration}`,
                        '-f', 'mp4',
                        'pipe:5'],
                    {
                        stdio: [
                            'inherit', 'inherit',
                            'inherit', 'pipe',
                            'pipe', 'pipe']
                    }); // convert to mp4
                audio.pipe(proc.stdio[3]);
                video.pipe(proc.stdio[4]);
                res.setHeader('Content-Disposition', contentDisposition(`${name}.mp4`, { type: 'attachment' }));
                res.header('Content-Type', 'video/mp4')
                res.header('Content-Duration', duration.toString())
                proc.stdio[5].pipe(res);
            } else {
                res.status(401).send(`Không có chất lượng ${quality} cho video này!!!`)
            }
        }
        if (type === 'audio') {
            let audioQuality = 'AUDIO_QUALITY_MEDIUM'
            switch (quality) {
                case '256k':
                    audioQuality = 'AUDIO_QUALITY_MEDIUM'
                    break;
                case '128k':
                    audioQuality = 'AUDIO_QUALITY_LOW'
                    break;
                default:
                    audioQuality = 'AUDIO_QUALITY_MEDIUM'
                    break;
            }
            const filterFormats = info.formats.filter(f => f.audioQuality === audioQuality)
            if (filterFormats.length > 0) {
                const itags = filterFormats.map(format => format.itag)
                const audio = ytdl.downloadFromInfo(info, { quality: itags });
                const proc = spawn(
                    ffmpeg,
                    [
                        '-loglevel', '8',
                        '-i', 'pipe:3',
                        '-f', 'mp3',
                        'pipe:4'],
                    { stdio: ['inherit', 'inherit', 'inherit', 'pipe', 'pipe'] });
                audio.pipe(proc.stdio[3]);
                res.setHeader('Content-Disposition', contentDisposition(`${name}.mp3`, { type: 'attachment' }));
                res.header('Content-Type', 'audio/mp3')
                res.header('Content-Duration', duration.toString())
                proc.stdio[4].pipe(res);
            } else {
                res.status(401).send(`Không có chất lượng ${quality} cho audio này!!!`)
            }
        }

    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error")
    }
})

module.exports = router