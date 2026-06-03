using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using lxxl.Models;
using Common.ValidateCode;
using System.Text.RegularExpressions;

namespace lxxl.Controllers
{
    /// <summary>
    /// 咨询师登陆控制器
    /// </summary>
    public class psyLoginController : Controller
    {
        //
        // GET: /psyLogin/
        public TMLSContext db = new TMLSContext();
        public ActionResult Index()
        {
            return View();
        }
        #region 获取一个验证码图片
        public ActionResult ShowValidateCode()
        {
            ValidateCode validateCode = new ValidateCode();
            string code = validateCode.CreateValidateCode(4);//获取验证码.
            Session["code"] = code;
            byte[] buffer = validateCode.CreateValidateGraphic(code);
            return File(buffer, "image/jpeg");
        }
        #endregion

        #region 登陆判断
        [HttpPost]
        public ActionResult UserLogin()
        {
            string validateCode = Session["code"] == null ? string.Empty : Session["code"].ToString();
            if (string.IsNullOrEmpty(validateCode))
            {
                return Content("no:验证码错误!!");
            }
            Session["code"] = null;
            string txtCode = Request["vCode"];
            if (!validateCode.Equals(txtCode, StringComparison.InvariantCultureIgnoreCase))
            {
                return Content("no:验证码错误!!");
            }
            string userName = Request["LoginCode"];
            string userPwd = Request["LoginPwd"];
            T_Admin user = db.T_Admin.Where(o => o.UserName == userName && o.Type == 2 && o.Password == userPwd && !o.IsDelete).FirstOrDefault();
            if (user != null)
            {
                T_Doctor Doctor = db.T_Doctor.Where(o => o.UserName == user.UserName && !o.isDelete).FirstOrDefault();
                Session["psyD"] = Doctor;
                Session["adminD"] = user;
                return Content("ok:登录成功");
            }
            else
            {
                return Content("no:账号不存在或密码错误!!");
            }
        }
        #endregion

        #region 退出
        public ActionResult UserExit()
        {
            Session.RemoveAll();
            return RedirectToAction("Index", "psyLogin");
        }
        #endregion



        #region 判断账号是否已注册
        public ActionResult sendRegist(string tel, string password, string name, string mail, string vcode)
        {
            if (Session["mobile_code"] == null || vcode != Session["mobile_code"].ToString())
            {
                return Json(new { code = -1, msg = "验证码错误" }, JsonRequestBehavior.AllowGet);
            }
            Regex reg = new Regex(@"\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*");
            if (!reg.IsMatch(mail))
            {
                return Json(new { code = -1, msg = "邮箱地址格式不对" }, JsonRequestBehavior.AllowGet);
            }
            T_Admin User = db.T_Admin.Where(o => (o.Tel == tel || o.Mail == mail || o.UserName == name)).FirstOrDefault();
            if (User == null)
            {
                User = new T_Admin();
                User.Password = password;
                User.UserName = name;
                User.Name = name;
                User.Tel = tel;
                User.Mail = mail;
                User.Type = 2;
                T_Admin UserA = db.T_Admin.Add(User);
                db.SaveChanges();

                T_Doctor Doctor = new T_Doctor( "",name, "", "","", tel, mail);
                Doctor.UserName = name; 
                Doctor.name = name;
                Doctor.Password = password;
                Doctor.IsTop = false; 
                Doctor.departmentID = 1;
                Doctor.hospitalID = 1;
                Doctor.Field = "";
                Doctor.url = "";
                Doctor.Specialty = "";
                Doctor.Careerexperience = "";
                Doctor.Mode = "0";
                Doctor.Qualification = "";
                Doctor.TargetGroup = "";
                
                T_Doctor addExaminer = db.T_Doctor.Add(Doctor);

                db.SaveChanges();
                Session["psyD"] = addExaminer;
                Session["adminD"] = UserA;
                return Json(new { code = 0, data = new { User = User }, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
            }
            else
            {
                return Json(new { code = -1, msg = "账号已存在" }, JsonRequestBehavior.AllowGet);
            }
        }
        #endregion


        #region 重置密码
        public ActionResult sendReset(string tel, string password, string vcode)
        {
            if (Session["mobile_code"] == null || vcode != Session["mobile_code"].ToString())
            {
                return Json(new { code = -1, msg = "验证码错误" }, JsonRequestBehavior.AllowGet);
            }

            T_Admin User = db.T_Admin.Where(o => o.Tel == tel && !o.IsDelete).FirstOrDefault();
            if (User != null)
            {
                User.Password = password;           
                db.SaveChanges();

                T_Doctor Doctor = db.T_Doctor.Where(o => o.tel == tel && !o.isDelete).FirstOrDefault();               
                Doctor.Password = password;
                Doctor.ModifyTime = DateTime.Now;
                db.SaveChanges();

                Session["psyD"] = Doctor;
                Session["adminD"] = User;
                return Json(new { code = 0, data = new { User = User }, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
            }
            else
            {
                return Json(new { code = -1, msg = "账号不存在" }, JsonRequestBehavior.AllowGet);
            }
        }
        #endregion
    }
}
