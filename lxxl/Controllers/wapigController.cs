using Base;
using lxxl.Models;
using lxxl.Service;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Web.Script.Serialization;

namespace lxxl.Controllers
{
    public class wapigController : Controller
    {
        //
        // GET: /wapig/

        public ActionResult Index()
        {
            return View();
        }

        public TMLSContext db = new TMLSContext();
        JavaScriptSerializer serializer = new JavaScriptSerializer();

        #region 确定咨询预约时间
        [HttpPost]
        public ActionResult EditconsultationTime(string gid, string appointmentTime, double duration = 1.0, string remark = "")
        {
            try
            {
                string openid = (string)Session["useropenid"];
                if (string.IsNullOrEmpty(openid))
                {
                    openid = "openid";
                    // return Json(new { code = -1, msg = "提交失败，请刷新页面" });
                }
                T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.State == 1 && o.gId == gid).FirstOrDefault();
                if (consultation != null)
                {
                    DateTime tempTime = DateTime.Parse(appointmentTime);
                    consultation.SureTime = tempTime;
                    consultation.IsSure = true;
                    consultation.duration = duration;
                    consultation.expectedTime = tempTime.ToString("HH:mm") + "-" + tempTime.AddHours(duration).ToString("HH:mm");
                    consultation.updateTime = DateTime.Now;
                    consultation.handler = openid;
                    consultation.remark = remark;
                    consultation.State = 2;
                    db.SaveChanges();
                    lxxl.Service.WeiXinHelper.SendMsg1(consultation.doctor.openid, consultation.name, consultation.doctor.name, consultation.appointmentTime.ToString("yyyy-MM-dd HH:mm:ss"), "您有一条预约订单已确认，请查阅！", "/doctor/Consulation?ordergid=" + consultation.gId);
                    lxxl.Service.WeiXinHelper.SendMsg1(consultation.GetPatient().OpenID, consultation.name, consultation.doctor.name, tempTime.ToString("yyyy-MM-dd HH:mm:ss"), "您有一条预约订单已确认，请查阅！", "/doctor/Consulation?ordergid=" + consultation.gId);
                    return Json(new { code = 0, msg = "提交成功" });
                }
                else
                {
                    return Json(new { code = -1, msg = "提交失败" });
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 提交咨询数据
        [HttpPost]
        public ActionResult postConsultationRecord(string gid, string PIteam, string projectName, string projectSource, string cTime, string duration, string expert, string record, string upfile, string intention, bool isSend = false)
        {
            try
            {
                string openid = (string)Session["useropenid"];
                if (string.IsNullOrEmpty(openid))
                {
                    openid = "openid";
                    // return Json(new { code = -1, msg = "提交失败，请刷新页面" });
                }
                T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.State == 2 && o.gId == gid).FirstOrDefault();
                if (consultation != null)
                {
                    consultation.cTime = DateTime.Parse(cTime);
                    consultation.duration = double.Parse(duration);
                    consultation.updateTime = DateTime.Now;
                    consultation.handler = openid;
                    consultation.expert = expert;
                    consultation.record = record;
                    consultation.upfile = upfile;
                    consultation.State = 3;
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "提交成功" });
                }
                else
                {
                    return Json(new { code = -1, msg = "提交失败" });
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

    }
}
