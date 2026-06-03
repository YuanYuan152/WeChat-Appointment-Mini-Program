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
    public class PatientController : PatientBaseController
    {
        public TMLSContext db = new TMLSContext();
        JavaScriptSerializer js = new JavaScriptSerializer();
        int pagesize = 100;

        //
        // GET: /Patient/

        public ActionResult Index()
        {
            return View();
        }

        //
        #region 个人中心
        public ActionResult UserCenter()
        {
            long UserID = (Session["patient"] as T_User).ID;
            ViewBag.Patient = db.T_User.Where(o => o.ID == UserID).FirstOrDefault();
            return View();
        }
        #endregion

        #region 个人信息
        public ActionResult User()
        {
            long UserID = (Session["patient"] as T_User).ID;
            ViewBag.Patient = db.T_User.Where(o => o.ID == UserID).FirstOrDefault();
            return View();
        }
        #endregion

        #region 编辑个人信息
        public ActionResult EditUser()
        {
            long UserID = (Session["patient"] as T_User).ID;
            ViewBag.Patient = db.T_User.Where(o => o.ID == UserID).FirstOrDefault();
            return View();
        }

        [HttpPost]
        public ActionResult EditUser(T_User User, List<string> language = null)
        {
            long UserID = (Session["patient"] as T_User).ID;
            T_User Patient = db.T_User.Where(o => o.ID == UserID).FirstOrDefault();
            Patient.Name = User.Name;
            Patient.Sex = User.Sex;
            Patient.Age = User.Age;
            Patient.Tel = User.Tel;
            Patient.Mail = User.Mail;
            Patient.weight = User.weight;
            Patient.height = User.height;
            Patient.bloodType = User.bloodType;
            Patient.Score = User.Score;
            Patient.unionid = User.unionid;
            Patient.waistCircumference = User.waistCircumference;
            Patient.language = language == null ? "" : string.Join(",", language);
            Patient.insurance = User.insurance;
            Patient.nationality = User.nationality;
            //Patient.TopUrl = User.TopUrl;
            db.SaveChanges();
            Session["patient"] = Patient;
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
                strPath = strPath.Replace("Patient", Path);
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
            long UserID = (Session["patient"] as T_User).ID;

            T_Consultation Consultation = db.T_Consultation.Include("doctor").SingleOrDefault(o => o.UserID == UserID && o.gId == ordergid && !o.isDelete);
            ViewBag.Consultation = Consultation;

            List<T_MessageRecord> MessageRecord = db.T_MessageRecord.Where(o => !o.IsDelete && o.Backup == ordergid).ToList();

            ViewBag.MessageRecord = MessageRecord;
            return View();
        }
        #endregion

        #region 我的预约订单
        public ActionResult myOrder()
        {
            string usergId = (Session["patient"] as T_User).gId;

            List<T_Order> OrderList = db.T_Order.Where(o => o.usergId == usergId && !o.isDelete).OrderByDescending(o => o.createTime).ToList();
            ViewBag.OrderList = OrderList;

            return View();
        }
        public ActionResult Order(string ordergid)
        {
            string usergId = (Session["patient"] as T_User).gId;
            T_Order Order = db.T_Order.SingleOrDefault(o => o.usergId == usergId && o.gId == ordergid && !o.isDelete);
            ViewBag.Order = Order;
            T_Consultation Consultation = db.T_Consultation.Include("doctor").SingleOrDefault(o => o.gId == Order.ordergId && !o.isDelete);
            ViewBag.Consultation = Consultation;

            return View();
        }

        //补缴费
        public ActionResult appointment(string gid)
        {
            if (Session["patient"] == null)
            {
                return Json(new { code = -1, msg = "缴费失败，请重新选择预约！", url = "/WXLogin/Index?logintype=2" }, JsonRequestBehavior.AllowGet);
            }            

            T_User patient = Session["patient"] as T_User;

            T_Order order0 = db.T_Order.Where(o => o.gId == gid && !o.isDelete).FirstOrDefault();
            if (order0 != null)
            {
                return Json(new { code = 0, msg = "去付费", url = "/TenPayV3/PublicPay?code=" + "lxxlcode" + "&state=" + patient.OpenID + "," + (order0.Type==1?order0.ordergId:order0.gId) }, JsonRequestBehavior.AllowGet);
            }
            return Json(new { code = -1, msg = "失败" }, JsonRequestBehavior.AllowGet);
        }

        #endregion

        #region 我的预约
        public ActionResult notices()
        {
            long UserID = (Session["patient"] as T_User).ID;


            return View();
        }
        #endregion



        #region 上传用户协议
        [HttpPost]
        public ActionResult EditXY(string jiner, string name, string doctor, string img1, string img2)
        {
            T_User Patient = Session["patient"] as T_User;
            
            T_InfoData infoData = new T_InfoData();
            infoData.Type = 10;
            infoData.Source = doctor;
            infoData.Title = name;
            infoData.ContentMain = img1;
            if (!string.IsNullOrEmpty(img2))
            {
                infoData.url = img2;
            }
            infoData.Profile = Patient.Tel;
            infoData = db.T_InfoData.Add(infoData);
            db.SaveChanges();
            return Json(new { code = 0,id=infoData.ID, msg = "提交成功" });

        }
        #endregion

        #region 用户确定时间
        //用户确定时间
        // GET: /wapyy/consultationTimeByU
        public ActionResult consultationTimeByU(string id = "62cac0ee12d9401fa6e61d259f3c0157")
        {
            long UserID = (Session["patient"] as T_User).ID;
            T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.UserID == UserID && o.State == 2 && o.gId == id).FirstOrDefault();
            ViewBag.consultation = consultation;
            return View();
        }
        #endregion

        #region 用户确定预约时间
        [HttpPost]
        public ActionResult EditconsultationTimeByU(string gid)
        {
            try
            {
                T_User User = Session["patient"] as T_User;
                //string openid = (string)Session["useropenid"];
                if (User == null)
                {
                    return Json(new { code = -1, msg = "提交失败，请刷新页面" });
                }
                T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.State == 2 && o.gId == gid && o.UserID == User.ID).FirstOrDefault();
                if (consultation != null)
                {
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

        #region 用发送消息
        [HttpPost]
        public ActionResult btnSendMsg(string msg, long id = 0, string gid="")
        {
            long UserID = (Session["patient"] as T_User).ID;
            T_MessageRecord messageRecord = new T_MessageRecord(3, 4, UserID, msg);
            messageRecord.AssociatedUserID = id;
            messageRecord.Backup = gid;
            db.T_MessageRecord.Add(messageRecord);
            db.SaveChanges();

            return Json(new { code = 0, msg = "提交成功" });
        }
        #endregion
    }
}
