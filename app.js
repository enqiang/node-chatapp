
/**
 * Module dependencies.
 */
var express = require('express'),
	sio = require('socket.io'),
	fs = require('fs'),
	path = require('path')
	url = require('url'),
	parseCookie = require('connect').utils.parseCookie,
	MemoryStore = require('connect/lib/middleware/session/memory'),
	mq = require("mysql");

var mc = mq.createConnection({
    user: "root",
    password: ""
});

//session
var storeMemory = new MemoryStore({
	reapInterval:60000 * 10
});


//app settings
var app = module.export = express.createServer();	

// all environments
app.configure(function(){
	app.use(express.bodyParser());
	app.use(express.cookieParser());
	app.use(express.session({
		secret: 'wyq',
		store:storeMemory 
	}));
	app.use(express.methodOverride());
	app.use(app.router);//要放在bodyParser之后，处理post
	app.set('views', __dirname + '/views');//设置绝对路径
	app.set('view engine', 'ejs');//注册ejs模板引擎
	//app.set('view options', { layout:false }); //取消layout
	app.use(express.static(__dirname + '/public'));//定义开发环境
});


//socket.io settings
var io = sio.listen(app);
//session
io.set('authorization', function(handshakeData, callback){
	// 通过客户端的cookie字符串来获取其session数据
	handshakeData.cookie = parseCookie(handshakeData.headers.cookie)
	var connect_sid = handshakeData.cookie['connect.sid'];
	
	if (connect_sid) {
		storeMemory.get(connect_sid, function(error, session){
			if (error) {
				// if we cannot grab a session, turn down the connection
				callback(error.message, false);
			}
			else {
				// save the session data and accept the connection
				handshakeData.session = session;
				callback(null, true);
			}
		});
	}
	else {
		callback('nosession');
	}
});

//actions
app.get('/',function(req,res){
	if( req.session.name && req.session.name!==''){
		res.redirect('/chatroom');
	}else{
		var realpath = __dirname + '/views/' + url.parse('login.ejs').pathname;
		var txt = fs.readFileSync(realpath);
		res.end(txt);
	}
});
app.get('/chatroom',function(req,res){
	if (req.session.name && req.session.name !== '') {
		res.render('chatroom',{name:req.session.name});
	}else{
		res.redirect('/');
	}
});
app.get('/chatroom/:getmessage',function(req,res){
	//insert data into database. the table name is nodechat.
	var username = req.session.name;
	var usercontent = req.params.getmessage;
	
	
	mc.query("use nodechat");
	mc.query("INSERT INTO user_chat (user,content) VALUES ('"+username+"','"+usercontent+"')");
	
	
	res.send('get message is :' + req.params.getmessage);
});
app.post('/chatroom',function(req,res){
	var name = req.body.nick;
	//var postmessage = req.msg;
	
	if(name && name!==''){
		req.session.name = name;//设置session
		/*req.on('end',function(data){
			postmessage = data.msg;
		});*/
		res.render('chatroom',{name:name});
		//res.send(name);
	}
	//else if(postmessage && postmessage!==''){
		//insert into database.
	//}
	else{
		res.end('name is null!');
	}
});

//socket listen connection
io.sockets.on('connection', function (socket){
	var session = socket.handshake.session;//session
	var name = session.name;
	mc.connect();
	
	socket.broadcast.emit('system message', '【'+ name + '】上线了…');
	
	socket.on('public message',function(msg, fn){
		socket.broadcast.emit('public message', name, msg);
		fn(true);
	});
	
	//disconnect
	socket.on('disconnect', function(){
		session = null;
		mc.end();
		socket.broadcast.emit('system message', '【'+ name + '】下线了…');
	});
});

app.listen(3000, function(){
	var addr = app.address();
	console.log('app listening on http://127.0.0.1：' + addr.port);
});

