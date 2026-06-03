using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using lxxl.Models;
using Base;
using Common;

namespace lxxl.Controllers
{
    //模态框控制器,这个控制器内方法全部由模态框调用
    public class ModalRoleController : Base.mainBaseController//调用需登陆
    {
        //
        // GET: /Modal/
        public TMLSContext db = new TMLSContext();

        #region 修改密码
        public ActionResult SetPassword()
        {
            return View();
        }

        [HttpPost]
        public ActionResult SetPassword(string PassWord, string NewPassWord, string OldPassWord)
        {
            T_Admin Admin = Session["admin"] as T_Admin;
            T_Admin admin = db.T_Admin.Where(o => o.ID == Admin.ID).FirstOrDefault();
            if (NewPassWord != OldPassWord)
            {
                return Content("no:新密码与确认密码不一致");
            }
            else if (Admin.Password != PassWord)
            {
                return Content("no:密码错误");
            }
            else
            {
                admin.Password = NewPassWord;
                db.SaveChanges();
                return Content("ok:修改成功");
            }
        } 
        #endregion
    }
    public class ModalController : Controller//直接调用模态框
    {
        #region 模态框登陆
        public ActionResult Login()
        {
            return View();
        }
        #endregion

        #region 预览图片
        public ActionResult SeeImg(string ImgUrl)
        {
            ViewBag.ImgUrl = ImgUrl;
            return View();
        }
        #endregion

        #region 消息模态框
        /// <summary>
        /// 
        /// </summary>
        /// <param name="start">1.普通消息2.成功信息3.失败信息</param>
        /// <param name="msg">消息</param>
        /// <returns></returns>
        public ActionResult Msg(string msg, short start)
        {
            ViewBag.Start = start;
            ViewBag.Msg = msg;
            return View();
        }
        #endregion

        #region iframe框
        public ActionResult iframe(string url)
        {
            ViewBag.url = url;
            return View();
        }
        #endregion
    }
}
