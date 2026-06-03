using lxxl.Models;
using lxxl.Service;
using lxxl.WxService;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Web.Script.Serialization;

namespace lxxl.Controllers
{

    public class WXLoginController : Controller
    {
        JavaScriptSerializer serializer = new JavaScriptSerializer();
        TMLSContext db = new TMLSContext();
        public static short type;//1是咨询师，2是患者

        //
        // GET: /WXLogin/Index
        public ActionResult Index(short logintype = 2, string platform = "wx", string loginRedirect = "")
        {
            type = logintype;
            string userAgent = Request.UserAgent;
            if (!string.IsNullOrEmpty(loginRedirect))
            {
                Session["loginRedirect"] = loginRedirect;
            }
            //if (platform == "weixin")//微信
            //{
            if (!userAgent.ToLower().Contains("micromessenger"))
            {
                return Content("请使用微信浏览器打开本页面");
            }
            return RedirectToAction("Login", "WXLogin");
            //}
            //else if (platform == "app")//App
            //{
            //    return RedirectToAction("AppLogin", "WXLogin");
            //}
            //else//h5
            //{
            //    return RedirectToAction("WebLogin", "WXLogin");
            //}
        }

        #region 微信登陆
        public ActionResult Login(string code)
        {
            string userdata = "";
            if (Session["OpenID"] == null)
            {
                if (string.IsNullOrEmpty(code))
                {
                    string url = string.Format("https://open.weixin.qq.com/connect/oauth2/authorize?appid={0}&redirect_uri={1}" + "&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect", Config.txl_AppId, this.Request.Url.Scheme + "://" + this.Request.Url.Host + this.Request.Url.PathAndQuery);

                    Write("Login"+url);
                    return Redirect(url);
                }
                else
                {
                    string url = string.Format("https://api.weixin.qq.com/sns/oauth2/access_token?appid={0}&secret={1}&code={2}&grant_type=authorization_code", Config.txl_AppId, Config.txl_AppSecret, code);
                    string data = Post.GetJson(url);
                    userdata = data;
                    var obj = serializer.Deserialize<Dictionary<string, string>>(data);
                    //Write(obj["subscribe"].ToString());
                    string openid = obj["openid"];
                    Session["OpenID"] = openid;
                    return Redirect(this.Request.Url.Scheme + "://" + this.Request.Url.Host + this.Request.Url.PathAndQuery);
                }
            }
            else
            {
                string openid = Session["OpenID"].ToString();
                if (type == 1)//记住登陆状态
                {
                    //T_Doctor Doctorold = db.T_Doctor.Where(o => o.openid == openid && !o.isDelete).FirstOrDefault();
                    //if (Doctorold != null)
                    //{
                    //    Session["psyD"] = Doctorold;
                    //    //待跳转链接
                    //    string loginRedirect = Session["loginRedirect"] == null ? "/we/Index" : Session["loginRedirect"].ToString();
                    //    Session["loginRedirect"] = null;
                    //    return Redirect(loginRedirect);

                    //}
                    //else
                    //{
                    //    return RedirectToAction("GetUserInfo", new { openid = openid });
                    //}
                    T_Doctor Doctorold = db.T_Doctor.Where(o => o.openid == openid && !o.isDelete).FirstOrDefault();
                    if (Doctorold != null)
                    {
                        T_Admin user = db.T_Admin.Where(o => o.UserName == Doctorold.UserName && o.Type == 2 && !o.IsDelete).FirstOrDefault();
                        if (user != null)
                        {
                            Session["psyD"] = Doctorold;
                            Session["adminD"] = user;
                        }
                        string loginRedirect = Session["loginRedirect"] == null ? "/we/Index" : Session["loginRedirect"].ToString();
                        Session["loginRedirect"] = null;
                        return Redirect(loginRedirect);
                    }
                    else
                    {
                        return RedirectToAction("GetUserInfo", new { openid = openid });
                    }
                }
                else if (type == 2)
                {
                    T_User patopenid = db.T_User.Where(o => o.OpenID == openid && !o.IsDelete).FirstOrDefault();
                    if (patopenid != null)
                    {
                        Session["patient"] = patopenid;
                        //待跳转链接
                        string loginRedirect = Session["loginRedirect"] == null ? "/we/Index" : Session["loginRedirect"].ToString();
                        Session["loginRedirect"] = null;
                        return Redirect(loginRedirect);
                    }
                    else
                    {
                        return RedirectToAction("GetUserInfo", new { openid = openid });
                    }
                }
                else
                {
                    return RedirectToAction("GetUserInfo", new { openid = openid });
                }
            }
        }
        #endregion

        #region 微信信息获取之后执行
        /// <summary>
        /// 微信信息获取之后执行
        /// </summary>
        /// <returns></returns>
        public ActionResult GetInfoAfter(string userdata = null)
        {
            if (type == 1)
            {
                return RedirectToAction(type == 1 ? "chologist" : (type == 2 ? "Patient" : "We"), "Register", new { userdata = userdata });
            }
            else
            {
                return RedirectToAction(type == 1 ? "chologist" : (type == 2 ? "Patient" : "We"), "Register", new { userdata = userdata });
            }
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
            Write(string.Format("https://api.weixin.qq.com/cgi-bin/user/info?access_token={0}&openid={1}&lang=zh_CN", Config.txl_token, openid));
            string userdata = Post.GetJson(string.Format("https://api.weixin.qq.com/cgi-bin/user/info?access_token={0}&openid={1}&lang=zh_CN", Config.txl_token, openid));
            Write("GetUserInfo" + userdata);
            var userobj = serializer.Deserialize<Dictionary<string, object>>(userdata);
            //Session["subscribe"] = userobj["subscribe"];
            try
            {
                if (userobj["subscribe"].ToString() == "1")
                {
                    //尝试获取微信信息成功,用户已关注
                    return RedirectToAction("GetInfoAfter", new { userdata = userdata });
                }
                else
                {
                    //尝试获取微信用户失败,该用户未关注;尝试拉取
                    return RedirectToAction("GetInfo");
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
                return Redirect(string.Format("https://open.weixin.qq.com/connect/oauth2/authorize?appid={0}&redirect_uri={1}" + "&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect", Config.txl_AppId, this.Request.Url.Scheme + "://" + this.Request.Url.Host + this.Request.Url.PathAndQuery));
            }
            else
            {
                string url = string.Format("https://api.weixin.qq.com/sns/oauth2/access_token?appid={0}&secret={1}&code={2}&grant_type=authorization_code", Config.txl_AppId, Config.txl_AppSecret, code);
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
                    Write("GetInfo"+userdata);
                    return RedirectToAction("GetInfoAfter", new { userdata = userdata });
                }
            }
        }
        #endregion

        public void Write(string str)
        {
            FileStream fs = new FileStream("C://log/WXLoginTxt.txt", FileMode.Append);
            StreamWriter sw = new StreamWriter(fs);
            //开始写入
            sw.WriteLine(DateTime.Now.ToString("yyyy-MM-dd HH:ss:mm")+":"+ str);
            //清空缓冲区
            sw.Flush();
            //关闭流
            sw.Close();
            fs.Close();
        }

        #region 微信openID
        public ActionResult OpenID(string code)
        {
            if (Session["OpenID"] == null)
            {
                if (string.IsNullOrEmpty(code))
                {
                    string url = string.Format("https://open.weixin.qq.com/connect/oauth2/authorize?appid={0}&redirect_uri={1}" + "&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect", Config.txl_AppId, this.Request.Url.Scheme + "://" + this.Request.Url.Host + this.Request.Url.PathAndQuery);
                    return Redirect(url);
                }
                else
                {
                    string url = string.Format("https://api.weixin.qq.com/sns/oauth2/access_token?appid={0}&secret={1}&code={2}&grant_type=authorization_code", Config.txl_AppId, Config.txl_AppSecret, code);
                    string data = Post.GetJson(url);
                    var obj = serializer.Deserialize<Dictionary<string, string>>(data);
                    string openid = obj["openid"];
                    Session["OpenID"] = openid;
                    T_User patopenid = db.T_User.Where(o => o.OpenID == openid && !o.IsDelete).FirstOrDefault();
                    if (patopenid != null)
                    {
                        Session["patient"] = patopenid;
                    }

                    string loginRedirect = Session["loginRedirect"] == null ? "/we/Index" : Session["loginRedirect"].ToString();
                    Session["loginRedirect"] = null;
                    return Redirect(loginRedirect);
                }
            }
            else
            {
                string openid = Session["OpenID"].ToString();
                T_User patopenid = db.T_User.Where(o => o.OpenID == openid && !o.IsDelete).FirstOrDefault();
                if (patopenid != null)
                {
                    Session["patient"] = patopenid;
                    //待跳转链接
                    string loginRedirect = Session["loginRedirect"] == null ? "/we/Index" : Session["loginRedirect"].ToString();
                    Session["loginRedirect"] = null;
                    return Redirect(loginRedirect);
                }
                else
                {
                    return RedirectToAction("GetUserInfo", new { openid = openid });
                }
            }
        }
        #endregion

        #region H5登录
        public ActionResult WebLogin()
        {
            return View();
        }
        [HttpPost]
        public ActionResult WebLogin(string username, string password)
        {
            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
            {
                return Json(new { errcode = -1, errmsg = "请输入账号或密码" });
            }
            else
            {
                T_User pat = db.T_User.Where(o => o.UserName == username && !o.IsDelete).FirstOrDefault();
                if (pat == null)
                    return Json(new { errcode = -1, errmsg = "用户未注册" });
                else if (pat.PassWord != password)
                    return Json(new { errcode = -1, errmsg = "密码不正确" });
                else
                {
                    Session["patient"] = pat;
                    //待跳转链接
                    string loginRedirect = Session["loginRedirect"] == null ? "/we/Index" : Session["loginRedirect"].ToString();
                    Session["loginRedirect"] = null;
                    return Json(new { errcode = 0, data = new { url = loginRedirect }, errmsg = "登录成功" });
                }

            }
        }
        #endregion
    }
}
