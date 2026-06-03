using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using Base;
using lxxl.Models;

namespace lxxl.Controllers
{
    /// <summary>
    /// 前台控制器
    /// </summary>
    public class IndexController : IndexBaseController
    {
        //
        // GET: /Index/

        public TMLSContext db = new TMLSContext();
        public int pagesize = 8;
        public ActionResult Index()
        {
            return View();
        }

        #region 显示菜单
        public ActionResult Menu()
        {
            return View();
        }
        #endregion

        #region 新增菜单
        public ActionResult AddMenu(long menuid = 0)
        {
            ViewBag.menuid = menuid;
            return View();
        }

        [HttpPost]
        public ActionResult AddMenu(T_Menu Menu)
        {
            Menu.Show = string.IsNullOrEmpty(Request["Show"]) ? false : true;
            try
            {
                db.T_Menu.Add(Menu);
                db.SaveChanges();
                Service.Service.SetEditMenuTime();
                Session["alert"] = "新增菜单成功";
            }
            catch (Exception e)
            {
                Session["alert"] = "新增菜单失败";
            }
            return RedirectToAction("Menu", "Index");
        }
        #endregion

        #region 编辑菜单
        public ActionResult EditMenu(long ID)
        {
            T_Menu Menu = db.T_Menu.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            ViewBag.Menu = Menu;
            return View();
        }
        [HttpPost]
        public ActionResult EditMenu(T_Menu Menu)
        {
            try
            {
                T_Menu menu = db.T_Menu.Where(o => o.ID == Menu.ID).FirstOrDefault();
                menu.MenuName = Menu.MenuName;
                menu.MenuID = Menu.MenuID;
                menu.Show = string.IsNullOrEmpty(Request["Show"]) ? false : true;
                menu.OrderTag = Menu.OrderTag;
                menu.Type = Menu.Type;
                menu.URL = menu.Type == 3 ? Menu.URL : null;
                db.SaveChanges();
                Service.Service.SetEditMenuTime();
                Session["alert"] = "保存成功";
            }
            catch (Exception e)
            {
                Session["alert"] = "保存失败";
            }
            return RedirectToAction("Menu", "Index");
        }
        #endregion

        #region 删除菜单
        public ActionResult DelMenu(long ID)
        {
            T_Menu Menu = db.T_Menu.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            if (Menu != null)
            {
                Menu.IsDelete = true;
                db.SaveChanges();
                Session["alert"] = "删除成功";
                Service.Service.SetEditMenuTime();
            }
            else
                Session["alert"] = "该菜单不存在,删除失败";
            string hosturl = Request["hosturl"];
            return Redirect(string.IsNullOrEmpty(hosturl) ? "/Index/Menu" : hosturl);
        }
        #endregion

        #region 文章列表
        public ActionResult Content(int page = 1, long MenuID = 0)
        {
            List<T_Content> ContentList = new List<T_Content>();
            int count = 0;
            T_Admin Admin = Session["admin"] as T_Admin;
            if (MenuID == 0 && Admin.Type == 1)
            {
                ContentList = db.T_Content.Include("Menu").OrderByDescending(o => o.IsTop).ThenByDescending(o => o.ModifyTime).Where(o => !o.IsDelete && o.Menu.Type != 3).Skip((page - 1) * pagesize).Take(pagesize).ToList();
                count = db.T_Content.Where(o => !o.IsDelete && o.Menu.Type != 3).Count();
            }
            else
            {
                T_Menu Menu = (Session["Menu"] as List<T_Menu>).Where(o => o.ID == MenuID && !o.IsDelete).FirstOrDefault();
                if (Menu != null)
                {
                    //一级菜单
                    if (Menu.MenuID == 0)
                    {
                        List<T_Menu> MenuList = (Session["Menu"] as List<T_Menu>).Where(o => o.MenuID == Menu.ID && !o.IsDelete).ToList();
                        ContentList = db.T_Content.Include("Menu").OrderByDescending(o => o.IsTop).ThenByDescending(o => o.ModifyTime).Where(o => !o.IsDelete && (o.MenuID == Menu.ID || o.Menu.MenuID == Menu.ID) && o.Menu.Type != 3).Skip((page - 1) * pagesize).Take(pagesize).ToList();
                        count = db.T_Content.Where(o => !o.IsDelete && (o.MenuID == Menu.ID || o.Menu.MenuID == Menu.ID) && o.Menu.Type != 3).Count();
                    }
                    else//二级菜单
                    {
                        ContentList = db.T_Content.Include("Menu").OrderByDescending(o => o.IsTop).ThenByDescending(o => o.ModifyTime).Where(o => !o.IsDelete && o.MenuID == Menu.ID && o.Menu.Type != 3).Skip((page - 1) * pagesize).Take(pagesize).ToList();
                        count = db.T_Content.Where(o => !o.IsDelete && o.MenuID == Menu.ID && o.Menu.Type != 3).Count();
                    }
                }
            }
            ViewBag.urlcode = MenuID;
            ViewBag.ContentList = ContentList;
            ViewBag.ThisPage = page;
            ViewBag.Count = count;
            ViewBag.Pagesize = pagesize;
            return View();
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
        public ActionResult AddContent(T_Content Content)
        {
            Content.IsTop = string.IsNullOrEmpty(Request["IsTop"]) ? false : true;
            try
            {
                Session["alert"] = "新增文章成功";
                db.T_Content.Add(Content);
                db.SaveChanges();
            }
            catch (Exception e)
            {
                Session["alert"] = "新增文章失败";
            }
            T_Admin Admin = Session["Admin"] as T_Admin;
            return RedirectToAction("Content", "Index");
        }
        #endregion

        #region 编辑文章
        public ActionResult EditContent(long ID)
        {
            T_Content Content = db.T_Content.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            if (Content == null)
            {
                Session["alert"] = "该条记录不存在";
                return RedirectToAction("Content", "Index");
            }
            ViewBag.Content = Content;
            return View();
        }
        [HttpPost]
        [ValidateInput(false)]
        public ActionResult EditContent(T_Content Content)
        {
            try
            {
                T_Content content = db.T_Content.Where(o => o.ID == Content.ID).FirstOrDefault();
                content.IsTop = string.IsNullOrEmpty(Request["IsTop"]) ? false : true;
                content.Title = Content.Title;
                content.Source = Content.Source;
                content.Profile = Content.Profile;
                content.MenuID = Content.MenuID;
                content.ContentMain = Content.ContentMain;
                content.ModifyTime = Content.ModifyTime;
                db.SaveChanges();
                Session["alert"] = "保存成功";
            }
            catch (Exception e)
            {
                Session["alert"] = "保存失败";
            }
            return RedirectToAction("Content", "Index");
        }
        #endregion

        #region 删除文章
        public ActionResult DelContent(long ID)
        {
            T_Content Content = db.T_Content.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            if (Content != null)
            {
                Content.IsDelete = true;
                db.SaveChanges();
                Session["alert"] = "删除成功";
            }
            else
                Session["alert"] = "该数据不存在,删除失败";
            string hosturl = Request["hosturl"];
            return Redirect(string.IsNullOrEmpty(hosturl) ? "/Index/Content" : hosturl);
        }
        #endregion

        #region 管理员列表
        public ActionResult Admin(int page = 1)
        {
            List<T_Admin> AdminList = db.T_Admin.OrderBy(o => o.Name).ThenByDescending(o => o.CreateTime).Where(o => !o.IsDelete).Skip((page - 1) * pagesize).Take(pagesize).ToList();
            int count = db.T_Admin.Where(o => !o.IsDelete).Count();
            ViewBag.AdminList = AdminList;
            ViewBag.ThisPage = page;
            ViewBag.Count = count;
            ViewBag.Pagesize = pagesize;
            return View();
        }
        #endregion

        #region 新增管理员
        public ActionResult AddAdmin()
        {
            return View();
        }

        [HttpPost]
        public ActionResult AddAdmin(T_Admin Admin)
        {
            try
            {
                Session["alert"] = "新增管理员成功";
                db.T_Admin.Add(Admin);
                db.SaveChanges();
            }
            catch (Exception e)
            {
                Session["alert"] = "新增管理员失败";
            }
            return RedirectToAction("Admin", "Index");
        }
        #endregion

        #region 编辑管理员
        public ActionResult EditAdmin(long ID)
        {
            T_Admin Admin = db.T_Admin.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            if (Admin == null)
            {
                Session["alert"] = "该条记录不存在";
                return RedirectToAction("Admin", "Index");
            }
            ViewBag.Admin = Admin;
            return View();
        }

        [HttpPost]
        public ActionResult EditAdmin(T_Admin Admin)
        {
            try
            {
                T_Admin admin = db.T_Admin.Where(o => o.ID == Admin.ID).FirstOrDefault();
                admin.Password = Admin.Password;
                admin.Name = Admin.Name;
                admin.Mail = Admin.Mail;
                admin.Tel = Admin.Tel;
                admin.Type = Admin.Type;
                db.SaveChanges();
                Session["alert"] = "保存成功";
            }
            catch (Exception e)
            {
                Session["alert"] = "保存失败";
            }
            return RedirectToAction("Admin", "Index");
        }
        #endregion

        #region 删除管理员
        public ActionResult DelAdmin(long ID)
        {
            T_Admin Admin = db.T_Admin.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            if (Admin != null)
            {
                Admin.IsDelete = true;
                db.SaveChanges();
                Session["alert"] = "删除成功";
            }
            else
                Session["alert"] = "该数据不存在,删除失败";
            string hosturl = Request["hosturl"];
            return Redirect(string.IsNullOrEmpty(hosturl) ? "/Index/Admin" : hosturl);
        }
        #endregion

        #region 验证
        public ActionResult Vusername(string param, string name)
        {
            //管理员用户名
            if (name == "UserName" && db.T_Admin.Where(o => o.UserName == param && !o.IsDelete).Count() > 0)
            {
                return Content("用户名已存在");
            }
            //管理员密码
            else if (name == "PassWord")
            {
                T_Admin Admin = Session["admin"] as T_Admin;
                T_Admin admin = db.T_Admin.Where(o => o.ID == Admin.ID).FirstOrDefault();
                if (admin.Password != param)
                {
                    return Content("密码错误");
                }
                return Content("y");
            }
            else
            {
                return Content("y");
            }
        }
        #endregion

    }
}
