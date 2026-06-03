using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using Base;
using lxxl.Models;
using lxxl.Service;

namespace lxxl.Controllers
{
    /// <summary>
    /// 后台控制器
    /// </summary>
    public class HomeController : Controller
    {
        //
        // GET: /Home/
        public TMLSContext db = new TMLSContext();
        int pagesize = 10;
        public ActionResult Index()
        {            
            List<T_Content> ContentList = new List<T_Content>();
            long[] menuids = { 31, 32, 33, 34, 35, 36, 37 };
            foreach (var menuid in menuids)
            {
                ContentList.AddRange(db.T_Content.Include("Menu").OrderByDescending(o => o.IsTop).ThenByDescending(o => o.ModifyTime).Where(o => !o.IsDelete && o.MenuID == menuid).Take(6).ToList());
            }
            ViewBag.ContentList = ContentList;

            //ViewBag.BannerLst = db.T_Banner.Where(o => !o.IsDelete && o.MenuID == 1 && o.Type == 1).OrderBy(o => o.ID).ToList();
            ViewBag.BannerLst = CacheHelper.GetBannerList().Where(o => o.Type == 1).ToList();
            ViewBag.collegeLst = db.T_Banner.Where(o => !o.IsDelete && o.MenuID == 1 && o.Type == 12).OrderBy(o => o.ID).ToList();
            return View();
        }

        public ActionResult newsList(int type = 0, int page = 1, string keyword = "")
        {
            ViewBag.BannerLst = CacheHelper.GetBannerList().Where(o => o.Type == 1).ToList();
            List<T_Content> ContentList = CacheHelper.GetContentList();
            int count = ContentList.Where(o => !o.IsDelete && type==0?true:o.MenuID==type && o.Title.Contains(keyword)).Count();
            int papeCount = count / pagesize;
            if (count % pagesize > 0) { papeCount++; }
            if (page < 1) { page = 1; }
            if (page > papeCount) { page = papeCount; }
            ContentList = ContentList.Where(o => !o.IsDelete && type == 0 ? true : o.MenuID == type && o.MenuID == type && o.Title.Contains(keyword)).OrderByDescending(o => o.IsTop).ThenByDescending(o => o.CreateTime).Skip((page - 1) * pagesize).Take(pagesize).ToList();
            ViewBag.Search = keyword;
            ViewBag.type = type;
            ViewBag.ContentList = ContentList;
            ViewBag.ThisPage = page;
            ViewBag.Count = count;
            ViewBag.Pagesize = pagesize;
            ViewBag.sPage = page > 5 ? page - 5 : page;
            ViewBag.ePage = papeCount - page > 5 ? page + 5 : papeCount;
            return View();
        }

        public ActionResult knowledgeList(int type = 0, int page = 1, string keyword = "")
        {
            //List<T_Content> ContentList = db.T_Content.OrderByDescending(o => o.IsTop).ThenByDescending(o => o.ModifyTime).Where(o => !o.IsDelete && o.IsShow && o.Type == 2).ToList();
            //ViewBag.ContentList = ContentList;
            List<T_Content> ContentList = db.T_Content.OrderByDescending(o => o.IsTop).ThenByDescending(o => o.ModifyTime).Where(o => !o.IsDelete && o.IsShow && o.Type == 2 && o.Title.Contains(keyword)).ToList();
            int count = ContentList.Count();
            int papeCount = count / pagesize;
            if (count % pagesize > 0) { papeCount++; }
            if (page < 1) { page = 1; }
            if (page > papeCount) { page = papeCount; }
            ContentList = ContentList.Skip((page - 1) * pagesize).Take(pagesize).ToList();
            ViewBag.Search = keyword;
            ViewBag.type = type;
            ViewBag.ContentList = ContentList;
            ViewBag.ThisPage = page;
            ViewBag.Count = count;
            ViewBag.Pagesize = pagesize;
            ViewBag.sPage = page > 5 ? page - 5 : page;
            ViewBag.ePage = papeCount - page > 5 ? page + 5 : papeCount;
            return View();
        }

        public ActionResult newsDetail(long ID, int type = 1)
        {
            //List<T_Content> ContentList = new List<T_Content>();
            ViewBag.BannerLst = CacheHelper.GetBannerList().Where(o => o.Type == 1).ToList();
            ViewBag.type = type;
            T_Content Content = db.T_Content.Where(o => o.Type == type && o.ID == ID && o.IsShow && !o.IsDelete).FirstOrDefault();
            Content.Views = Content.Views + 1;
            db.SaveChanges();
            ViewBag.type = Content.MenuID;
            ViewBag.Content = Content;
            if (ID > 1)
            {
                ViewBag.preContent = db.T_Content.Where(o => o.Type == type && o.ID < ID && !o.IsDelete).OrderByDescending(o => o.ID).FirstOrDefault();
            }
            T_Content nextContent = db.T_Content.Where(o => o.Type == type && o.ID > ID && !o.IsDelete).OrderBy(o => o.ID).FirstOrDefault();
            if (nextContent != null) { ViewBag.nextContent = nextContent; }
            return View();
        }



        public ActionResult about()
        {
            return View();
        }

        public ActionResult consultantList(int type = 0, int page = 1, string keyword = "")
        {
            ViewBag.DoctorLst = CacheHelper.GetDoctorList();
            ViewBag.Search = keyword;
            ViewBag.type = type;            
            ViewBag.ThisPage = page;
            return View();
        }

        public ActionResult consultantDetail(string id, int type = 1)
        {
            T_Doctor Doctor = db.T_Doctor.Where(o => o.gId == id && !o.isDelete).FirstOrDefault();
            ViewBag.Doctor = Doctor;
            DateTime startTime = DateTime.Now.AddDays(1);
            DateTime endTime = DateTime.Now.AddDays(31);
            List<T_DoctorSchedule> listdb = db.T_DoctorSchedule.Where(o => !o.isDelete && o.doctorID == Doctor.ID && o.startTime > startTime && o.startTime < endTime).OrderBy(o => o.startTime).ToList();
            ViewBag.listdb = listdb;
            ViewBag.doctorID = Doctor.ID;
            return View();
        }

        public ActionResult examiner()
        {
            ViewBag.examinerLst = db.T_Banner.Where(o => o.MenuID == 2 && o.Type ==2).OrderBy(o => o.ID).ToList();
            ViewBag.examinerIBLst = db.T_Banner.Where(o => o.MenuID == 2 && o.Type == 21).OrderBy(o => o.ID).ToList();
            return View();
        }

        public ActionResult course()
        {
            return View();
        }

        public ActionResult improvement()
        {
            return View();
        }

        public ActionResult examination()
        {
            return View();
        }

        public ActionResult choice()
        {
            return View();
        }


        public ActionResult guide()
        {
            return View();
        }


        public ActionResult Case()
        {
            ViewBag.collegeLst = db.T_Banner.Where(o => o.MenuID == 1 && o.Type == 12).OrderBy(o => o.ID).ToList();
            return View();
        }

        public ActionResult download()
        {
            return View();
        }

        public ActionResult examiner2()
        {
            return View();
        }

        public ActionResult Menu(long ID, int page = 1)
        {
            List<T_Content> ContentList = new List<T_Content>();
            int count = 0;
            T_Menu Menu = (Session["Menu"] as List<T_Menu>).Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            if (Menu.Type == 3)
            {
                return Redirect(Menu.URL);
            }
            if (Menu.Type == 2)
            {
                T_Content Content = db.T_Content.OrderByDescending(o => o.IsTop).ThenByDescending(o => o.ModifyTime).Where(o => !o.IsDelete && o.MenuID == Menu.ID).FirstOrDefault();
                if (Content == null)
                {
                    //该菜单下无文章,此跳转无效
                    return RedirectToAction("Error", "Home", new { str = "该菜单下无内容" });
                }
                ViewBag.Content = Content;
                return View("MenuContent");
            }
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
            ViewBag.urlcode = ID;
            ViewBag.ContentList = ContentList;
            ViewBag.ThisPage = page;
            ViewBag.Count = count;
            ViewBag.Pagesize = pagesize;
            return View("ContentList");
        }

        public ActionResult Content(long ID)
        {
            ViewBag.Content = db.T_Content.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            return View();
        }

        public ActionResult Search(string keyword, int page = 1)
        {
            List<T_Content> ContentList = new List<T_Content>();
            int count = 0;
            ContentList = db.T_Content.OrderByDescending(o => o.IsTop).ThenByDescending(o => o.CreateTime).Where(o => !o.IsDelete && o.Title.Contains(keyword)).Skip((page - 1) * pagesize).Take(pagesize).ToList();
            count = db.T_Content.Where(o => !o.IsDelete && o.Title.Contains(keyword)).Count();
            ViewBag.Search = keyword;
            ViewBag.ContentList = ContentList;
            ViewBag.ThisPage = page;
            ViewBag.Count = count;
            ViewBag.Pagesize = pagesize;
            return View();
        }

        #region 新增留言
        [HttpPost]
        public ActionResult PostMessage(T_MessageRecord messageRecord)
        {
            try
            {
                if(string.IsNullOrEmpty(messageRecord.name))
                {
                    return Json(new { code = -1, msg = "请填写姓名。" });
                }
                else if (string.IsNullOrEmpty(messageRecord.mobile))
                {
                    return Json(new { code = -1, msg = "请填写手机号" });
                }
                db.T_MessageRecord.Add(messageRecord);
                db.SaveChanges();
                return Json(new { code = 1, msg = "提交成功，稍后将会有工作人员与您联系。" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

    }
}
