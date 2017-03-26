var PORT = process.env.PORT || 8080
var PROTOCOL = process.env.PROTOCOL || 'http'
var HOSTNAME = process.env.HOSTNAME || 'localhost:8080'

var express = require('express')
var app = express()

app.use(express.static('public'))

app.get('/spotify/genres', function (request, response) {
  res.send('Hello World!')
})

app.listen(PORT, function () {
  console.log('server running')
})
