var mysql = require("mysql");
var querystring = require("querystring");
var fs = require("fs");
var formidable = require("formidable");
var url = require("url");
var templater = require("./templater.js");
var secrets = require("./secrets.js");
var dateParser = require("./dateParser.js");
var cookieParser = require("./cookieParser.js");

var mysqlAccess = secrets.mysqlAccess;

function ups(response)
{
	response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});  
	response.write(templater.get_header(true)+'<div class="message">А туда ли ты зашёл?</div>'+templater.get_footer());
	response.end();  
}

function png(response, request) {
	var pathname = url.parse(request.url).pathname;
	fs.readFile(pathname.substring(1, pathname.length), "binary", function(err, file){		
		if(err) {
			response.writeHead(500, {"Content-Type": "text/plain"});
			response.write(err + "\n");
			response.end();
		} else {
			response.writeHead(200, {"Content-Type": "image/png"});
			response.write(file, "binary");
			response.end();
		}
	});
}

function css(response, request) {
	var pathname = url.parse(request.url).pathname;
	fs.readFile(pathname.substring(1, pathname.length), "utf8", function(err, data){
		if(err) {
			response.writeHead(500, {"Content-Type": "text/plain"});
			response.write(err + "\n");
			response.end();
		} else {		
			response.writeHead(200, {"Content-Type": "text/css; charset=utf-8"});
			response.write(data);
			response.end();
		}
	});
}

function js(response, request) {
	var pathname = url.parse(request.url).pathname;
	var fold = pathname.substring(0, 4);
	if(fold=="/js/")
	{
		fs.readFile(pathname.substring(1, pathname.length), "utf8", function(err, data){
			if(err) {
				response.writeHead(500, {"Content-Type": "text/plain"});
				response.write(err + "\n");
				response.end();
			} else {		
				response.writeHead(200, {"Content-Type": "text/css; charset=utf-8"});
				response.write(data);
				response.end();
			}
		});
	}
	else{		
		ups(response);
	}		
}

function start(response, request) {
	var connection = mysql.createConnection(mysqlAccess);

  	var postData = "";
	
	function selectAllQuestions(){
		connection.query('SELECT * FROM questions', function(err, rows, fields) {
	    	if (err) throw err;

	   		var cont = "";
	   		cont+=templater.get_header(true);
	   		if(rows.length>0)
	   		{
	   			cont+='<table class="questionTable"><tbody>'
				for (var i in rows)
				{
					cont+='<tr id="q'+rows[i].id+'"><td><div class="question"><a href="ans?q='+rows[i].id+'">'+rows[i].q_text+'</a></div></td>'+
					'<td class="delButton"><input value="Удалить" onclick="delQuestion('+rows[i].id+');" type="image" src="img/cross.png"/></td></tr>';
					//'<td><div class="delButton"><a href="/delQuestion?q='+rows[i].id+'">Удалить</a></div></td></tr>';
				}
			}
			else
			{
				cont+='<div class="message">Вопросов нет. Пожалуйста, загрузите вопросы.</div>';
			}
			connection.end();

			cont+='</tbody></table>'+templater.get_footer();      	

			response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});  
	      	response.write(cont);
	      	response.end();    
	    });
	}
  	
  	request.addListener("data", function(postDataChunk) {
    		postData += postDataChunk;
  	});

  	request.addListener("end", function() {    	    
		var question = querystring.parse(postData).text;
		connection.connect;
	    if(question!=null&&question!="")
	    {
			connection.query('INSERT INTO questions SET ?', {q_text: question}, function(err, result) {
	  			selectAllQuestions();	 
			});		
	    }
	    else
	    	selectAllQuestions();
  	});
}

function upload(response, request) {
	var connection = mysql.createConnection(mysqlAccess);

	var form = new formidable.IncomingForm();
	var cont = templater.get_header(true);

  	form.parse(request, function(error, fields, files) {
		/* Возможна ошибка в Windows: попытка переименования уже существующего файла */
		fs.rename(files.upload.path, "tmp/test.txt", function(err) {
		  	if (err) {
				fs.unlink("tmp/test.txt");
				fs.rename(files.upload.path, "tmp/test.txt");
			}

			fs.readFile("tmp/test.txt", "utf8", function(err, data){		  		
				connection.connect;				
				var lines = data.split('\n');
				function insertQuestions(lines, index)
				{
					connection.query('INSERT INTO questions SET ?', {q_text: lines[index]}, function(err, result) {
							if(lines.length-1>index)
							{
								index++;
								insertQuestions(lines, index);
							}
							else
							{
								connection.end();
							}
					});
				}
				insertQuestions(lines, 0);
				cont+="Файл принят! :)"+
		  		templater.get_footer();

				response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
				response.write(cont);
				response.end();
			});
		});			
	});
}

function commit(response, request) {
	var connection = mysql.createConnection(mysqlAccess);  
  	var postData = "";
  	var question = "";
  	var _get = url.parse(request.url, true).query;

	request.setEncoding("utf8");

  	request.addListener("data", function(postDataChunk) {
    	postData += postDataChunk;
  	});

	request.addListener("end", function() {	
		connection.connect;
		var answer = querystring.parse(postData).text;
		var cont = templater.get_header(true)+
		'<div class="message">Ответ принят</div>'+
		templater.get_footer();
	    if(answer!=null&&answer!="")
	    {	
	    	var post  = {q_id: _get["q"], a_text: answer};
	    	connection.query('SELECT * FROM questions, answers WHERE questions.id=answers.q_id AND ?',{q_id: _get["q"]} , function(err, rows, fields) {
		    	if(rows.length>0)
		    	{
		    		var query = connection.query('UPDATE answers SET ? WHERE q_id='+parseInt(_get["q"], 10), post, function(err, result) {
						connection.end();
					});	
		    	}
		    	else
		    	{
					var query = connection.query('INSERT INTO answers SET ?', post, function(err, result) {
						connection.end();
					});	
		    	}		    	
		    });      	
	      		
	    }
		response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
		response.write(cont);
		response.end();
	});
	
}

function ans(response, request) {
	var _get = url.parse(request.url, true).query;
	
	if(_get['q']!=null)
	{
		var connection = mysql.createConnection(mysqlAccess);

		connection.query("SELECT * FROM questions WHERE ?", {id: _get['q']}, function(err, rows, fields){
			if(rows.length>0)
			{
				var cont = templater.get_header(true)
				+rows[0].q_text+'<br>';
				connection.query("SELECT * FROM answers WHERE ?", {q_id: _get['q']}, function(err, rows, fields){
					if(rows.length>0)
					{
						cont+=templater.get_textForm('/commit?q='+_get['q'], rows[0].a_text, "Отправить");
					}
					else
					{
						cont+=templater.get_textForm('/commit?q='+_get['q'], "", "Отправить");
					}
				  	connection.end();
					cont+=templater.get_footer();
					response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
					response.write(cont);
				  	response.end();
				});
		  	}
		  	else
			{
				ups(response);		
			  	connection.end();
			}
		});	
	}
	else
	{
		ups(response);
	}
}

function result(response, request) {
	var connection = mysql.createConnection(mysqlAccess);

	connection.query('SELECT * FROM questions, answers WHERE questions.id=answers.q_id', function(err, rows, fields) {
    	if (err) throw err;

   		var cont = templater.get_header(true);
		for (var i in rows)
		{
			cont+=rows[i].q_text+"<br><textarea>"+rows[i].a_text+"</textarea><br>";
		}
		connection.end();
		cont+=templater.get_footer();
		response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});  
      	response.write(cont);  	
      	response.end();    
    });  	
}

function addQuestion(response, request) {
	var cont = templater.get_header(true)+
	templater.get_textForm("/start", "", "Добавить")+
	templater.get_footer();
	response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});  
  	response.write(cont);  	
  	response.end();   
}

function delQuestion(response, request) {
	var _get = url.parse(request.url, true).query;
	if(_get['q']!=null)
	{
		var connection = mysql.createConnection(mysqlAccess);
		connection.query("DELETE FROM questions WHERE ?", {id: _get['q']}, function(err, rows, fields){
			var cont = "Что-то было удалено";
			response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
			response.write(cont);
		  	response.end();
		});
	}
	else
	{
		response.writeHead(200, {"Content-Type": "text/plain; charset=utf-8"});
		response.write("Недостаточно параметров");
		response.end();
	} 
}

function uploadQuestions(response, request) {
	var cont = templater.get_header(true)+
	templater.get_loadForm("/upload")+
	templater.get_footer();
	response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});  
  	response.write(cont);  	
  	response.end();   
}

function login(response, request) {
	var cont = templater.get_header(false)+
	templater.get_loginForm("/checkPass")+
	templater.get_footer();
	response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});  
	response.write(cont);
	response.end();
}

function checkPass(response, request) {	
	var connection = mysql.createConnection(mysqlAccess);
  	var postData = "";

	request.addListener("data", function(postDataChunk) {
    		postData += postDataChunk;
  	});

  	request.addListener("end", function() {    	    
		var login = querystring.parse(postData).login;
		var pass = querystring.parse(postData).pass;
		if(login!=null&&pass!=null&&login!=""&&pass!="")
		{
			connection.connect;
			connection.query('SELECT * FROM users WHERE ?', {login: login}, function(err, rows, fields) {
				if(rows.length>0)
				{
					if(rows[0].pass == pass)
					{
						var max = 10000000;
						var min = 1;
						var random = Math.floor(Math.random() * (max - min + 1)) + min;
						connection.query('INSERT INTO sessions SET ?', {id: random, user_id: rows[0].id, date: dateParser.getMySQLDate(new Date())}, function(err, rows, fields){
							connection.end();
							console.log("Created session: " + random);
							response.writeHead(200, {"Content-Type": "text/html; charset=utf-8", "Set-Cookie": "id="+random+"; path=/;"});  
							response.write("ОК");
							response.end();
						})						
					}
					else
					{
						connection.end();
						response.writeHead(200, {"Content-Type": "text/plain; charset=utf-8"});
						response.write("Неверный пароль");
						response.end();
					}
				}
				else
				{
					connection.end();
					response.writeHead(200, {"Content-Type": "text/plain; charset=utf-8"});
					response.write("Неверный логин");
					response.end();
				}
			});
		}
		else
		{
			response.writeHead(200, {"Content-Type": "text/plain; charset=utf-8"});
			response.write("Недостаточно параметров");
			response.end();
		}
	});
}

function signUp(response, request) {
	var connection = mysql.createConnection(mysqlAccess);
  	var postData = "";

	request.addListener("data", function(postDataChunk) {
    		postData += postDataChunk;
  	});

  	request.addListener("end", function() {    	    
		var login = querystring.parse(postData).login;
		var pass = querystring.parse(postData).pass;
		if(login!=null&&pass!=null&&login!=""&&pass!="")
		{
			connection.connect;
			connection.query('SELECT * FROM users WHERE ?', {login: login}, function(err, rows, fields) {
				if(rows.length==0)
				{
					var max = 10000000;
					var min = 1;
					var random = Math.floor(Math.random() * (max - min + 1)) + min;
					connection.query('INSERT INTO users SET ?', {login: login, pass: pass}, function(err, rows, fields){
						connection.query('INSERT INTO sessions SET ?', {id: random, user_id: rows.insertId, date: dateParser.getMySQLDate(new Date())}, function(err, rows, fields){
							connection.end();
							response.writeHead(200, {"Content-Type": "text/html; charset=utf-8", "Set-Cookie": "id="+random+"; path=/;"});  
							response.write("ОК");
							response.end();
						})
					});					
				}
				else
				{
					connection.end();
					response.writeHead(200, {"Content-Type": "text/plain; charset=utf-8"});
					response.write("Логин уже занят");
					response.end();
				}
			});
		}
		else
		{
			response.writeHead(200, {"Content-Type": "text/plain; charset=utf-8"});
			response.write("Недостаточно параметров");
			response.end();
		}
	});
}

function exit(response, request)
{
	var connection = mysql.createConnection(mysqlAccess);
	var cont = templater.get_header(false, '<meta http-equiv="refresh" content="2; url=/">');
	cookies=cookieParser.getCookies(request);
	if(cookies["id"]!=null){
		connection.connect;
		connection.query('DELETE FROM sessions WHERE ?', {id: cookies["id"]}, function(err, rows, fields){
			connection.end();
			console.log("Logout: "+cookies["id"]);
			cont+='<div class="message">Выход выполнен успешно</div>'+
			templater.get_footer();
			response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
			response.write(cont);
			response.end();
		});
	}
	else{
		cont+='<div class="message">Вы уже вышли</div>'+
		templater.get_footer();
		response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
		response.write(cont);
		response.end();
	}
}


exports.png = png;
exports.css = css;
exports.js = js;
exports.start = start;
exports.upload = upload;
exports.commit = commit;
exports.ans = ans;
exports.result = result;
exports.addQuestion = addQuestion;
exports.delQuestion = delQuestion;
exports.uploadQuestions = uploadQuestions;
exports.login = login;
exports.checkPass = checkPass;
exports.signUp = signUp;
exports.exit = exit;