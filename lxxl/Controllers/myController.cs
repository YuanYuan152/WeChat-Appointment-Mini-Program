using lxxl.Service;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Controllers
{
    public class myController : Controller
    {
        //
        // GET: /my/

        public ActionResult Index()
        {
            timerTask.SetScheduleNew();
            return View();
        }

        //
        // GET: /my/

        public ActionResult Index1()
        {
            return View();
        }

        //
        // GET: /my/

        public ActionResult Index2()
        {
            return View();
        }

        //
        // GET: /my/

        public ActionResult Index3()
        {
            return View();
        }

    }
}
