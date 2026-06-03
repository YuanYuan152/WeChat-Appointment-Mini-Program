using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using Base;
using lxxl.Models;
using lxxl.Service;

namespace btksh.Controllers
{
    public class jixinliController : Controller
    {
        //
        // GET: /jixinli/
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

            ViewBag.BannerLst = db.T_Banner.Where(o => !o.IsDelete && o.MenuID == 1 && o.Type == 1).OrderBy(o => o.ID).ToList();
            ViewBag.collegeLst = db.T_Banner.Where(o => !o.IsDelete && o.MenuID == 1 && o.Type == 12).OrderBy(o => o.ID).ToList();
            return View();
        }

    }
}
