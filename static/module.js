/*
 * 注意：
 * 当前只支持js模块化，css和html的模块化功能将不会加上
 * 优先判断第三方cdn地址，如果load失败将依次判断直至src地址，都失败将抛出异常
 * 目前只兼容到ie8。
 * 目前引用的第三方模块，如果出现没有名称的状况，会在moduleMissingName数组中存储。load完后从数组第一项来取。未知情况下，可能发生错乱。没有严格意义上的对号入座。
 * *require函数将匹配第一个参数name，是否首字母是!，如果是!，将缓存require，后面其他方式调用的时候，直接引用，避免重置变量
 * 
 * 
 * 问题：
 * 6.兼容了AMD规范，没有严格遵守规范,妥协了使用性，设计成的类似commonJS规范，。
 * 
 * */


(function(){
	var storages = {
		moduleLoad : {},//已经加载的模块
		moduleMissingName : [],//给未加载依赖，添加依赖名称（用来判断define没有模块名字id）
		requireData : {},//返回的函数，多个引用使用同一个require
		monitorQuote : {},//监听需要等待加载完的模块,监听依赖
		moduleEntrust : [],//委托，如果json还未加载，先放入委托
		moduleStartUp : {},//自启动的模块，初始化构建完所有模块，将自动引用执行
		moduleJson : {}//模块的库
	},state = {
		isModuleJson : false
	},lang = {
		"loadError" : "异常：无法加载'{{name}}'模块，路径错误。",
		"loadAbnormal" : "异常：当前模块库无'{{name}}'模块,输入module.getModuleList()可以查询当前load的所有模块"
	};
	
	
	var toolLibrary = {//工具集合
		getDom : function(name){//查找dom，查找的是个集合
			return document.getElementsByTagName(name);
		},
		isType : function(data,type){//判断类型
			var typeName = ['Boolean','Number','String','Function','Array','Date','RegExp','Object','Error','Symbol'],
				typeObj = {};
			
			for(var i=0,len=typeName.length;i<len;i++){
				typeObj["[object "+typeName[i]+"]"] = typeName[i].toLowerCase();
			}
			if ( data == null ) {
				return type ? ((data+"")===type) : data+"" ;
			}
			
			return typeof data === "object" || typeof data === "function" ?
			(type?typeObj[ typeObj.toString.call( data )] === type.toLowerCase():typeObj[ typeObj.toString.call( data ) ] || "object"):
			(type?typeof data===type.toLowerCase():typeof data);
		},
		scriptUrl : function(type,name){
			var num = 0;
			if(storages.moduleJson[name].cdn && storages.moduleJson[name].cdn.length > 0){
				if(~~storages.moduleJson[name].cdnNum <= storages.moduleJson[name].cdn.length-1){
					num = ~~storages.moduleJson[name].cdnNum;
					if(type==="set"){
						storages.moduleJson[name].cdnNum = ~~storages.moduleJson[name].cdnNum+1;
					}
					return storages.moduleJson[name].cdn[num];
				}else{
					return storages.moduleJson[name].src;
				}
			}else{
				return storages.moduleJson[name].src;
			}
		},
		isUrlName : function(name){
			var isDepot = /(\/)*\.js(\?)?/.test(name.replace(/^\s*|\s*$/mg,""));
			return isDepot;//true是url
		},
		urlToName : function(name){
			var srcCache = [];
			if(this.isUrlName(name)){
				srcCache = name.split(".js")[0].split("/");
				return srcCache[srcCache.length-1];
			}else{
				return name;
			}
		},
		getModuleData : function(moduleStore){//获取指定的模块数组
			var list = [];
			for(var key in moduleStore){
				list.push(key);
			}
			return list;
		}
	};
	
	var logicMain = {//主逻辑
		excludeLoad : function(name,src){//添加依赖js，并去重
			var snapList = toolLibrary.getDom("script");
			
			if(!toolLibrary.isType(name,"string")){
				return false;
			}
			if(name.replace(/^\s*|\s*$/mg,"").length===0){
				return false;	
			}
			
			if(!storages.moduleJson[name] && !src){
				console.error(lang.loadAbnormal.replace(/\{\{name\}\}/mg,name));
				return false;
			}
			
			if(!src && storages.moduleJson[name]){//获取合理的src
				src = toolLibrary.scriptUrl("get",name);
			}
			
			for(var i=0,len=snapList.length;i<len;i++){//去重，已经加载过
				if(snapList[i].src === src){
					return true;
				}
			}
			
			this.addScriptDom(name,src);
			return true;			
		},
		addScriptDom : function(name,src){//添加script标签
			var script = document.createElement("script"),
				pointer = this;
			
			script.src=src;
			script.type="text/javascript";
			script.charset="UTF-8";
			script.async="true";
			toolLibrary.getDom("head")[0].appendChild(script);
			
			if(~navigator.userAgent.indexOf("MSIE")){
				script.onreadystatechange = function(event){
					if(this.readyState=="loaded"){
						if(storages.moduleLoad[name] || storages.moduleMissingName.length){
							successLoad();
						}else{
							errorLoad();
						}
					}
				}
			}else{
				script.onload = function(){
					successLoad();
				}
				script.onerror = function(){
					errorLoad();
				}
			}
			function successLoad(){
				var itemModule = {};
				
				//判断没有load进入已加载模块列表的模块，手动添加进去
				if(!storages.moduleLoad[name] && storages.moduleMissingName.length){
					itemModule = storages.moduleMissingName.splice(0,1);
					itemModule[0].moduleName = name;
					
					if(!state.isModuleJson){//委托
						pointer.addJsonEntrust(itemModule[0]);
					}else{
						pointer.createModule(itemModule[0]);
					}
				}
				
				pointer.monitorLoad(name);
				script.onload = script.onreadystatechange = script.onerror = null;
			}
			function errorLoad(){
				toolLibrary.scriptUrl("set",name);
				
				//清理多余数据和节点
				script.onload = script.onreadystatechange = script.onerror = null;
				script.parentNode.removeChild(script);
				if(src !== storages.moduleJson[name].src){
					pointer.excludeLoad(name);
				}else{
					console.error(lang.loadError.replace(/\{\{name\}\}/mg,name));
				}
			}
		},
		addJsonEntrust : function(opt){//JSON库未加载的委托，加载完库后才知道其他引用地址
			storages.moduleEntrust.push(opt);
		},
		cleanJsonEntrust : function(){//清理委托，创建模块
			for(var i=0,len=storages.moduleEntrust.length;i<len;i++){
				this.createModule(storages.moduleEntrust[i]);
			}
			storages.moduleEntrust = [];
		},
		createModule : function(opt){//创建模块,加载依赖
			var src = "",
				srcCache = [];
			
			for(var i=0,len=opt.quote.length;i<len;i++){//加载依赖
				if(builtIn.inquireItem(opt.quote[i])){//加载模块判断是否是内部模块
					continue;
				}
				if(toolLibrary.isUrlName(opt.quote[i])){
					src = opt.quote[i];
					srcCache = src.split(".js")[0].split("/");
					this.excludeLoad(srcCache[srcCache.length-1],src);
				}else{
					this.excludeLoad(opt.quote[i]);
				}
			}
			
			this.registeredList(opt);//注册本身的模块
			this.monitorRely(opt.moduleName,opt.quote);
			if(opt.isDefaultStart){//订阅所有异步加载完成，在自调用本身模块
				storages.moduleStartUp[opt.moduleName] = true;
			}
		},
		registeredList : function(opt){//注册模块
			var isExist = storages.moduleLoad[opt.moduleName]?true:false;
			storages.moduleLoad[opt.moduleName] = {
				"defaultFun" : opt.fun,
				"rely" : opt.quote,
				"exports" : {}
			};
			return !isExist;
		},
		monitorLoad : function(name){//监听load,script发生load后判断依赖都加载完
			var relyList = [];
			
			for(var key in storages.moduleStartUp){
				if( inquireRely(key) ){
					relyList.push(key);
				}
			}
			for(var i=0,len=relyList.length;i<len;i++){//发送通知到订阅者
				if(storages.moduleStartUp[relyList[i]]){
					storages.moduleLoad[relyList[i]].defaultFun();
					delete storages.moduleStartUp[relyList[i]];
				}
			}
			
			function inquireRely(name){
				if(toolLibrary.isType(storages.monitorQuote[name],"array")){
					for(var i=0,len=storages.monitorQuote[name].length;i<len;i++){
						if(!storages.moduleLoad[storages.monitorQuote[name][i]]){//加载
							return false;
						}
						if(!inquireRely(storages.monitorQuote[name][i])){
							return false;
						}
					}
					return true;
				}
				return false;
			}
		},
		monitorRely : function(name,quote){//订阅，覆盖即可，无需判断有没有重复命名("也不考虑空")
			var list = [],
				nameQuote = "";
			if(!toolLibrary.isType(name,"string") || !toolLibrary.isType(quote,"array")){
				return false;
			}
			for(var i=0,len=quote.length;i<len;i++){
				nameQuote=toolLibrary.urlToName(quote[i]);
				list.push(nameQuote);
			}
			storages.monitorQuote[name] = list;
		}
	}
	
	var builtIn = {//内置模块
		list : ["exports"],
		init : function(){
			for(var i=0,len=builtIn.list.length;i<len;i++){
				builtIn[builtIn.list[i]](i);
			}
		},
		inquireItem : function(name){
			for(var k=0,leng=this.list.length;k<leng;k++){
				if(this.list[k]===name){
					return true;
				}
			}
			return false;
		},
		addModule : function(name,quote,fun,isDefaultStart){
			define(name,quote,fun,isDefaultStart);
		},
		exports : function(n){
			var fun = function(){
				return {};
			};
			this.addModule(this.list[n],[],fun);
		}
	};
	
	window.module = {
		getModuleQuote : function(){
			return storages.monitorQuote;
		},
		getModuleDepot : function(){//查询仓库所有模块
			return toolLibrary.getModuleData(storages.moduleJson);
		},
		getModuleList : function(){//查询所有加载模块
			return toolLibrary.getModuleData(storages.moduleLoad);
		}
		
		
	};
	window.define = function(moduleName,quote,fun,isDefaultStart){
		var opt = {};
		if(toolLibrary.isType(moduleName,"function")){
			opt.quote = [];
			opt.fun = moduleName;
			opt.isDefaultStart = !!quote;
		}
		
		if(toolLibrary.isType(moduleName,"array")){
			opt.quote = moduleName;
			opt.fun = quote;
			opt.isDefaultStart = !!fun;
		}
		
		if(toolLibrary.isType(moduleName,"string")){
			opt.moduleName = moduleName;
			if(toolLibrary.isType(quote,"array")){
				opt.quote = quote;
				opt.fun = fun;
				opt.isDefaultStart = !!isDefaultStart;
			}else{
				opt.quote = [];
				opt.fun = quote;
				opt.isDefaultStart = !!fun;
			}
		}
		
		if(opt.moduleName){//有名字id
			if(!state.isModuleJson){//委托
				logicMain.addJsonEntrust(opt);
			}else{
				logicMain.createModule(opt);
			}
		}else{
			storages.moduleMissingName.push(opt);
		}
	};
	window.define.amd = {};
	window.require = function(){
		var requireData = {},
			isCache = /^\!/.test(arguments[0]),
			name = arguments[0].replace(/^\!/,""),
			isExports = false,
			exports = {},
			requireList = [],
			argumentsList = Array.prototype.slice.call(arguments,1);
			
		if(!toolLibrary.isType(name,"string")){
			return false;
		}
		if(!storages.moduleLoad[name]){
			return false;
		}
		if(isCache && storages.requireData[name]){//有缓存就直接返回
			return storages.requireData[name];
		}
		
		for(var i=0,len=storages.monitorQuote[name].length;i<len;i++){//查询是否有引用内部模块
			if(builtIn.inquireItem(storages.monitorQuote[name][i])){
				if(storages.monitorQuote[name][i]==="exports"){
					isExports = true;
					exports = this.require(storages.monitorQuote[name][i]);
				}
				requireList.push(exports);
			}
		}
		
		for(var i=0,len=argumentsList.length;i<len;i++){//清理传递参数
			requireList.push(argumentsList[i]);
		}
		
		requireData = storages.moduleLoad[name].defaultFun.apply(null,requireList);
		storages.moduleLoad[name].exports = requireData;
		if(isCache && !storages.requireData[name]){//缓存
			storages.requireData[name] = requireData;
		}
		
		return isExports? exports : requireData;
	};
	
	(function(){
		var snapList = toolLibrary.getDom("script"),
			attr = "";
		
		builtIn.init();//初始化内部模块
		for(var i=0,len=snapList.length;i<len;i++){
			attr = snapList[i].attributes["data-module"];
			if(/module(\.min)?.js\s*$/mg.test(snapList[i].src)){
				if(attr){
					var xmlAjax = new XMLHttpRequest();
					xmlAjax.open('GET', attr.nodeValue , true);
					xmlAjax.onreadystatechange = function() {
			            if (xmlAjax.readyState == 4 && (xmlAjax.status === 200 || xmlAjax.status === 304)) {//readyState == 4说明请求已完成
			            	try{
			            		storages.moduleJson = JSON.parse(xmlAjax.responseText).library;
			            	}catch(e){
			            		storages.moduleJson = {};
			            	}
			            	state.isModuleJson = true;
			            	logicMain.cleanJsonEntrust();
			            }
			        };
					xmlAjax.send();
				}else{
					state.isModuleJson = true;
					logicMain.cleanJsonEntrust();
				}
				
				break;
			}
		}
		
	})();
})();