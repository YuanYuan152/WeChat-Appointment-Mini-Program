using lxxl.Models;
using lxxl.Service;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Web.Script.Serialization;

namespace lxxl.Controllers
{
    public class JDYXYController : Controller
    {
        //
        // GET: /JDYXY/
        JavaScriptSerializer serializer = new JavaScriptSerializer();
        public static short type;//1是医生，2是管理员
        
        public ActionResult Index(short logintype, string platform)
        {
            //type = logintype;
            string userAgent = Request.UserAgent;
            if (!userAgent.ToLower().Contains("micromessenger"))
            {
                return Content("请使用微信浏览器打开本页面");
            }
            return RedirectToAction("Login", "WXLogin");           
        }

        string AppID = "wx605ba8ecbd95c29f";
        string AppSecret = "7c15f11b85d11459dae9e7d1a833eab9";

        #region 微信登录
        //JDYXY/Login
        public ActionResult Login(short type,string code)
        {
            try
            {
                type = type;
                string userdata = "";
                if (string.IsNullOrEmpty(code))
                {
                    return Redirect(string.Format("https://open.weixin.qq.com/connect/oauth2/authorize?appid={0}&redirect_uri={1}" + "&response_type=code&scope=snsapi_base&state=STATE#wechat_redirect", AppID, "https://www.ji-psy.com/Login"));
                }
                else
                {
                    string url = string.Format("https://api.weixin.qq.com/sns/oauth2/access_token?appid={0}&secret={1}&code={2}&grant_type=authorization_code", AppID, AppSecret, code);
                    string data = Post.GetJson(url);
                    userdata = data;
                    var obj = serializer.Deserialize<Dictionary<string, string>>(data);
                    string openid = obj["openid"].ToString();
                    return Redirect(string.Format("https://cri.sjtu.edu.cn/csp/WXLogin?type={0}&openid={1}", type, openid));
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message }); 
            }
        }
        #endregion

        #region 微信信息获取之后执行
        /// <summary>
        /// 微信信息获取之后执行
        /// </summary>
        /// <returns></returns>
        public ActionResult GetInfoAfter(string userdata = null,string openid = "")
        {
            Log.WriteLog("GetInfoAfter", this.GetType().ToString(), userdata, "wx");
            string loginRedirect = Session["loginRedirect"] == null ? "/wapyy/Aconsultation" : Session["loginRedirect"].ToString();
            Log.WriteLog("GetInfoAfter", this.GetType().ToString(), userdata + loginRedirect, "wx");
            if (type == 1)
            {
                Session["loginRedirect"] = null;
                Session["useropenid"] = openid;
                return RedirectToAction("wapLogin", "AdminLogin", new { userdata = userdata });
            }
            //else
            //{
            //    T_Doctor Doctorold = db.T_Doctor.Where(o => o.openid == openid && !o.isDelete).OrderByDescending(o => o.createTime).FirstOrDefault();
            //    if (Doctorold != null)
            //    {
            //        Session["psyD"] = Doctorold;
            //    }
            //}
           
            Session["loginRedirect"] = null;
            Session["userdata"] = userdata;
            Session["useropenid"] = openid;
            return Redirect(loginRedirect);
            //跳转至注册页
            
            //注册成功后跳转至WXLogin/Login
            //return RedirectToAction("Login");
        }
        #endregion

        #region 尝试获取用户微信信息,若未关注则获取失败，调用拉起授权
        /// <summary>
        /// 尝试获取用户微信信息,若未关注则获取失败，调用拉起授权
        /// </summary>
        /// <param name="code"></param>
        /// <returns></returns>
        public ActionResult GetUserInfo(string openid)
        {
            string userdata = Post.GetJson(string.Format("https://api.weixin.qq.com/cgi-bin/user/info?access_token={0}&openid={1}&lang=zh_CN", Weixin2Config.TokenHelper.GetToken(), openid));
            var userobj = serializer.Deserialize<Dictionary<string, object>>(userdata);
            //Session["subscribe"] = userobj["subscribe"];
            try
            {
                if (userobj["subscribe"].ToString() == "1")
                {
                    Session["isWeChat"] = 1;
                    //尝试获取微信信息成功,用户已关注
                    return RedirectToAction("GetInfoAfter", new { userdata = userdata, openid= openid });
                }
                else
                {
                    //尝试获取微信用户失败,该用户未关注;尝试拉取
                    Session["isWeChatopenid"] = openid;
                    return RedirectToAction("guanzhu");
                    //return RedirectToAction("GetInfo");
                }
            }
            catch (Exception ex)
            {
                return RedirectToAction("GetInfo");
            }

        }
        #endregion

        #region 拉起用户授权获取信息
        /// <summary>
        /// 拉起用户授权获取信息
        /// </summary>
        /// <param name="code"></param>
        /// <returns></returns>
        public ActionResult GetInfo(string code)
        {
            if (string.IsNullOrEmpty(code))
            {
                return Redirect(string.Format("https://open.weixin.qq.com/connect/oauth2/authorize?appid={0}&redirect_uri={1}" + "&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect", WeixinConfig.AppID, this.Request.Url));
            }
            else
            {
                string url = string.Format("https://api.weixin.qq.com/sns/oauth2/access_token?appid={0}&secret={1}&code={2}&grant_type=authorization_code", Weixin2Config.AppID, Weixin2Config.AppSecret, code);
                string data = Post.GetJson(url);
                var obj = serializer.Deserialize<Dictionary<string, string>>(data);
                string access_token;
                if (!obj.TryGetValue("access_token", out access_token))
                {
                    //微信用户拒绝授权,获取信息失败
                    return Content("授权失败");
                }
                else
                {
                    //微信用户已授权,获取信息成功
                    string openid = obj["openid"];
                    access_token = obj["access_token"];
                    string userdata = Post.GetJson(string.Format("https://api.weixin.qq.com/sns/userinfo?access_token={0}&openid={1}&lang=zh_CN", access_token, openid));
                    return RedirectToAction("GetInfoAfter", new { userdata = userdata, openid = openid });
                }
            }
        }
        #endregion

        #region 拉起关注
        /// <summary>
        /// 拉起关注
        /// </summary>
        /// <param name="code"></param>
        /// <returns></returns>
        public ActionResult guanzhu()
        {
            string openid = (string)Session["isWeChatopenid"];
            ViewBag.openid = openid;
            return View();
        }

        [HttpPost]
        public ActionResult isWeChat(string openid = "")
        {
            //string openid = (string)Session["isWeChatopenid"];
            if(!string.IsNullOrEmpty(openid))
            {
                string userdata = Post.GetJson(string.Format("https://api.weixin.qq.com/cgi-bin/user/info?access_token={0}&openid={1}&lang=zh_CN", Weixin2Config.TokenHelper.GetToken(), openid));
                var userobj = serializer.Deserialize<Dictionary<string, object>>(userdata);
                //Session["subscribe"] = userobj["subscribe"];
                try
                {
                    if (userobj["subscribe"].ToString() == "1")
                    {
                        Session["isWeChat"] = 1;
                        //尝试获取微信信息成功,用户已关注
                        return Json(new { code = 0, data = "/WXLogin/GetInfoAfter?userdata" + userdata + "&openid=" + openid, msg = "" }, JsonRequestBehavior.AllowGet);
                    }
                }
                catch (Exception ex)
                {
                }
            }
            return Json(new { code = -1, msg = "" }, JsonRequestBehavior.AllowGet);

        }
        #endregion
        
    }
}
