using Base;
using lxxl.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Web.Script.Serialization;

namespace lxxl.Controllers
{
    public class userController : userBaseController
    {

        public TMLSContext db = new TMLSContext();
        public JavaScriptSerializer serializer = new JavaScriptSerializer();
        //
        // GET: /user/Index

        public ActionResult Index()
        {
            T_User User = Session["User"] as T_User;
            ViewBag.name = User.Name;
            return View();
        }

        //
        // GET: /main/welcome

        public ActionResult welcome()
        {
            T_User User = Session["User"] as T_User;
            ViewBag.name = User.Name;
            return View();
        }

        //
        // GET: /user/signUp

        public ActionResult signUp()
        {
            return View();
        }

        #region 文章列表
        // GET: /user/ContentLst

        public ActionResult ContentLst()
        {
            T_User User = Session["User"] as T_User;
            ViewBag.MenuID = User.ID;
            return View();
        }
        public ActionResult GetContentList(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                T_User User = Session["User"] as T_User;
                var aCourselistdb = db.T_Content.Where(o => !o.IsDelete && o.Type == 2 && o.userID == User.ID && o.Title.Contains(keyword)).ToList();
                int count = aCourselistdb.Count;
                var listdb = aCourselistdb.OrderBy(o => o.ID).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.Title,
                    o.Profile,
                    o.Source,
                    o.url,
                    time = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    o.IsTop,
                    o.IsShow,
                    o.Views
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion


        #region 新增文章
        public ActionResult AddContent(long MenuID = 0)
        {
            ViewBag.MenuID = MenuID;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult AddContent(string field = "")
        {
            try
            {
                T_User User = Session["User"] as T_User;
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                T_Content Content = serializer.Deserialize<T_Content>(field);
                if (Content.Backup == "on") { Content.IsTop = true; } else { Content.IsTop = false; }
                Content.MenuID = 1;
                Content.userID = User.ID;
                Content.Source = User.Name;
                T_Content addContent = db.T_Content.Add(Content);
                db.SaveChanges();
                return Json(new { code = 0, msg = "新增成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 编辑文章
        public ActionResult EditContent(long ID)
        {
            T_Content Content = db.T_Content.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            ViewBag.Content = Content;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult EditContent(string field = "")
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            T_Content Content = serializer.Deserialize<T_Content>(field);
            try
            {
                T_Content ho = db.T_Content.Where(o => o.ID == Content.ID).FirstOrDefault();
                ho.Title = Content.Title;
                ho.Profile = Content.Profile;
                ho.Source = Content.Source;
                ho.ContentMain = Content.ContentMain;
                ho.Profile = Content.Profile;
                ho.url = Content.url;
                if (Content.Backup == "on") { ho.IsTop = true; } else { ho.IsTop = false; }
                ho.IsShow = Content.IsShow;
                ho.ModifyTime = DateTime.Now;
                db.SaveChanges();
                return Json(new { code = 0, msg = "修改成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 删除文章
        public ActionResult DelContent(long ID)
        {
            try
            {
                T_Content ho = db.T_Content.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
                if (ho != null)
                {
                    ho.IsDelete = true;
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "删除成功" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    return Json(new { code = -1, msg = "删除失败" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 设置显示文章
        public ActionResult ShowContent(long ID, bool isShow = false)
        {
            try
            {
                T_Content ho = db.T_Content.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
                if (ho != null)
                {
                    ho.IsShow = isShow;
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "设置成功" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    return Json(new { code = -1, msg = "设置失败" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion



        #region 留言列表
        // GET: /main/MessageRecordLst

        public ActionResult MessageLst()
        {
            return View();
        }
        public ActionResult GetMessageLst(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var aCourselistdb = db.T_MessageRecord.Where(o => !o.IsDelete && o.name.Contains(keyword)).ToList();
                int count = aCourselistdb.Count;
                var listdb = aCourselistdb.OrderBy(o => o.ID).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.name,
                    o.Type,
                    o.mobile,
                    time = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    o.IsShow
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

    }
}
