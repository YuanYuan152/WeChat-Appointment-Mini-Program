window.onload = function () {
                    var pos =  $('.top').height();// offset() 获得当前的位置，左上角坐标(x,y)
                        xbot = $('.bottom').offset();
                        hebot = $('.bottom').height();
                        hbanner = $('.banner-box').height();
                        thisScrollTop = $(this).scrollTop();
                        //console.log(pos);
                        //console.log(xbot);
                        //console.log(hebot);
                        //console.log(hbanner);
                        //console.log(thisScrollTop);
                    $(window).scroll(function () { //滚动条滚动事件

        console.log($(this).scrollTop());
                        if ($(this).scrollTop() > pos/2 ) {
                            $('.top').addClass('navtop');
                        } 
                        else if ($(this).scrollTop() <=  pos ) {
                            $('.top').removeClass('navtop');
                        }
                    })
    $(window).scroll(function () { //滚动条滚动事件
        console.log($(this).scrollTop());
                        if ($(this).scrollTop() > xbot.top-hebot ) {
                            $('.bot-fixed').addClass('gd-bot');
                        } 
                        else if ($(this).scrollTop() <=  xbot.top-hebot ) {
                            $('.bot-fixed').removeClass('gd-bot');
                        }
                    })
    $(window).scroll(function () { //滚动条滚动事件

        console.log($(this).scrollTop());
                        if ($(this).scrollTop() > hbanner ) {
                            $('.fixed_right').addClass('fixed_right-show');
                        } 
                        else if ($(this).scrollTop() <=  hbanner ) {
                            $('.fixed_right').removeClass('fixed_right-show');
                        }
                    })
    };
    $(function(){
            $('.bottom-top .f-r a').click(function() {
                $('.bottom-top .f-r a img').toggleClass('show');
                $('.bottom-top .f-r .lianjie').toggleClass('lianjieshow');
            });
        });
    $(function(){
            //锚点跳转滑动效果
            $('a[href*=#],area[href*=#]').click(function() {
                // console.log(this.pathname)
                if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
                    var $target = $(this.hash);
                    $target = $target.length && $target || $('[name=' + this.hash.slice(1) + ']');
                    // console.log($target.length);
                    if ($target.length) {
                        var targetOffset = $target.offset().top;
                        $('html,body').animate({
                                    scrollTop: targetOffset
                                },
                                1000);
                        return false;
                    }
                }
            });
        });
// $(document).ready(function(){
//         $(".twindow").fadeToggle("slow");
//         $('body').toggleClass('noscroll');
//         console.log("弹出");
// });

    $(window).ready(function(){

        $('head').append('<meta name="baidu-site-verification" content="GqIlamCk7y" />')
            $(".zixun").click(function(){

                $(".twindow").fadeToggle("slow");
                $('body').toggleClass('noscroll');
            });

            $(".twindow .end").click(function(){
                $(".twindow").fadeOut("slow");
                $("body").removeClass("noscroll");
            });
            $(".twindow .bg").click(function(){
                $(".twindow").fadeOut("slow");
                $("body").removeClass("noscroll");
            });
});
$(function() {
    //PC端鼠标浮动展示子导航
    // $(".nav ul li").hover(
    //     function() {
    //         $(this).children('').next().stop(true, true).delay(300).slideDown(400);
    //     },
    //     function() {
    //         $(this).children('').next().stop(true, true).delay(300).slideUp(400);
    //     }
    // );
    //点击逐渐展开移动端导航
    $(".a_js").click(
        function() {
            $(".a_txt").stop(true, false).delay(0).animate({
                width: "100%",
                height: "100%"
            }, 0);
            $(".a_txt").find(".div1").stop(true, false).delay(0).animate({
                opacity: "0.9"
            }, 500);
            $(".a_txt").find(".div2").stop(true, false).delay(0).animate({
                opacity: "1"
            }, 500);
            $(".a_txt").find(".div3").stop(true, false).delay(0).animate({
                right: "0"
            }, 500);
            $('body').toggleClass('noscroll');
        }
    )
    //点击关闭，逐渐隐藏
    $(".a_closed").click(
        function() {
            $(".a_txt").stop(true, false).delay(500).animate({
                width: "0",
                height: "0"
            }, 0);
            $(".a_txt").find(".div1").stop(true, false).delay(0).animate({
                opacity: "0"
            }, 500);
            $(".a_txt").find(".div2").stop(true, false).delay(0).animate({
                opacity: "0"
            }, 500);
            $(".a_txt").find(".div3").stop(true, false).delay(0).animate({
                right: "-80%"
            }, 500);
            $("body").removeClass("noscroll");
        }
    )
    //点击顶级菜单展开关闭子导航
    $('.div3 ul li i').click(function() {
        $(this).removeClass('a_js2_on');
        $(this).prev().toggleClass('a_js20');
        var subnav = $(this).siblings('.a_txt2');
        console.log(subnav.is(':hidden'))
        if(subnav.is(':hidden')) {
            subnav.parent().siblings('li').children('i').removeClass('a_js2_on');
            subnav.parent().siblings('li').children('.a_js2').removeClass('a_js20');
            subnav.parent().siblings('li').children('.a_txt2').hide();
            subnav.slideDown().prev().addClass('a_js2_on');
        } else {
            subnav.slideUp().prev().removeClass('a_js2_on');
            

        };
    })

});

    