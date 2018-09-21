let http = require("http");
let express = require("express");
let path = require("path");
let queue = require("express-queue");

let log = require("./utils/logger.js");
let config = require('./configuration/config.json');

let favicon = require('serve-favicon');
let logger = require('morgan');
let methodOverride = require('method-override');
let session = require('express-session');
let bodyParser = require('body-parser');
let errorHandler = require('errorhandler');
let socketio = require('socket.io');
let cors = require('cors');

let channel = require("./routes/channel");
let bcClient = require("./blockchain/bcClient");

let app = express();

// all environments
app.set('port', process.env['PORT'] || config['clientPort']);
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'ejs');
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
//app.use(logger('dev'));

app.use(methodOverride());
app.use(session({
    resave: true,
    saveUninitialized: true,
    secret: 'ktblockchain'
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(queue({activeLimit: 15}));

// error handling middleware should be loaded after the loading the routes
if ('development' === app.get('env')) {
    app.use(errorHandler());
}

app.get('/', channel.openPage);
app.post('/channel/queryChannelInfo', channel.queryChannelInfo);
app.get('/getChannelPeers', channel.getChannelPeers);
app.post('/channel/createChannel', channel.createChannel);
app.post('/channel/joinChannel', channel.joinChannel);

let server = app.listen(app.get('port'), function () {
    log.info('Express server listening on port ' + server.address().port);
});

var io = socketio.listen(server);
let socket = require("./utils/socket.js");
socket.setIo(io);

if (config['startChannelNetwork']) {
    bcClient.channelSetUp(path.join('configuration', config['startChannelNetwork']))
        .then((peerOrgIdList) => {
            log.info("Peer OrgId List : " + peerOrgIdList);
        })
        .catch((err) => {
            log.error(err.stack ? err.stack : err);
        })
}
