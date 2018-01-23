define( "a", ["static/b.js"], function() {
	var obj = {"text":"测试文件"};
	var BData = require("b",obj);
	
	console.info(obj);
	console.info(BData);
	
		
	return {};
},true);
