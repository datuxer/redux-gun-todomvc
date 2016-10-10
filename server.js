var port = process.argv[2] || process.env.PORT || 8080;

var express = require('express');
var app = express();

var join = require('path').join;

var Gun = require('gun');

var gun = Gun();

gun.wsp(app);

// var www = join(__dirname, 'www');
// app.use(express.static(www));

app.listen(port, function () {
	console.log('Server started on port', port, 'with /gun');
});

