using lxxl.Models;
using lxxl.Service;
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Mvc;
using System.Web.Script.Serialization;

namespace lxxl.Controllers
{
    public class RegisterController : Controller
    {
        //
        // GET: /Register/
        public TMLSContext db = new TMLSContext();
        string AppId = Config.txl_AppId;
        public JavaScriptSerializer serializer = new JavaScriptSerializer();
        #region 清除缓存
        public ActionResult Index()
        {
            Session.Clear();
            return RedirectToAction("ChangeUser", "Register");
        }
        #endregion

        #region 判断账号是否已注册
        public void acRegisteredDoc(string tel)
        {
            string msg = "";
            if (db.T_Doctor.Where(o => o.tel == tel && !o.isDelete).FirstOrDefault() == null)
            {
                msg = "不是";
                Response.Write(msg);
            }
            else
            {
                msg = "是";
                Response.Write(msg);
            }
        }

        public void acRegistered(string tel, int type)
        {
            string msg = "";
            if (type == 0)
            {
                if (db.T_User.Where(o => o.Tel == tel && !o.IsDelete).FirstOrDefault() == null)
                {
                    msg = "不存在";
                    Response.Write(msg);
                }
                else
                {
                    msg = "存在";
                    Response.Write(msg);
                }
            }
            else if (type == 1)
            {
                if (db.T_Doctor.Where(o => o.tel == tel && !o.isDelete).FirstOrDefault() == null)
                {
                    msg = "不存在";
                    Response.Write(msg);
                }
                else
                {
                    msg = "存在";
                    Response.Write(msg);
                }
            }
            else if (type == 2)
            {
                if (db.T_User.Where(o => o.Tel == tel && !o.IsDelete).FirstOrDefault() == null)
                {
                    msg = "不存在";
                    Response.Write(msg);
                }
                else
                {
                    msg = "存在";
                    Response.Write(msg);
                }
            }
        }
        #endregion

        #region 切换账号
        public ActionResult ChangeUser()
        {
            return View();
        }
        [HttpPost]
        public ActionResult ChangeUser(string Tel, string imgcode)
        {
            if (Session["mobile_code"] == null || Session["tel"] == null)
                return Content("no:您未发送手机验证码！");
            if (imgcode != Session["mobile_code"].ToString())
            {
                return Content("no:验证码错误");
            }
            if (Tel.Trim() != Session["tel"].ToString())
            {
                return Content("no:接受短信的手机号与登录手机号不一致！");
            }
            T_Doctor doc = db.T_Doctor.Where(o => o.tel == Tel && !o.isDelete).FirstOrDefault();
            if (doc != null)
            {
                Session["psyD"] = doc;
                return Content("url:" + Url.Action("Index", "Doctor"));
            }
            return Content("");
        }
        #endregion

        #region 发送登录验证码
        public ActionResult SendMsgType(string tel, short type=1)
        {
            Random rad = new Random();
            string mobile_code = "111111";// rad.Next(100000, 999999).ToString();
            Session["mobile_code"] = mobile_code;
            Session["tel"] = tel.Trim();
            if (Session["SourceID"] == null)
                Session["SourceID"] = 1;
            long SourceID = Convert.ToInt64(Session["SourceID"]);
            SortedDictionary<String, String> ss = new SortedDictionary<string, string>();
            ss.Add("code", mobile_code);
            //ss.Add("product", "注册验证");
            //return Content("发送成功");
            if (Service.AliMsg.sendShortMsg(tel.Trim(), ss, 0))
            {
                return Content("发送成功");
            }
            else
            {
                return Content("发送失败");
            }
        }
        #endregion

        #region 咨询师注册
        public ActionResult chologist(string userdata = null)
        {
            string img = "/Content/images/jxl-erweima.jpg";
            ViewBag.img = img;

            if (userdata == null)
                return RedirectToAction("Index", "WXLogin", new { logintype = 1 });
            var obj = serializer.Deserialize<Dictionary<string, object>>(userdata);
            string OpenID = obj["openid"].ToString();
            T_Doctor Doctorold = db.T_Doctor.Where(o => o.openid == OpenID && !o.isDelete).FirstOrDefault();
            if (Doctorold != null)
            {
                T_Admin user = db.T_Admin.Where(o => o.UserName == Doctorold.UserName && o.Type == 2 && !o.IsDelete).FirstOrDefault();
                if (user != null)
                {
                    Session["psyD"] = Doctorold;
                    Session["adminD"] = user;
                }
                string loginRedirect = Session["loginRedirect"] == null ? "/psychologists/UserCenter" : Session["loginRedirect"].ToString();
                Session["loginRedirect"] = null;
                return RedirectToAction(loginRedirect);
            }
            ViewBag.Obj = obj;
            //ViewBag.userdata = userdata;
            string topurl = "";
            topurl = SaveImageByUrl(obj["headimgurl"].ToString());
            if (string.IsNullOrEmpty(topurl))
            {
                topurl = obj["headimgurl"].ToString();
            }
            ViewBag.openid = OpenID;
            ViewBag.topUrl = topurl;
            ViewBag.nickName = obj["nickname"].ToString();
            string msgcode = Guid.NewGuid().ToString("N");
            Session["msgcode"] = msgcode;
            ViewBag.msgcode = msgcode;
            return View();
        }

        [HttpPost]
        public ActionResult chologist(T_Doctor Doctorold)
        {
            T_Doctor pat = db.T_Doctor.Where(o => o.UserName == Doctorold.UserName && o.Password == Doctorold.Password && !o.isDelete).FirstOrDefault();
            if (pat == null)
                return Content("no:该账号不存在或密码错误");
            if (!string.IsNullOrEmpty(pat.openid) && pat.openid != Doctorold.openid)
            {
                return Content("no:该账号已被绑定");
            }
            if (string.IsNullOrEmpty(pat.openid))
            {
                pat.topUrl = Doctorold.topUrl;
                pat.openid = Doctorold.openid;
                pat.nickName = Doctorold.nickName;
                db.SaveChanges();
            }

            T_Admin user = db.T_Admin.Where(o => o.UserName == Doctorold.UserName && o.Type == 2 && !o.IsDelete).FirstOrDefault();
            if (user != null)
            {
                Session["psyD"] = Doctorold;
                Session["adminD"] = user;
                string loginRedirect = Session["loginRedirect"] == null ? "/psychologists/UserCenter" : Session["loginRedirect"].ToString();
                Session["loginRedirect"] = null;
                return Content("url:" + loginRedirect);
            }
            return Content("no:登录失败");
        }
        #endregion

        #region 患者注册
        public ActionResult Patient(string userdata = null)
        {
            //userdata = "{'subscribe': 1,    'openid': 'o7Lp5t6n59DeX3U0C7Kric9qEx-Q',    'nickname': '方倍',    'sex': 1,    'language': 'zh_CN',    'city': '深圳',    'province': '广东',    'country': '中国',    'headimgurl': 'http://wx.qlogo.cn/mmopen/Kkv3HV30gbEZmoo1rTrP4UjRRqzsibUjT9JClPJy3gzo0NkEqzQ9yTSJzErnsRqoLIct5NdLJgcDMicTEBiaibzLn34JLwficVvl6/0',    'subscribe_time': 1389684286}";
            //{"openid":"o5kJk63n9Um9_gRpc3LhDV3571XM","nickname":"张家健","sex":0,"language":"","city":"","province":"","country":"","headimgurl":"https:\/\/thirdwx.qlogo.cn\/mmopen\/vi_32\/Q0j4TwGTfTKqPuarGGlcWL0sOFBicPnmibloGdPyg45jRzhEcViaSWjib9mTrHBuJa3vvHqJSG87hlyeWX7j62UFCA\/132","privilege":[]}
            if (Session["SourceID"] == null)
                Session["SourceID"] = 1;
            long SourceID = Convert.ToInt64(Session["SourceID"]);
            string img = "/Content/images/jxl-erweima.jpg";
            ViewBag.img = img;
            
            if (userdata == null)
                return RedirectToAction("Index", "WXLogin", new { logintype = 2 });
            var obj = serializer.Deserialize<Dictionary<string, object>>(userdata);
            string OpenID = obj["openid"].ToString();
            T_User patopenid = db.T_User.Where(o => o.OpenID == OpenID && !o.IsDelete).FirstOrDefault();
            if (patopenid != null)
            {
                Session["patient"] = patopenid;
                string loginRedirect = Session["loginRedirect"] == null ? "/Patient/UserCenter" : Session["loginRedirect"].ToString();
                Session["loginRedirect"] = null;
                return RedirectToAction(loginRedirect);
            }
            ViewBag.Obj = obj;
            ViewBag.userdata = userdata;
            string msgcode = Guid.NewGuid().ToString("N");
            Session["msgcode"] = msgcode;
            ViewBag.msgcode = msgcode;
            return View();
        }

        [HttpPost]
        public ActionResult Patient(T_User Patient)
        {
            T_User pat = db.T_User.Where(o => o.UserName == Patient.Tel).FirstOrDefault();
            if (pat != null)
                return Content("no:该手机号已注册");
            //string imgcode = Request["imgcode"];
            //if (imgcode != Session["mobile_code"].ToString())
            //{
            //    return Content("no;验证码错误");
            //}
            string userdata = Request["userdata"];
            var obj = serializer.Deserialize<Dictionary<string, object>>(userdata);
            Patient.UserName = Patient.Tel;
            Patient.OpenID = obj["openid"].ToString();
            string topurl = "";
            topurl = SaveImageByUrl(obj["headimgurl"].ToString());
            if (!string.IsNullOrEmpty(topurl))
            {
                Patient.TopUrl = topurl;
            }
            else
            {
                Patient.TopUrl = obj["headimgurl"].ToString();
            }
            Patient.nickname = obj["nickname"].ToString();
            Patient.Sex = Convert.ToInt64(obj["sex"]) == 1 ? "男" : "女";
            if (Session["SourceID"] == null)
                Session["SourceID"] = 1;
            long SourceID = Convert.ToInt64(Session["SourceID"]);
            Patient.SourceID = SourceID;
            
             T_User pat0 = db.T_User.Add(Patient);
            db.SaveChanges();
            Session["patient"] = pat0;
            string loginRedirect = Session["loginRedirect"] == null ? "/Patient/UserCenter" : Session["loginRedirect"].ToString();
            Session["loginRedirect"] = null;
            return Content("url:" + loginRedirect);
        }
        #endregion

        #region 下载微信头像转换为Image
        public static Image getImageByUrl(String imageUrl)
        {
            try
            {
                string url = string.Format(imageUrl);
                System.Net.WebRequest webreq = System.Net.WebRequest.Create(url);
                System.Net.WebResponse webres = webreq.GetResponse();
                using (System.IO.Stream stream = webres.GetResponseStream())
                {
                    return Image.FromStream(stream);
                }
            }
            catch (Exception ex)
            {
                LogWriter.Default.WriteInfo(ex.Message);
                return null;
            }
        }
        #endregion

        #region 保存至本地，返回路径
        public string SaveImageByUrl(String imageUrl)
        {
            try
            {
                Image Main = getImageByUrl(imageUrl);
                Bitmap bmp = new Bitmap(Main.Width, Main.Height);
                Graphics g = Graphics.FromImage(bmp);
                g.Clear(Color.White);
                g.DrawImage(Main, 0, 0, Main.Width, Main.Height);
                GC.Collect();
                string baseContent = "/Content/Upload/UploadImg/";
                string pathName = Guid.NewGuid().ToString("N") + ".jpg";
                string path = Server.MapPath(baseContent) + pathName;
                bmp.Save(path, System.Drawing.Imaging.ImageFormat.Jpeg);
                return baseContent + pathName;
            }
            catch (Exception ex)
            {
                LogWriter.Default.WriteInfo(ex.Message);
                return "";
            }
        }
        #endregion

        #region 判断账号是否已注册
        public ActionResult getUser(string tel, string password)
        {
            string msg = "";
            T_User User = db.T_User.Where(o => (o.Tel == tel || o.Mail == tel) && o.PassWord == password).FirstOrDefault();
            if (User == null)
            {
                return Json(new { code = -1, msg = "账号不存在" }, JsonRequestBehavior.AllowGet);
            }
            else
            {
                Session["User"] = User;
                return Json(new { code = 0, data = new { User = User }, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
            }
           
        }
        public ActionResult getLoginUser()
        {
            T_User User = Session["User"] as T_User ;
            if (User == null)
            {
                return Json(new { code = -1, msg = "账号不存在" }, JsonRequestBehavior.AllowGet);
            }
            else
            {
                return Json(new { code = 0, data = new { User = User }, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
            }

        }
        public ActionResult Logout()
        {
            T_User User = Session["User"] as T_User;
            if (User == null)
            {
                return Json(new { code = -1, msg = "" }, JsonRequestBehavior.AllowGet);
            }
            else
            {
                Session["User"] = null;
                return Json(new { code = 0, msg = "" }, JsonRequestBehavior.AllowGet);
            }

        }
        #endregion

        #region 退出
        public ActionResult UserExit()
        {
            Session["User"] = null;
            Session.RemoveAll();
            return RedirectToAction("Index", "Home");
        }
        #endregion

        #region 判断账号是否已注册
        public ActionResult sendRegist(string tel, string password,string name,string mail, string vcode)
        {
            if (Session["mobile_code"]==null || vcode != Session["mobile_code"].ToString())
            {
                return Json(new { code = -1, msg = "验证码错误" }, JsonRequestBehavior.AllowGet);
            }
            Regex reg = new Regex(@"\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*");
            if (!reg.IsMatch(mail))
            {
                return Json(new { code = -1, msg = "邮箱地址格式不对" }, JsonRequestBehavior.AllowGet);
            }
            T_User User = db.T_User.Where(o => (o.Tel == tel || o.Mail == mail)).FirstOrDefault();
            if (User == null)
            {
                User = new T_User();
                User.PassWord = password;
                User.Name = name;
                User.Tel = tel;
                User.Mail = mail;
                T_User UserA = db.T_User.Add(User);
                db.SaveChanges();
                Session["User"] = UserA;
                return Json(new { code = 0, data = new { User = User }, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
            }
            else
            {
                return Json(new { code = -1, msg = "账号已存在" }, JsonRequestBehavior.AllowGet);
            }

        }
        #endregion


        #region 患者注册
        public ActionResult Consultant(string userdata = null)
        {
            //userdata = "{'subscribe': 1,    'openid': 'o7Lp5t6n59DeX3U0C7Kric9qEx-Q',    'nickname': '方倍',    'sex': 1,    'language': 'zh_CN',    'city': '深圳',    'province': '广东',    'country': '中国',    'headimgurl': 'http://wx.qlogo.cn/mmopen/Kkv3HV30gbEZmoo1rTrP4UjRRqzsibUjT9JClPJy3gzo0NkEqzQ9yTSJzErnsRqoLIct5NdLJgcDMicTEBiaibzLn34JLwficVvl6/0',    'subscribe_time': 1389684286}";
            //{"openid":"o5kJk63n9Um9_gRpc3LhDV3571XM","nickname":"张家健","sex":0,"language":"","city":"","province":"","country":"","headimgurl":"https:\/\/thirdwx.qlogo.cn\/mmopen\/vi_32\/Q0j4TwGTfTKqPuarGGlcWL0sOFBicPnmibloGdPyg45jRzhEcViaSWjib9mTrHBuJa3vvHqJSG87hlyeWX7j62UFCA\/132","privilege":[]}
            if (Session["SourceID"] == null)
                Session["SourceID"] = 1;
            long SourceID = Convert.ToInt64(Session["SourceID"]);
            string img = "/Content/images/jxl-erweima.jpg";
            ViewBag.img = img;

            if (userdata == null)
                return RedirectToAction("Index", "WXLogin", new { logintype = 2 });
            var obj = serializer.Deserialize<Dictionary<string, object>>(userdata);
            string OpenID = obj["openid"].ToString();
            T_User patopenid = db.T_User.Where(o => o.OpenID == OpenID && !o.IsDelete).FirstOrDefault();
            if (patopenid != null)
            {
                Session["patient"] = patopenid;
                string loginRedirect = Session["loginRedirect"] == null ? "/Patient/UserCenter" : Session["loginRedirect"].ToString();
                Session["loginRedirect"] = null;
                return RedirectToAction(loginRedirect);
            }
            ViewBag.Obj = obj;
            ViewBag.userdata = userdata;
            string msgcode = Guid.NewGuid().ToString("N");
            Session["msgcode"] = msgcode;
            ViewBag.msgcode = msgcode;
            return View();
        }

        [HttpPost]
        public ActionResult Consultant(T_User Patient)
        {
            T_User pat = db.T_User.Where(o => o.UserName == Patient.Tel).FirstOrDefault();
            if (pat != null)
                return Content("no:该手机号已注册");
            //string imgcode = Request["imgcode"];
            //if (imgcode != Session["mobile_code"].ToString())
            //{
            //    return Content("no;验证码错误");
            //}
            string userdata = Request["userdata"];
            var obj = serializer.Deserialize<Dictionary<string, object>>(userdata);
            Patient.UserName = Patient.Tel;
            Patient.OpenID = obj["openid"].ToString();
            string topurl = "";
            topurl = SaveImageByUrl(obj["headimgurl"].ToString());
            if (!string.IsNullOrEmpty(topurl))
            {
                Patient.TopUrl = topurl;
            }
            else
            {
                Patient.TopUrl = obj["headimgurl"].ToString();
            }
            Patient.nickname = obj["nickname"].ToString();
            Patient.Sex = Convert.ToInt64(obj["sex"]) == 1 ? "男" : "女";
            if (Session["SourceID"] == null)
                Session["SourceID"] = 1;
            long SourceID = Convert.ToInt64(Session["SourceID"]);
            Patient.SourceID = SourceID;

            T_User pat0 = db.T_User.Add(Patient);
            db.SaveChanges();
            Session["patient"] = pat0;
            string loginRedirect = Session["loginRedirect"] == null ? "/Patient/UserCenter" : Session["loginRedirect"].ToString();
            Session["loginRedirect"] = null;
            return Content("url:" + loginRedirect);
        }
        #endregion
    }
}
