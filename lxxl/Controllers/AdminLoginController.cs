using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using lxxl.Models;
using Common.ValidateCode;

namespace lxxl.Controllers
{
    /// <summary>
    /// 管理员登陆控制器
    /// </summary>
    public class AdminLoginController : Controller
    {
        //
        // GET: /AdminLogin/
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
            T_Admin user = db.T_Admin.Where(o => o.UserName == userName && (o.Type == 1 || o.Type == 3 || o.Type == 4) && o.Password == userPwd && !o.IsDelete).FirstOrDefault();
            if (user != null)
            {
                Session["admin"] = user;
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
            return RedirectToAction("Index", "AdminLogin");
        }
        #endregion
    }
}
