define( ["../helper","../more/tidy","$ejs"], function(helper,tidy){
    function getFile(url, mime){//可以是字符串或flow对象
        try{
            mime = typeof mime == "string" ? mime : mime.mime
            var encoding  = /(^text|json$)/.test( mime )  ? "utf8" : "binary"
            var temp = $.readFileSync( url,encoding );
            return $.pagesCache[ url ] =  temp
        }catch(e){ }
    }
    return function(flow){
        flow.bind("respond_to", function( format, opts ){
            var url, res = flow.res, rext = /\.(\w+)$/, cache, data;
            //如果没有指定，或第二个参数指定了location
            if( !opts  || typeof opts.location == "string" ){
                if( !opts ){ //如果是静态资源
                    url = $.path.join("app/public/",flow.pathname);
                }else {     //如果是从路由系统那里来的
                    url = $.path.join($.core.base, "app/views", opts.location + "."+ format);
                }
                opts = opts ||{};
                var ext = opts.ext || ".xhtml"
                $.ejs.data = {
                    links:   [],
                    scripts: []
                }
                if( /^(html|\*)$/.test(format) ){  //如果是页面
                    cache = $.pagesCache[ url ];
                    var temp, html //用于保存ejs或html
                    if(!cache){//如果不存在,先尝试打模板
                        try{
                            temp = $.readFileSync( url.replace(rext,ext), "utf8");
                            temp = $.ejs.compile( temp, helper );//转换成编译函数
                            cache = $.pagesCache[ url ] =  temp
                        }catch(e){ }
                    }
                    if(!cache){//如果再不存在则找静态页面
                        cache = getFile( url, "text/html" );
                    }
                    if(!cache){//如果还是没有找到404
                        return flow.fire("send_error", 404, "找不到对应的视图", "html")
                    }
                    format = "html"
                    if(typeof cache == "function"){
                        html =  cache(opts || {}) ;//转换成页面
                        var context = $.ejs.data;
                        if(typeof context.layout == "string"){//如果它还要依赖布局模板才能成为一个完整页面,则找布局模板去
                            context.partial = html;
                            var layout_url = $.path.join("app","views/layout", context.layout );
                            layout_url =  layout_url.replace(rext,ext);
                            cache = $.pagesCache[ layout_url ];
                            if( ! cache ){
                                try{
                                    temp  = $.readFileSync(layout_url, "utf8");
                                    cache = $.pagesCache[ layout_url ] = $.ejs.compile( temp, helper )
                                }catch(e){
                                    return flow.fire("send_error", 500, e, "html")
                                }
                            }
                            html = cache( context );//这时已是完整页面了
                        }
                        cache = html;
                        cache = tidy(cache)
                    }
                }else{
                    cache = $.pagesCache[ url ]
                   

                    if( !$.pagesCache[ url ] ){
                        cache = $.pagesCache[ url ] = getFile( url, flow );
                    }
                }
                data = cache;//要返回给前端的数据
            }else{
                data = opts;//要返回给前端的数据
            }
            var mime = $.ext2mime( format );
            if( data.json && data.callback ){//返回JSONP形式的JS文件
                data = $.format("#{0}(#{1})", data.callback, JSON.stringify(data.json))
            }
            if( format == "json" ){//返回JSON数据
                data = JSON.stringify(data);
            }
            res.setHeader('Server',  "node.js "+ process.version);
            var encoding  = /(^text|json$)/.test( mime )  ? "utf8" : "binary"
            if(encoding == "binary"){
                var fs = require("fs");
                var util = require("util");
                //http://stackoverflow.com/questions/8445019/problems-with-sending-jpg-over-http-node-js
                fs.stat(url, function(err, stat) {
                    res.writeHead(200, {
                        'Content-Type' : flow.mime,
                        'Content-Length' : stat.size
                    });
                    var rs = fs.createReadStream(url);
                    // pump the file to the response
                    util.pump(rs, res, function(err) {
                        if(err) {
                            throw err;
                        }
                    });
                })
            //  console.log(url+"   "+ flow.mime+"  "+encoding)
            }else{
                res.setHeader('Content-Type',  mime );
                //不要使用str.length，会导致页面等内容传送不完整
              
                res.setHeader('Content-Length', Buffer.byteLength( data, "utf8" ));
                res.end(data, encoding);
            }
        //console.log(encoding)
        //            if( encoding == "uft8"){
        //                res.setHeader('Content-Type',  mime+"; charset=UTF-8" );
        //            }else{
        //                res.setHeader('Content-Type',  mime );
        //            }
      
        //node.js向前端发送Last-Modified头部时，不要使用 new Date+""，
        //而要用new Date().toGMTString()，因为前者可能出现中文乱码
        //chrome 一定要发送Content-Type 请求头,要不样式表没有效果

        })
    }
})
//添加对静态文件的输出读取支持
    //https://github.com/visionmedia/send
    //http://cnodejs.org/topic/4f5b47c42373009b5c04e9cb nodejs大文件下载与断点续传

    //@可乐 找到两个... 等会去试试 https://github.com/aadsm/jschardet
    //[杭州]Neekey<ni184775761@gmail.com> 20:32:43
    //https://github.com/mooz/node-icu-charset-detector

    //;(function(lazyIter, globals) {
    //  'use strict';
    //
    //  // Export the lazyIter object for Node.js and CommonJS.
    //  if (typeof exports !== 'undefined' && exports) {
    //    if (typeof module !== 'undefined' && module.exports) {
    //      exports = module.exports = lazyIter;
    //    }
    //    exports.lazyIter = lazyIter;
    //  } else if (typeof define === 'function' && define.amd) {
    //    // for AMD.
    //    define('lazyiter', function() {
    //      return lazyIter;
    //    });
    //  } else {
    //    (globals || Function('return this;')() || {}).lazyIter = lazyIter;
    //  }
    //
    //}(function() {
    //
    //  return lazyIter;
    //
    //}(), this));
