using Base;
using lxxl.Models;
using lxxl.Service;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Controllers
{
    public class expertsController : expertsBaseController
    {
        public TMLSContext db = new TMLSContext();
        //
        // GET: /we/

        public ActionResult Index()
        {
            ViewBag.BannerLst = CacheHelper.GetBannerList().Where(o => o.Type == 1).ToList();
            ViewBag.DoctorLst = CacheHelper.GetDoctorList();

            return View();
        }

        //
        // GET: /we/xy

        public ActionResult xy(int type = 1,string name = "", string money = "", string doctor = "")
        {            
            ViewBag.type = type;
            ViewBag.name = name;
            ViewBag.money = money;
            ViewBag.doctor = doctor;
            ViewBag.NowDate = DateTime.Now.ToString("yyyy年MM月dd日");
            if (type==1)
            {
                return View("xy1");
            }
            else
            {
                return View("xy2");
            }
            return View();
        }

       //
        // GET: /we/ConsultantLst

        public ActionResult ConsultantLst()
        {
            ViewBag.BannerLst = CacheHelper.GetBannerList().Where(o => o.Type == 1).ToList();
            ViewBag.DoctorLst = CacheHelper.GetDoctorList();

            return View();
        }

        //
        // GET: /we/ConsultantView

        public ActionResult ConsultantView(string id)
        {
            T_Doctor Doctor = db.T_Doctor.Where(o => o.gId == id && !o.isDelete).FirstOrDefault();
            ViewBag.Doctor = Doctor;
            DateTime startTime = DateTime.Now.AddDays(1);
            DateTime endTime = DateTime.Now.AddDays(31);
            List<T_DoctorSchedule> listdb = db.T_DoctorSchedule.Where(o => !o.isDelete && o.doctorID == Doctor.ID && o.startTime > startTime && o.startTime < endTime).OrderBy(o => o.startTime).ToList();
            //.Select(o => new
            //{
            //    o.ID,
            //    o.gId,
            //    o.Price,
            //    o.maxSign,
            //    o.numSign,
            //    startDate = o.startTime.ToString("yyyy-MM-dd"),
            //    startTime = o.startTime.ToString("yyyy-MM-dd HH:mm"),
            //    endTime = o.endTime.ToString("yyyy-MM-dd HH:mm"),
            //    createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
            //    week = o.getWeek(),
            //}).ToList();
            ViewBag.listdb = listdb;

            ViewBag.doctorID = Doctor.ID;
            return View();
        }

        public ActionResult getDoctor(long id)
        {
            T_Doctor doctor = db.T_Doctor.Where(o => o.ID == id && !o.isDelete).FirstOrDefault();
            return Json(new { code = 0, doctor = doctor, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
        }

        public ActionResult getPatient()
        {
            if (Session["patient"] == null)
            {
                if (Session["OpenID"] == null)
                {
                    return Json(new { code = -1, msg = "用户不存在",url="/WXLogin/Index?logintype=2" }, JsonRequestBehavior.AllowGet);
                }
                string openid = (string)Session["OpenID"];
                T_User pat1 = db.T_User.Where(o => o.OpenID == openid && !o.IsDelete).FirstOrDefault();
                if (pat1 == null){
                    return Json(new { code = -1, msg = "用户不存在", url = "/WXLogin/Index?logintype=2" }, JsonRequestBehavior.AllowGet);
                }
                Session["patient"] = pat1;
                return Json(new { code = 0, patient = pat1, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
            }

            T_User patient = Session["patient"] as T_User;
            return Json(new { code = 0, patient = patient, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
        }

        public ActionResult getDoctorSchedule(long id)
        {
            DateTime startTime = DateTime.Now.AddDays(1);
            DateTime endTime = DateTime.Now.AddDays(31);
            var doctorScheduleList = db.T_DoctorSchedule.Where(o => !o.isDelete && o.doctorID == id && o.numSign < o.maxSign && o.startTime > startTime && o.startTime < endTime).OrderBy(o => o.startTime).ToList().Select(o => new
            {
                o.ID,
                o.gId,
                o.Price,
                o.maxSign,
                o.numSign,
                startDate = o.startTime.ToString("yyyy-MM-dd"),
                startHH = o.startTime.ToString("HH:mm"),
                endHH = o.endTime.ToString("HH:mm"),
                startTime = o.startTime.ToString("yyyy-MM-dd HH:mm"),
                endTime = o.endTime.ToString("yyyy-MM-dd HH:mm"),
                createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
                time = (o.endTime - o.startTime).Hours == 0 ? "" : ((o.endTime - o.startTime).Hours + "小时") + ((o.endTime - o.startTime).Minutes == 0 ? "" : ((o.endTime - o.startTime).Minutes + "分钟")),
                week = o.getWeek(),
            }).ToList();

            return Json(new { code = 0, doctorScheduleList = doctorScheduleList, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
        }

        public ActionResult appointment(long doctorScheduleID, string xyID)
        {
            if (Session["patient"] == null)
            {
                return Json(new { code = -1, msg = "预约失败，请重新选择预约！", url="/WXLogin/Index?logintype=2" }, JsonRequestBehavior.AllowGet);
            }
            T_DoctorSchedule doctorSchedule = db.T_DoctorSchedule.SingleOrDefault(o => !o.isDelete && o.ID == doctorScheduleID);
            if (doctorSchedule == null)
            {
                return Json(new { code = -1, msg = "预约失败，请重新选择预约！" }, JsonRequestBehavior.AllowGet);
                
            }
            else
            {
                if (doctorSchedule.maxSign <= doctorSchedule.numSign)
                {
                    return Json(new { code = -1, msg = "该时间预约已满，请选择另外的时间预约！" }, JsonRequestBehavior.AllowGet);
                }

                doctorSchedule.numSign = doctorSchedule.numSign + 1;
                db.SaveChanges();
                
                T_User patient = Session["patient"] as T_User;
                T_Consultation Consulation = new T_Consultation(patient.ID, doctorSchedule.doctorID, doctorSchedule.Price,doctorSchedule.startTime);
                Consulation.TDoctorID = doctorScheduleID;
                Consulation.expectedTime = doctorSchedule.startTime.ToString("HH:mm") + "-" + doctorSchedule.endTime.ToString("HH:mm");
                Consulation.openid = xyID;
                Consulation.name = patient.Name;
                Consulation.tel = patient.Tel;
                Consulation.email = patient.Mail;
                Consulation.address = doctorSchedule.address;
                db.T_Consultation.Add(Consulation);
                db.SaveChanges();
                T_Order order = new T_Order(Consulation.createTime, patient.gId, 1, "预约咨询费", Consulation.gId, Consulation.PayCost, 0.0, "", 0, "", 1);
                order.overTime = doctorSchedule.endTime;
                db.T_Order.Add(order);
                db.SaveChanges();
                T_PayLog payLog = new T_PayLog(Consulation.gId, Consulation.PayCost, 1, 1, patient.OpenID);
                db.T_PayLog.Add(payLog);
                db.SaveChanges();

                return Json(new { code = 0, msg = "预约成功", url = "/TenPayV3/PublicPay?code=" + "lxxlcode" + "&state=" + patient.OpenID + "," + order.ordergId }, JsonRequestBehavior.AllowGet);
            }

            return Json(new { code = 0, msg = "成功" }, JsonRequestBehavior.AllowGet);
        }
        //
        // GET: /we/ConsultantViewO

        public ActionResult ConsultantViewO(string id)
        {
            T_Doctor Doctor = db.T_Doctor.Where(o => o.gId == id && !o.isDelete).FirstOrDefault();
            ViewBag.Doctor = Doctor;
            return View();
        }

        //
        // GET: /we/me

        public ActionResult me()
        {
            return View();
        }

    }
}
