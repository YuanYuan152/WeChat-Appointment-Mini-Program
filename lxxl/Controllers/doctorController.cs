using Base;
using lxxl.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Web;
using System.Web.Mvc;
using System.Web.Script.Serialization;

namespace lxxl.Controllers
{
    public class doctorController : doctorBaseController
    {
        public TMLSContext db = new TMLSContext();
        JavaScriptSerializer js = new JavaScriptSerializer();
        int pagesize = 100;

        //
        // GET: /User/

        public ActionResult Index()
        {
            return View();
        }

        //
        #region 个人中心
        public ActionResult UserCenter()
        {
            long UserID = (Session["patient"] as T_User).ID;
            ViewBag.User = db.T_Doctor.Where(o => o.ID == UserID).FirstOrDefault();
            return View();
        }
        #endregion

        #region 个人信息
        public ActionResult User()
        {
            long UserID = (Session["patient"] as T_User).ID;
            ViewBag.User = db.T_User.Where(o => o.ID == UserID).FirstOrDefault();
            return View();
        }
        #endregion

        #region 编辑个人信息
        public ActionResult EditUser()
        {
            long UserID = (Session["patient"] as T_User).ID;
            ViewBag.User = db.T_User.Where(o => o.ID == UserID).FirstOrDefault();
            return View();
        }

        [HttpPost]
        public ActionResult EditUser(T_User patient, List<string> language = null)
        {
            long UserID = (Session["patient"] as T_User).ID;
            T_User User = db.T_User.Where(o => o.ID == UserID).FirstOrDefault();
            User.Name = patient.Name;
            User.Sex = patient.Sex;
            User.Age = patient.Age;
            User.Tel = patient.Tel;
            User.Mail = patient.Mail;
            User.weight = patient.weight;
            User.height = patient.height;
            User.bloodType = patient.bloodType;
            User.Score = patient.Score;
            User.unionid = patient.unionid;
            User.waistCircumference = patient.waistCircumference;
            User.language = language == null ? "" : string.Join(",", language);
            User.insurance = patient.insurance;
            User.nationality = patient.nationality;
            //User.TopUrl = patient.TopUrl;
            db.SaveChanges();
            Session["patient"] = User;
            return Json(new { code = 0, msg = "提交成功" });

        }
        #endregion

        #region 上传头像
        public ActionResult UpTopUrl(string wximg = "")
        {
            string topurl = "/Content/Upload/UploadImg/" + GetMultimedia(Config.txl_token, wximg, "Content\\Upload\\UploadImg\\", ".jpg") + ".jpg";
            return Content("ok:" + topurl);
        }
        #endregion
        
        #region 下载微信资源
        /// <SUMMARY> 
        /// 下载保存多媒体文件,返回多媒体保存路径 
        /// </SUMMARY> 
        /// <PARAM name="ACCESS_TOKEN"></PARAM> 
        /// <PARAM name="MEDIA_ID"></PARAM> 
        /// <RETURNS></RETURNS> 
        public string GetMultimedia(string ACCESS_TOKEN, string MEDIA_ID, string Path, string Mtype)
        {
            string file = string.Empty;
            string content = string.Empty;
            string strpath = string.Empty;
            string savepath = string.Empty;
            string stUrl = "http://file.api.weixin.qq.com/cgi-bin/media/get?access_token=" + ACCESS_TOKEN + "&media_id=" + MEDIA_ID;
            HttpWebRequest req = (HttpWebRequest)HttpWebRequest.Create(stUrl);

            req.Method = "GET";
            using (WebResponse wr = req.GetResponse())
            {
                HttpWebResponse myResponse = (HttpWebResponse)req.GetResponse();

                strpath = myResponse.ResponseUri.ToString();
                WebClient mywebclient = new WebClient();//Server.MapPath("Images") + 
                string strPath = Server.MapPath("");
                strPath = strPath.Replace("User", Path);
                string name = DateTime.Now.ToString("yyyyMMddHHmmssfff") + (new Random()).Next().ToString().Substring(0, 4);
                savepath = strPath + name + Mtype;
                try
                {
                    mywebclient.DownloadFile(strpath, savepath);
                    file = name;
                }
                catch (Exception ex)
                {
                    savepath = ex.ToString();
                }
            }
            return file;
        }
        #endregion

        #region 我的预约
        public ActionResult myConsulation(short ordertype = 0)
        {
            long UserID = (Session["patient"] as T_User).ID;

            List<T_Consultation> ConsultationList = db.T_Consultation.Include("doctor").Where(o => o.UserID == UserID && !o.isDelete).OrderByDescending(o=>o.createTime).ToList();
            ViewBag.ConsultationList = ConsultationList;

            return View();
        }

        public ActionResult Consulation(string ordergid)
        {
            long doctorID = (Session["psyD"] as T_Doctor).ID;

            T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").SingleOrDefault(o => o.doctorID == doctorID && o.gId == ordergid && !o.isDelete);
            ViewBag.consultation = consultation;
            string ss = consultation.appointmentTime.ToString("yyyy-MM-dd HH:mm");
            ViewBag.getDate = consultation.appointmentTime.ToString("yyyy-MM-dd");
            ViewBag.gettime = consultation.appointmentTime.ToString("HH:mm");
            ViewBag.getendtime = consultation.eTime.ToString("HH:mm");
            T_SystemSettings systemSettings = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 1).FirstOrDefault();
            ViewBag.EndDay = DateTime.Now.AddDays((int)systemSettings.number).ToString("yyyy-MM-dd");
            ViewBag.time0 = DateTime.Now.AddDays(1).ToString("yyyy-MM-dd");
            if (consultation.State == 1 || consultation.State == 2)
            {
                return View("EditConsultation0");
            }
            return View();
        }
        #endregion



    }
}
