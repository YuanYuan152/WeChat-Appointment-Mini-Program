using Base;
using lxxl.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Controllers
{
    public class wapglController : mainBaseController
    {
        public TMLSContext db = new TMLSContext();

        //
        // GET: /wapgl/
        public ActionResult Index()
        {
            return View();
        }

        //
        // GET: /wapgl/Aconsultation
        public ActionResult Aconsultation()
        {
            return View();
        }

        //#region 确定时间
        ////确定时间
        //// GET: /wapgl/consultationTime
        //public ActionResult consultationTime(string id = "86640e34b01340a7801d285881bd26f5")
        //{
        //    T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.gId == id).FirstOrDefault();
        //    ViewBag.consultation = consultation;
        //    string ss = consultation.appointmentTime.ToString("yyyy-MM-dd HH:mm");
        //    ViewBag.getDate = consultation.appointmentTime.ToString("yyyy-MM-dd");
        //    ViewBag.gettime = consultation.appointmentTime.ToString("HH:mm");
        //    T_SystemSettings systemSettings = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 1).FirstOrDefault();
        //    ViewBag.EndDay = DateTime.Now.AddDays((int)systemSettings.number).ToString("yyyy-MM-dd");
        //    ViewBag.time0 = DateTime.Now.AddDays(1).ToString("yyyy-MM-dd");
        //    return View();
        //}
        //#endregion

        #region 填写咨询记录
        // GET: /wapgl/consultationRecord
        public ActionResult consultationRecord(string id = "86640e34b01340a7801d285881bd26f5")
        {
            //T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.state == 2 && o.gId == id).FirstOrDefault();
            //ViewBag.consultation = consultation;
            //int year = DateTime.Now.Year;
            //int year0 = year-1;
            //int month = DateTime.Now.Month;
            //if (month == 1) { ViewBag.year = new { year0, year }; ViewBag.year = new { year0, year }; }
            //string[] alist = db.T_Admin.Where(o => !o.isDelete && o.type == 2).Select(o => o.name).ToArray();
            //ViewBag.alist = alist;
            return View();
        }
        #endregion

        #region 咨询记录
        // GET: /wapgl/consultationa
        public ActionResult consultation(string id = "86640e34b01340a7801d285881bd26f5")
        {
            T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Include("Patient").Where(o => !o.isDelete && o.gId == id).FirstOrDefault();
            ViewBag.consultation = consultation;
            if(consultation.State == 1)
            {
                string ss = consultation.appointmentTime.ToString("yyyy-MM-dd HH:mm");
                ViewBag.getDate = consultation.appointmentTime.ToString("yyyy-MM-dd");
                ViewBag.gettime = consultation.appointmentTime.ToString("HH:mm");
                T_SystemSettings systemSettings = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 1).FirstOrDefault();
                ViewBag.EndDay = DateTime.Now.AddDays((int)systemSettings.number).ToString("yyyy-MM-dd");
                ViewBag.time0 = DateTime.Now.AddDays(1).ToString("yyyy-MM-dd");

                return View("consultationTime");
            }
            List<string> upfiles = new List<string>();
            List<string> upfilenames = new List<string>();
            List<string> uppics = new List<string>();
            if (!string.IsNullOrEmpty(consultation.upfile))
            {
                string[] alist = consultation.upfile.Split(',');
                string imgTypes = "gif,jpg,jpeg,png,bmp";
                foreach (string item in alist)
                {
                    string fileExt = System.IO.Path.GetExtension(item).ToLower();
                    if (Array.IndexOf(imgTypes.Split(','), fileExt.Substring(1).ToLower()) > -1)
                    {
                        uppics.Add(item);
                    }
                    else
                    {
                        upfiles.Add(item);
                        upfilenames.Add(item.Split('/')[3]);
                    }
                }
            }
            ViewBag.upfiles = upfiles;
            ViewBag.uppics = uppics;
            ViewBag.upfilenames = upfilenames;
            return View();
        }
        #endregion

        #region 咨询信息
        //咨询信息
        // GET: /wapgl/ConsultationLst
        public ActionResult ConsultationLst(short ordertype = 0)
        {
            //var alistdb = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.state).Select(o => new
            //{
            //    o.id,
            //    o.doctor,
            //    o.projectName,
            //    o.createTime,
            //    o.diseaseArea,
            //    o.content1,
            //    o.problems,
            //    o.expectedTime,
            //    o.remark,
            //}).ToList().Select(o => new
            //{
            //    o.id,
            //    name = o.doctor.name,
            //    tel = o.doctor.tel,
            //    email = o.doctor.email,
            //    o.projectName,
            //    createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
            //    hospital = o.doctor.hospital,
            //    department = o.doctor.department,
            //    position = o.doctor.position,
            //    o.diseaseArea,
            //    o.content1,
            //    o.problems,
            //    o.expectedTime,
            //    o.remark,
            //}).ToList();
            //List<T_Consultation> ConsultationList = null;//db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.state == ordertype).ToList();            
            //if (ordertype == 1)
            //{
            //    ConsultationList = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.state >= 1 && o.state <= 2).ToList();
            //}
            //else if (ordertype == 3)
            //{
            //    ConsultationList = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.state >= 3).OrderByDescending(o => o.cTime).ToList();
            //}
            //else
            //{
            //    ordertype = 0;
            //    ConsultationList = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.state == ordertype).ToList();
            //}
            //ViewBag.ConsultationList = ConsultationList;
            //ViewBag.ordertype = ordertype;
            return View();
        }
        #endregion
    }
}
