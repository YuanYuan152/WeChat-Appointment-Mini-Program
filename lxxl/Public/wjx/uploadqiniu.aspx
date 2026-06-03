<html xmlns="http://www.w3.org/1999/xhtml"><head><title>
	绘制签名
</title>
<style>
body {
    //font-family: "微软雅黑","Lucida Grande",Helvetica,Arial,Verdana,sans-serif;
}
*{
    padding:0;
    margin:0;
}
.signTitle {
    height: 24px;
    line-height: 24px;
    background: #fff;
    border-radius: 2px 2px 0px 0px;
    border-bottom: 1px solid #EBEBEB;
    font-size: 12px;
    font-weight: 400;
    color: #999999;
    text-indent: 6px;
}

.signWrap {
    border: 1px solid #EBEBEB;
    background: url(//image.wjx.com/images/commonImgPC/bg-line.png) repeat;
}
.canvasSign {
    height: 108px;
    text-align:center;
    position:relative;
    overflow:hidden

}
.canvasSign canvas{
    position:absolute;
    top:0;
    left:0;
}
.signControl {
    padding: 6px;
    overflow: hidden;
    background: #fff;
    border-top: 1px solid #EBEBEB;
}
.clearSign, .cancelSign, .rubber {
    float: left;
    box-sizing: border-box;
    vertical-align: middle;
    display: inline-block;
    white-space: nowrap;
    text-align: center;
    border-radius: 2px;
    cursor: pointer;
    text-decoration: none;
    background: #fff;
    border: 1px solid #E8E8E8;
    color: #262626 !important;
    height: 26px;
    line-height: 24px;
    padding: 0 9px;
    font-size: 14px;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
}

.cancelSign, .rubber {
    margin-left:10px;
}
#saveSign {
    float: right;
    box-sizing: border-box;
    vertical-align: middle;
    background-color: #0095FF;
    color: #fff !important;
    white-space: nowrap;
    text-align: center;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    text-decoration: none;
    height: 26px;
    line-height: 26px;
    padding: 0 9px;
    font-size: 14px;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
}
.rubber.clicked{
    background-color: #0095FF;
    color: #fff !important;
    line-height: 26px;
    border:none;
}

@media screen and (max-width:360px){
    .clearSign, .cancelSign, .rubber,.saveSign
    {
        font-size:12px !important;
    }
    .clearSign, .cancelSign, .rubber{
        padding:0 7px;
    }
    .cancelSign, .rubber {
        margin-left: 6px;
    }
}
@media screen and (max-width:250px){
   .rubber
    {
        display:none;
    }
}
    
</style>
<style type="text/css">#saveSign,.rubber.clicked{background-color:rgb(0, 149, 255)}</style></head>
<body style="">
     <form action="https://wjx-z0.qiniup.com" method="post" enctype="multipart/form-data" id="uploadForm">
       <div class="signWrap">
           <div class="signTitle">请在以下矩形区域内绘制</div>
           <div class="canvasSign" id="html2canvas" style="height: 150px;"><canvas width="348" height="150"></canvas></div>
           <div class="signControl"><span class="clearSign">清空</span><span class="cancelSign">撤销</span><span class="rubber">橡皮擦</span><span id="saveSign" class="saveSign">确定并上传</span></div>
           <input name="signfile" type="hidden" id="signfile">
       </div>
    </form>
    <script src="//image.wjx.cn/wxloj/html2canvas.js"></script>
    <script src="//cdn.staticfile.org/jquery/1.10.2/jquery.min.js"></script>
    <script type="text/javascript">
        !window.jQuery && document.write('<script src="//image.wjx.cn/js/jquery-1.10.2.min.js"><\/script>');
    </script>
    <script type="text/javascript">
        var formAction = "https://wjx-z0.qiniup.com";
        var isMobile = 1;
        var signSize = '1';
        var token = '-kY3jr8KMC7l3KkIN3OcIs8Q4s40OfGgUHr1Rg4D:4mIr2nKhOOhqtWYg-hrX2oIAGOI=:eyJzY29wZSI6InNvanVtcCIsInJldHVybkJvZHkiOiJ7XCJzaXplXCI6XCIkKGZzaXplKVwiLFwibmFtZVwiOlwiJChmbmFtZSlcIixcImtleVwiOlwiJChrZXkpXCIsXCJtaW1lVHlwZVwiOlwiJChtaW1lVHlwZSlcIn0iLCJkZWFkbGluZSI6MTgzNDIyMjg4NSwiaW5zZXJ0T25seSI6MSwiZGV0ZWN0TWltZSI6MCwibWltZUxpbWl0IjoiaW1hZ2UvanBnO2ltYWdlL2pwZWc7aW1hZ2UvZ2lmO2ltYWdlL2JtcDtpbWFnZS9wbmc7YXBwbGljYXRpb24vcGRmO2FwcGxpY2F0aW9uL21zd29yZDthcHBsaWNhdGlvbi94bWw7YXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LndvcmRwcm9jZXNzaW5nbWwuZG9jdW1lbnQ7YXBwbGljYXRpb24veG1sO2FwcGxpY2F0aW9uL3ZuZC5tcy1leGNlbDthcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC5zaGVldDthcHBsaWNhdGlvbi92bmQubXMtcG93ZXJwb2ludDthcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQucHJlc2VudGF0aW9ubWwucHJlc2VudGF0aW9uO3RleHQvcGxhaW47YXBwbGljYXRpb24veC1yYXItY29tcHJlc3NlZDthcHBsaWNhdGlvbi94LXJhcjthcHBsaWNhdGlvbi96aXA7YXBwbGljYXRpb24veC1nemlwO3ZpZGVvL21wNDthcHBsaWNhdGlvbi94LW1wZWdVUkw7dmlkZW8veC1mbHY7dmlkZW8veC1mNHY7dmlkZW8vd2VibTt2aWRlby9xdWlja3RpbWU7dmlkZW8veC1tNHY7dmlkZW8vM2dwcDt2aWRlby94LW1zdmlkZW87dmlkZW8veC1tcy13bXY7YXVkaW8vbXBlZzthdWRpby94LW1zLXdtYTthdWRpby94LXdhdjt2aWRlby94LW1zLWFzZjthdWRpby9BTVI7YXVkaW8vQU1SLVdCO2F1ZGlvL21wNDthdWRpby9hYWM7YXVkaW8vdm5kLmRsbmEuYWR0czthdWRpby94LWh4LWFhYy1hZHRzIiwiZnNpemVMaW1pdCI6MH0=';
        var activity = '148415146';
        var saveKey = "148415146_132_q2_5PuafpKkNUybN1QIADp5Gw.png";
        var qTopic = '2';
        var encodeKey = 'MTQ4NDE1MTQ2XzEzMl9xMl81UHVhZnBLa05VeWJOMVFJQURwNUd3LnBuZw==';
        var finishStr = '';
        var emptyTxt = '您还没有绘制任何内容！';
        var signatureBg = "";
        if (!!window.ActiveXObject || "ActiveXObject" in window) {
            var script = document.createElement("script");
            script.type = "text/javascript";
            script.src = "https://cdn.staticfile.org/bluebird/3.7.2/bluebird.min.js";
            document.getElementsByTagName('head')[0].appendChild(script);
        }
    </script>

    <script type="text/javascript">

        try {
            var mainColor;
            if (isMobile) mainColor = window.parent.jQuery("#ctlNext").css("background-color");
            else mainColor = window.parent.getStyle(window.parent.document.getElementById("submit_button"), "backgroundColor");
            if (mainColor) {
                var style = document.createElement("style");
                style.type = "text/css";
                try {
                    style.appendChild(document.createTextNode("#saveSign,.rubber.clicked{background-color:" + mainColor + "}"));
                } catch (ex) {
                    style.styleSheet.cssText = "#saveSign,.rubber.clicked{background-color:" + mainColor + "}";//针对IE
                }
                var head = document.getElementsByTagName("head")[0];
                head.appendChild(style);
            }
        } catch (err) { }

        function loadLocalRes() {
            var cdnDomain = "//image.wjx.cn";
            try {
                if (typeof lineCanvas == 'undefined' && cdnDomain) {
                    var links = document.getElementsByTagName("link");
                    var linkslength = links.length;
                    for (var i = 0; i < linkslength; i++) {
                        if (links[i].href && links[i].href.indexOf(cdnDomain) > -1) {
                            var newHref = links[i].href.split(cdnDomain)[1];
                            $('<link rel="stylesheet" type="text/css" href="' + newHref + '" />').appendTo('head');
                        }
                    }
                    var scripts = document.getElementsByTagName("script");
                    var scriptslength = scripts.length;
                    for (var i = 0; i < scriptslength; i++) {
                        if (!scripts[i].src) continue;
                        if (scripts[i].src.indexOf(cdnDomain) == -1) continue;
                        var newHref = scripts[i].src.split(cdnDomain)[1];
                        document.write('<script src="' + newHref + '"><\/script>');
                    }
                }
            }
            catch (ex) {
            }
        }
        loadLocalRes();
    </script>


</body></html>