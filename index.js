const express = require('express');
const downloadRouter=require('./routes/download')
const app = express();

app.use('/', downloadRouter)

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
