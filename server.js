var http = require("http");
var url = require("url");

function start(route, handle){

	function onRequest(request, response){
		var postData = "";
		var pathname = url.parse(request.url).pathname;
      	route(handle, pathname, response, request);    	
	}
	
	http.createServer(onRequest).listen(80);
}

exports.start = start;