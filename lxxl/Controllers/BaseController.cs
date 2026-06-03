using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using lxxl.Models;
using lxxl.Service;
using System.IO;

namespace Base
{
    //权限控制器
    public class HomeBaseController : Controller
    {        
        #region 菜单验证
        protected override void OnActionExecuting(ActionExecutingContext filterContext)
        {
            //if (Session["Menu"] == null || Session["GetMenuTime"] == null || Convert.ToDateTime(Session["GetMenuTime"]) < Service.editmenutime)
            //{
            //    TMLSContext db = new TMLSContext();
            //    Session["Menu"] = db.T_Menu.Where(o => !o.IsDelete).ToList();
            //    Session["GetMenuTime"] = DateTime.Now;
            //}
            base.OnActionExecuting(filterContext);
        }
        #endregion

    }
    public class IndexBaseController : HomeBaseController
    {
        #region 管理员权限限定
        protected override void OnActionExecuting(ActionExecutingContext filterContext)
        {
            if (Session["admin"] == null)
            {
                filterContext.Result = new RedirectResult("/Modal/Login?successurl=" + this.Request.Url.ToString());
            }
            base.OnActionExecuting(filterContext);
        }
        #endregion
    }

    public class mainBaseController : HomeBaseController
    {
        #region 管理员权限限定
        protected override void OnActionExecuting(ActionExecutingContext filterContext)
        {
            if (Session["admin"] == null)
            {
                //if (Session["psyD"] != null)
                //{

                //}
                //else
                //{
                    filterContext.Result = new RedirectResult("/AdminLogin/Index?successurl=" + this.Request.Url.ToString());
                //}
            }
            base.OnActionExecuting(filterContext);
        }
        #endregion
    }

    public class assistantBaseController : HomeBaseController
    {
        #region 助理权限限定
        protected override void OnActionExecuting(ActionExecutingContext filterContext)
        {
            if (Session["assistant"] == null)
            {
                //if (Session["psyD"] != null)
                //{

                //}
                //else
                //{
                filterContext.Result = new RedirectResult("/assistantLogin/Index?successurl=" + this.Request.Url.ToString());
                //}
            }
            base.OnActionExecuting(filterContext);
        }
        #endregion
    }

    public class psyBaseController : Controller
    {
        #region 管理员权限限定
        protected override void OnActionExecuting(ActionExecutingContext filterContext)
        {
            if (Session["psyD"] == null)
            {
                string userAgent = Request.UserAgent;                
                if (userAgent.ToLower().Contains("micromessenger"))
                {
                    Session["loginRedirect"] = this.Request.Url.Scheme + "://" + this.Request.Url.Host + this.Request.Url.PathAndQuery;
                    filterContext.Result = new RedirectResult("/WXLogin/Index?logintype=1");
                }
                else
                {
                    filterContext.Result = new RedirectResult("/psyLogin/Index?successurl=" + this.Request.Url.ToString());
                }
            }
            base.OnActionExecuting(filterContext);
        }
        #endregion
    }

    public class userBaseController : Controller
    {
        #region 用户权限限定
        protected override void OnActionExecuting(ActionExecutingContext filterContext)
        {
            if (Session["User"] == null)
            {               
                filterContext.Result = new RedirectResult("/Home/Index");
            }
            else
            {
                
            }
            base.OnActionExecuting(filterContext);
        }
        #endregion

        public void Write(string str)
        {
            FileStream fs = new FileStream("C://log/userTxt.txt", FileMode.Append);
            StreamWriter sw = new StreamWriter(fs);
            //开始写入
            sw.WriteLine(str);
            //清空缓冲区
            sw.Flush();
            //关闭流
            sw.Close();
            fs.Close();
        }
    }



    public class WeBaseController : Controller
    {
        #region 微信用户权限限定
        protected override void OnActionExecuting(ActionExecutingContext filterContext)
        {
//#if DEBUG
//            Session["OpenID"] = "o5kJk63n9Um9_gRpc3LhDV3571XM";
//#endif
            //            if (Session["OpenID"] == null)
            //            {
            //                Session["loginRedirect"] = this.Request.Url.Scheme + "://" + this.Request.Url.Host + this.Request.Url.PathAndQuery;
            //                filterContext.Result = new RedirectResult("/WXLogin/OpenID");
            //            }
            //            else
            //            {
            //                if (Session["patient"] == null)
            //                {
            //                    TMLSContext db = new TMLSContext();
            //                    string openid = (string)Session["OpenID"];
            //                    T_User pat1 = db.T_User.Where(o => o.OpenID == openid && !o.IsDelete).FirstOrDefault();
            //                    //if (pat1 != null)
            //                    //    Session["patient"] = pat1;
            //                    if (pat1 == null)
            //                    {
            //                        Session["patient"] = null;
            //                        Session["loginRedirect"] = this.Request.Url.Scheme + "://" + this.Request.Url.Host + this.Request.Url.PathAndQuery;
            //                        filterContext.Result = new RedirectResult("/WXLogin/Index?logintype=2");
            //                    }
            //                    else
            //                    {
            //                        Session["patient"] = pat1;
            //                    }

            //                }
            //            }
            base.OnActionExecuting(filterContext);
        }
        #endregion

        public void Write(string str)
        {
            FileStream fs = new FileStream("C://log/BaseTxt.txt", FileMode.Append);
            StreamWriter sw = new StreamWriter(fs);
            //开始写入
            sw.WriteLine(str);
            //清空缓冲区
            sw.Flush();
            //关闭流
            sw.Close();
            fs.Close();
        }
    }


    public class expertsBaseController : Controller
    {
        #region 微信用户权限限定
        protected override void OnActionExecuting(ActionExecutingContext filterContext)
        {
//#if DEBUG
//            Session["OpenID"] = "o5kJk63n9Um9_gRpc3LhDV3571XM";
//#endif
            if (Session["OpenID"] == null)
            {
                Session["loginRedirect"] = this.Request.Url.Scheme + "://" + this.Request.Url.Host + this.Request.Url.PathAndQuery;
                filterContext.Result = new RedirectResult("/WXLogin/OpenID");
            }
            else
            {
                if (Session["patient"] == null)
                {
                    TMLSContext db = new TMLSContext();
                    string openid = (string)Session["OpenID"];
                    T_User pat1 = db.T_User.Where(o => o.OpenID == openid && !o.IsDelete).FirstOrDefault();
                    if (pat1 != null)
                        Session["patient"] = pat1;
                }
            }
            base.OnActionExecuting(filterContext);
        }
        #endregion

        public void Write(string str)
        {
            FileStream fs = new FileStream("C://log/BaseTxt.txt", FileMode.Append);
            StreamWriter sw = new StreamWriter(fs);
            //开始写入
            sw.WriteLine(str);
            //清空缓冲区
            sw.Flush();
            //关闭流
            sw.Close();
            fs.Close();
        }
    }


    public class PatientBaseController : Controller
    {
        #region 患者权限限定
        protected override void OnActionExecuting(ActionExecutingContext filterContext)
        {
            TMLSContext db = new TMLSContext();
            Write(this.Request.Url.Scheme);
            Write(this.Request.Url.Host);
            Write(this.Request.Url.PathAndQuery);
//#if DEBUG
//            Session["patient"] = db.T_User.Where(o => o.ID == 14 && !o.IsDelete).FirstOrDefault();
//#endif

            if (Session["patient"] == null)
            {
                //T_User pat1 = db.T_User.Where(o => o.ID == 5 && !o.IsDelete).FirstOrDefault();
                //Session["patient"] = pat1;
                Session["loginRedirect"] = this.Request.Url.Scheme + "://" + this.Request.Url.Host + this.Request.Url.PathAndQuery;
                filterContext.Result = new RedirectResult("/WXLogin/Index?logintype=2");
            }
            else
            {
                T_User pat = Session["patient"] as T_User;
                T_User pat1 = db.T_User.Where(o => o.ID == pat.ID && !o.IsDelete).FirstOrDefault();
                if (pat1 == null)
                {
                    Session["patient"] = null;
                    Session["loginRedirect"] = this.Request.Url.Scheme + "://" + this.Request.Url.Host + this.Request.Url.PathAndQuery;
                    filterContext.Result = new RedirectResult("/WXLogin/Index?logintype=2");
                }
                else
                {
                    Session["patient"] = pat1;
                }
            }
            base.OnActionExecuting(filterContext);
        }
        #endregion
        
        public void Write(string str)
        {
            FileStream fs = new FileStream("C://log/BaseTxt.txt", FileMode.Append);
            StreamWriter sw = new StreamWriter(fs);
            //开始写入
            sw.WriteLine(str);
            //清空缓冲区
            sw.Flush();
            //关闭流
            sw.Close();
            fs.Close();
        }
    }


    public class doctorBaseController : Controller
    {
        #region 咨询师权限限定
        protected override void OnActionExecuting(ActionExecutingContext filterContext)
        {
            TMLSContext db = new TMLSContext();
//#if DEBUG
//            Session["psyD"] = db.T_Doctor.Where(o => o.ID == 14 && !o.isDelete).FirstOrDefault();
//#endif
            if (Session["psyD"] == null)
            {
                //T_Doctor doctor = db.T_Doctor.Where(o => o.ID == 1 && !o.isDelete).FirstOrDefault();
                //Session["psyD"] = doctor;
                Session["loginRedirect"] = this.Request.Url.Scheme + "://" + this.Request.Url.Host + this.Request.Url.PathAndQuery;
                filterContext.Result = new RedirectResult("/WXLogin/Index?logintype=1");
            }
            else
            {
                T_Doctor doctor = Session["psyD"] as T_Doctor;
                T_Doctor doctor1 = db.T_Doctor.Where(o => o.ID == doctor.ID && !o.isDelete).FirstOrDefault();
                if (doctor1 == null)
                {
                    Session["psyD"] = null;
                    Session["loginRedirect"] = this.Request.Url.Scheme + "://" + this.Request.Url.Host + this.Request.Url.PathAndQuery;
                    filterContext.Result = new RedirectResult("/WXLogin/Index?logintype=1");
                }
                else
                {
                    Session["psyD"] = doctor1;
                }
            }
            base.OnActionExecuting(filterContext);
        }
        #endregion

        public void Write(string str)
        {
            FileStream fs = new FileStream("C://log/BaseTxt.txt", FileMode.Append);
            StreamWriter sw = new StreamWriter(fs);
            //开始写入
            sw.WriteLine(str);
            //清空缓冲区
            sw.Flush();
            //关闭流
            sw.Close();
            fs.Close();
        }
    }

}
