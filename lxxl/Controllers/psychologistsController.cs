using Base;
using lxxl.Models;
using lxxl.Service;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Data.Entity.Validation;
using System.IO;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Web.Script.Serialization;

namespace lxxl.Controllers
{
    public class psychologistsController : psyBaseController
    {
        public TMLSContext db = new TMLSContext();
        //
        // GET: /psychologists/

        public ActionResult Index()
        {
            long doctorID = (Session["psyD"] as T_Doctor).ID;
            DateTime dateTime = DateTime.Now.Date;
            DateTime dateTime2 = DateTime.Now.AddDays(1).Date;
            int Record = db.T_ConsultationRecord.Where(o => !o.IsDelete && o.doctorID == doctorID).Count();
            int MessageRecord = db.T_MessageRecord.Where(o => !o.IsDelete && o.Type == 3 && o.AssociatedUserID == doctorID).Count();
            int Consultation = db.T_Consultation.Where(o => !o.isDelete && o.State >= 10 && o.doctorID == doctorID).Count();
            int ConsultationWWC = db.T_Consultation.Where(o => !o.isDelete && o.State >= 1 && o.State < 10 && o.State != -1 && o.doctorID == doctorID).Count();
            int dclRecord = db.T_MessageRecord.Where(o => !o.IsDelete && o.Type == 1 && o.AssociatedUserID == doctorID).Count();
            ViewBag.Record = Record;
            ViewBag.MessageRecord = MessageRecord;
            ViewBag.Consultation = Consultation;
            ViewBag.ConsultationWWC = ConsultationWWC;
            ViewBag.dclRecord = dclRecord;
            return View();
        }

        #region 编辑咨询师
        public ActionResult EditDoctor()
        {
            long ID = (Session["psyD"] as T_Doctor).ID;
            T_Doctor Doctor = db.T_Doctor.Where(o => o.ID == ID && !o.isDelete).FirstOrDefault();
            ViewBag.Doctor = Doctor;
            IList<T_ExamC> aCourselistdb = new List<T_ExamC>();
            var TEMP = db.T_Course.Where(o => !o.IsDelete).ToList();
            foreach (T_Course item in TEMP)
            {
                aCourselistdb.Add(new T_ExamC(item.ID, item.Name));
            }
            ViewBag.aCourselistdb = aCourselistdb;
            var Fieldlist = db.T_Field.Where(o => !o.IsDelete).ToList();
            ViewBag.Fieldlist = Fieldlist;

            var TargetGrouplist = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 2).ToList();
            ViewBag.TargetGrouplist = TargetGrouplist;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult EditDoctor(string field = "")
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            T_Doctor Examiner = serializer.Deserialize<T_Doctor>(field);
            try
            {
                JObject fieldS = JObject.Parse(field);
                T_Doctor ho = db.T_Doctor.Where(o => o.ID == Examiner.ID).FirstOrDefault();
                ho.name = Examiner.name;
                ho.tel = Examiner.tel;
                ho.Profile = Examiner.Profile;
                ho.url = Examiner.url;
                ho.introduce = Examiner.introduce;
                ho.sex = Examiner.sex;
                ho.Course = Examiner.Course == "其他" ? fieldS["qitaCourse"].ToString() : Examiner.Course;
                ho.Qualification = Examiner.Qualification;
                ho.age = Examiner.age;
                ho.Backup = Examiner.Backup;
                ho.Field = Examiner.Field;
                ho.Province = Examiner.Province;
                ho.City = Examiner.City;
                ho.Area = Examiner.Area;
                ho.ConsultHours = Examiner.ConsultHours;
                ho.WorkYears = Examiner.WorkYears;
                //ho.City = fieldS["province"].ToString() +"-"+ fieldS["city"].ToString() +"-"+ fieldS["area"].ToString();
                ho.Billing = Examiner.Billing;
                ho.Careerexperience = Examiner.Careerexperience;
                ho.TargetGroup = Examiner.TargetGroup;
                ho.Mode = Examiner.Mode;
                ho.Specialty = Examiner.Specialty;
                //if (Examiner.Backup == "on") { ho.IsTop = true; } else { ho.IsTop = false; }
                ho.ModifyTime = DateTime.Now;
                db.SaveChanges();

                // 使用新的缓存系统
                CacheHelper.ClearDoctorCache();

                return Json(new { code = 0, msg = "修改成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 预约咨询列表
        //
        // GET: /psychologists/consultationLst
        public ActionResult consultationLst()
        {            
            return View();
        }
        public ActionResult EditConsultation(long id)
        {
            T_Consultation TConsultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => o.ID == id && !o.isDelete).FirstOrDefault();
            ViewBag.TConsultation = TConsultation;
            return View();
        }

        //public ActionResult EditConsultation(string id)
        //{
        //    T_Consultation TConsultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => o.gId == id && o.state == 3 && !o.isDelete).FirstOrDefault();
        //    ViewBag.TConsultation = TConsultation;

        //    List<string> upfiles = new List<string>();
        //    List<string> upfilenames = new List<string>();
        //    List<string> uppics = new List<string>();
        //    if (!string.IsNullOrEmpty(TConsultation.upfile))
        //    {
        //        string[] alist = TConsultation.upfile.Split(',');
        //        string imgTypes = "gif,jpg,jpeg,png,bmp";
        //        foreach (string item in alist)
        //        {
        //            string fileExt = Path.GetExtension(item).ToLower();
        //            if (Array.IndexOf(imgTypes.Split(','), fileExt.Substring(1).ToLower()) > -1)
        //            {
        //                uppics.Add(item);
        //            }
        //            else
        //            {
        //                upfiles.Add(item);
        //                upfilenames.Add(item.Split('/')[3]);
        //            }
        //        }
        //    }
        //    ViewBag.upfiles = upfiles;
        //    ViewBag.uppics = uppics;
        //    ViewBag.upfilenames = upfilenames;
        //    return View();
        //}
        #endregion


        #region 编辑咨询
        public ActionResult EditConsultationTB(string id)
        {
            T_Consultation consultation = db.T_Consultation.Include("User").Include("doctor").Include("admin").Where(o => !o.isDelete && o.gId == id).FirstOrDefault();
            ViewBag.consultation = consultation;
            string ss = consultation.appointmentTime.ToString("yyyy-MM-dd HH:mm");
            ViewBag.getDate = consultation.appointmentTime.ToString("yyyy-MM-dd");
            ViewBag.gettime = consultation.appointmentTime.ToString("HH:mm");
            T_SystemSettings systemSettings = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 1).FirstOrDefault();
            ViewBag.EndDay = DateTime.Now.AddDays((int)systemSettings.number).ToString("yyyy-MM-dd");
            ViewBag.time0 = DateTime.Now.AddDays(1).ToString("yyyy-MM-dd");

            List<string> upfiles = new List<string>();
            List<string> upfilenames = new List<string>();
            List<string> uppics = new List<string>();
            if (!string.IsNullOrEmpty(consultation.upfile))
            {
                string[] alist = consultation.upfile.Split(',');
                string imgTypes = "gif,jpg,jpeg,png,bmp";
                foreach (string item in alist)
                {
                    string fileExt = Path.GetExtension(item).ToLower();
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

        [HttpPost]
        public ActionResult postConsultationRecord(string gid, string cTime, string duration, string record, string upfile, bool isguandan = false, string content1 = "", string problems = "", string remark = "")
        {
            try
            {
                T_Admin admin = Session["admin"] as T_Admin;
                if (admin == null)
                {
                    return Json(new { code = -1, msg = "提交失败，请刷新页面" });
                }
                T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.gId == gid).FirstOrDefault();
                if (consultation != null)
                {
                    consultation.cTime = DateTime.Parse(cTime);
                    consultation.duration = double.Parse(duration);
                    consultation.updateTime = DateTime.Now;
                    consultation.handler = admin.ID.ToString();
                    consultation.record = record;
                    consultation.upfile = upfile;
                    consultation.content1 = content1;
                    consultation.problems = problems;
                    consultation.remark = remark;
                    if (isguandan) { consultation.State = 5; } // 已关单
                    else
                    {
                        consultation.State = 4; // 已填报
                    }
                    db.SaveChanges();

                    return Json(new { code = 0, msg = "咨询单填报信息已完成。" });
                }
                else
                {
                    return Json(new { code = 0, msg = "提交失败" });
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion


        #region 编辑咨询
        public ActionResult EditConsultationDZ(string id)
        {
            T_Consultation consultation = db.T_Consultation.Include("User").Include("doctor").Include("admin").Where(o => !o.isDelete && o.gId == id).FirstOrDefault();
            ViewBag.consultation = consultation;
            string ss = consultation.appointmentTime.ToString("yyyy-MM-dd HH:mm");
            ViewBag.getDate = consultation.appointmentTime.ToString("yyyy-MM-dd");
            ViewBag.gettime = consultation.appointmentTime.ToString("HH:mm");
            T_SystemSettings systemSettings = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 1).FirstOrDefault();
            ViewBag.EndDay = DateTime.Now.AddDays((int)systemSettings.number).ToString("yyyy-MM-dd");
            ViewBag.time0 = DateTime.Now.AddDays(1).ToString("yyyy-MM-dd");
            
            List<T_SystemSettings> RoomList = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 12).ToList();
            ViewBag.RoomList = RoomList;

            return View();
        }

        [HttpPost]
        public ActionResult postConsultationDZ(string gid, string cTime, string duration, string address)
        {
            try
            {
                T_Admin admin = Session["adminD"] as T_Admin;
                if (admin == null)
                {
                    return Json(new { code = -1, msg = "提交失败，请刷新页面" });
                }
                T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.gId == gid).FirstOrDefault();
                if (consultation != null)
                {
                    consultation.cTime = DateTime.Parse(cTime);
                    consultation.duration = double.Parse(duration);
                    consultation.updateTime = DateTime.Now;
                    consultation.handler = admin.ID.ToString();
                    consultation.address = address;
                    
                    db.SaveChanges();

                    Service.WeiXinHelper.SendMsg1(consultation.User.OpenID, consultation.name, consultation.doctor.name, consultation.appointmentTime.ToString("yyyy-MM-dd HH:mm:ss"), "您有一条预约修改消息，请查阅！", "/Patient/Consulation?ordergid=" + consultation.gId);

                    return Json(new { code = 0, msg = "咨询信息已修改。" });
                }
                else
                {
                    return Json(new { code = 0, msg = "提交失败" });
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 获取预约咨询列表4
        public ActionResult GetConsultationList(int page = 1, int limit = 15, string keyword = "", string chooseDay="")
        {
            long ID = (Session["psyD"] as T_Doctor).ID;
            T_Doctor Doctor = db.T_Doctor.Where(o => o.ID == ID && !o.isDelete).FirstOrDefault();
            var alistdb = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.doctorID==ID && (o.doctor.name.Contains(keyword) || o.doctor.tel.Contains(keyword))).ToList();
            int count = alistdb.Count;
            var listdb = alistdb.OrderByDescending(o => o.appointmentTime).Skip((page - 1) * limit).Take(limit).Select(o => new
            {
                o.ID,
                o.gId,
                name = o.doctor.name,
                tel = o.doctor.tel,
                email = o.doctor.email,
                patientName = o.name,
                patientTel = o.tel,
                createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
                hospital = o.doctor.hospitalName,
                department = o.doctor.departmentName,
                position = o.doctor.position,
                o.content1,
                o.problems,
                o.expectedTime,
                o.remark,
                o.type,
                appointmentTime = o.appointmentTime.ToString("yyyy-MM-dd HH:mm"),
                o.handler,
                cTime = o.createTime == o.cTime?"":o.cTime.ToString("yyyy-MM-dd HH:mm"),
                o.duration,
                o.address,
                o.expert,
                o.record,
                o.upfile,
                o.IsSure,
                o.State,
                updateTime = o.updateTime.ToString("yyyy-MM-dd HH:mm"),
                StateDescription = o.GetStateDescription(),
                o.homeRenark
            }).ToList();
            return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
        }
        #endregion


        #region wap咨询信息
        public ActionResult EditConsultation0(string id)
        {
            T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.gId == id).FirstOrDefault();
            ViewBag.consultation = consultation;
            string ss = consultation.appointmentTime.ToString("yyyy-MM-dd HH:mm");
            ViewBag.getDate = consultation.appointmentTime.ToString("yyyy-MM-dd");
            ViewBag.gettime = consultation.appointmentTime.ToString("HH:mm");
            ViewBag.getendtime = consultation.eTime.ToString("HH:mm");
            T_SystemSettings systemSettings = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 1).FirstOrDefault();
            ViewBag.EndDay = DateTime.Now.AddDays((int)systemSettings.number).ToString("yyyy-MM-dd");
            ViewBag.time0 = DateTime.Now.AddDays(1).ToString("yyyy-MM-dd");
            return View();
        }

        //#region 确定时间
        ////确定时间
        //// GET: /psychologists/consultationTime
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

        //#region 填写咨询记录
        //// GET: /psychologists/consultationRecord
        //public ActionResult consultationRecord(string id = "86640e34b01340a7801d285881bd26f5")
        //{
        //    T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.State == 2 && o.gId == id).FirstOrDefault();
        //    ViewBag.consultation = consultation;
        //    string[] alist = db.T_Admin.Where(o => !o.IsDelete && o.Type == 2).Select(o =>o.Name).ToArray();
        //    ViewBag.alist = alist;
        //    return View();
        //}
        //#endregion

        //#region 咨询记录
        //// GET: /psychologists/consultationaRecord
        //public ActionResult consultationaRecord(string id = "86640e34b01340a7801d285881bd26f5")
        //{
        //    T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.State >= 3 && o.gId == id).FirstOrDefault();
        //    ViewBag.consultation = consultation;
        //    List<string> upfiles = new List<string>();
        //    List<string> upfilenames = new List<string>();
        //    List<string> uppics = new List<string>();
        //    if (!string.IsNullOrEmpty(consultation.upfile))
        //    {
        //        string[] alist = consultation.upfile.Split(',');
        //        string imgTypes = "gif,jpg,jpeg,png,bmp";
        //        foreach (string item in alist)
        //        {
        //            string fileExt = System.IO.Path.GetExtension(item).ToLower();
        //            if (Array.IndexOf(imgTypes.Split(','), fileExt.Substring(1).ToLower()) > -1)
        //            {
        //                uppics.Add(item);
        //            }
        //            else
        //            {
        //                upfiles.Add(item);
        //                upfilenames.Add(item.Split('/')[3]);
        //            }
        //        }
        //    }
        //    ViewBag.upfiles = upfiles;
        //    ViewBag.uppics = uppics;
        //    ViewBag.upfilenames = upfilenames;
        //    return View();
        //}
        //#endregion

        //#region 咨询信息
        ////咨询信息
        //// GET: /psychologists/ConsultationLst
        //public ActionResult ConsultationLst(short ordertype = 0)
        //{
        //    List<T_Consultation> ConsultationList = null;//db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.state == ordertype).ToList();            
        //    if(ordertype == 1)
        //    {
        //         ConsultationList = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.State >= 1 && o.State <= 2).ToList();
        //    }
        //    else if (ordertype == 3)
        //    {
        //        ConsultationList = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.State >= 3 ).OrderByDescending(o => o.cTime).ToList();
        //    }
        //    else
        //    {
        //        ordertype = 0;
        //        ConsultationList = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.State == ordertype).ToList();
        //    }
        //    ViewBag.ConsultationList = ConsultationList;
        //    ViewBag.ordertype = ordertype;
        //    return View();
        //}
        //#endregion
        #endregion



        #region 编辑个案记录表
        public ActionResult EditCaseRecord(string id)
        {
            T_CaseRecord CaseRecord = db.T_CaseRecord.Where(o => !o.isDelete && o.gId == id).OrderByDescending(o=>o.EditeTime).FirstOrDefault();
            if (CaseRecord == null) {CaseRecord= new T_CaseRecord(id);}
            ViewBag.CaseRecord = CaseRecord;

            T_Consultation consultation = db.T_Consultation.Include("User").Include("doctor").Include("admin").Where(o => !o.isDelete && o.gId == id).FirstOrDefault();
            ViewBag.consultation = consultation;

            List<string> upfiles = new List<string>();
            List<string> upfilenames = new List<string>();
            List<string> uppics = new List<string>();
            if (!string.IsNullOrEmpty(CaseRecord.upfile))
            {
                string[] alist = CaseRecord.upfile.Split(',');
                string imgTypes = "gif,jpg,jpeg,png,bmp";
                foreach (string item in alist)
                {
                    string fileExt = Path.GetExtension(item).ToLower();
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

        //不更新，直接插入一条记录
        [HttpPost]
        public ActionResult postCaseRecord(T_CaseRecord CaseRecord, string cTime, string duration)
        {
            try
            {
                T_CaseRecord updateCaseRecord = db.T_CaseRecord.Where(o => !o.isDelete && o.gId == CaseRecord.gId).OrderByDescending(o => o.EditeTime).FirstOrDefault();
                T_Consultation consultation = db.T_Consultation.FirstOrDefault(o => !o.isDelete && o.gId == CaseRecord.gId);
                if (updateCaseRecord != null)
                {
                    updateCaseRecord.IsSure = true;
                    updateCaseRecord.EditeTime = (short)(updateCaseRecord.EditeTime - 50);
                    CaseRecord.EditeTime = (short)(updateCaseRecord.EditeTime + 1);
                }
                CaseRecord.UserID = consultation.UserID;
                CaseRecord.DoctorID = consultation.doctorID;
                CaseRecord.ConsultationID = consultation.ID;
                CaseRecord.IsSure = true;
                db.T_CaseRecord.Add(CaseRecord);
                consultation.cTime = DateTime.Parse(cTime);
                consultation.duration = double.Parse(duration);
                consultation.updateTime = DateTime.Now;
                consultation.State = 10;
                db.SaveChanges();
                return Json(new { code = 0, msg = "心理咨询个案记录表提交成功。" });                
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }

        //更新
        [HttpPost]
        public ActionResult postCaseRecord00(T_CaseRecord CaseRecord, string cTime, string duration)
        {
            try
            {
                T_CaseRecord updateCaseRecord = db.T_CaseRecord.FirstOrDefault(o => !o.isDelete && o.gId == CaseRecord.gId);
                T_Consultation consultation = db.T_Consultation.FirstOrDefault(o => !o.isDelete && o.gId == CaseRecord.gId);
                if (updateCaseRecord == null) {
                    CaseRecord.UserID = consultation.UserID;
                    CaseRecord.DoctorID = consultation.doctorID;
                    CaseRecord.ConsultationID = consultation.ID;
                    CaseRecord.IsSure = true;
                    db.T_CaseRecord.Add(CaseRecord);
                }
                else
                {
                    updateCaseRecord.SubjectiveDescription = CaseRecord.SubjectiveDescription;
                    updateCaseRecord.ObjectiveDescription = CaseRecord.ObjectiveDescription;
                    updateCaseRecord.RiskLevelAssessment = CaseRecord.RiskLevelAssessment;
                    updateCaseRecord.ConsultationPoints = CaseRecord.ConsultationPoints;
                    updateCaseRecord.Item1X = CaseRecord.Item1X;
                    updateCaseRecord.Item1Other = CaseRecord.Item1Other;
                    updateCaseRecord.Item2X = CaseRecord.Item2X;
                    updateCaseRecord.Item2Other = CaseRecord.Item2Other;
                    updateCaseRecord.Item3X = CaseRecord.Item3X;
                    updateCaseRecord.Item3Other = CaseRecord.Item3Other;
                    updateCaseRecord.Item4X = CaseRecord.Item4X;
                    updateCaseRecord.Item4Other = CaseRecord.Item4Other;
                    updateCaseRecord.Item5X = CaseRecord.Item5X;
                    updateCaseRecord.Item5Other = CaseRecord.Item5Other;
                    updateCaseRecord.Item6X = CaseRecord.Item6X;
                    updateCaseRecord.Item6Other = CaseRecord.Item6Other;
                    updateCaseRecord.Item7X = CaseRecord.Item7X;
                    updateCaseRecord.Item7Other = CaseRecord.Item7Other;
                    updateCaseRecord.Item8X = CaseRecord.Item8X;
                    updateCaseRecord.Item8Other = CaseRecord.Item8Other;
                    updateCaseRecord.Item9X = CaseRecord.Item9X;
                    updateCaseRecord.Item9Other = CaseRecord.Item9Other;
                    updateCaseRecord.ItemX = CaseRecord.ItemX;
                    updateCaseRecord.ItemOther = CaseRecord.ItemOther;
                    updateCaseRecord.upfile = CaseRecord.upfile;

                    updateCaseRecord.EditeTime = (short)(updateCaseRecord.EditeTime + 1);
                    updateCaseRecord.updateTime = DateTime.Now;
                }
                consultation.cTime = DateTime.Parse(cTime);
                consultation.duration = double.Parse(duration);
                consultation.updateTime = DateTime.Now;
                consultation.State = 10;
                db.SaveChanges();
                return Json(new { code = 0, msg = "心理咨询个案记录表提交成功。" });
                //T_Admin admin = Session["adminD"] as T_Admin;

                //if (admin == null)
                //{
                    return Json(new { code = -1, msg = "提交失败，请刷新页面" });
                //}
                //T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.gId == gid).FirstOrDefault();
                //if (consultation != null)
                //{
                //    consultation.cTime = DateTime.Parse(cTime);
                //    consultation.duration = double.Parse(duration);
                //    consultation.updateTime = DateTime.Now;
                //    consultation.handler = admin.ID.ToString();
                //    consultation.record = record;
                //    consultation.upfile = upfile;
                //    consultation.content1 = content1;
                //    consultation.problems = problems;
                //    consultation.remark = remark;
                //    if (isguandan) { consultation.State = 4; }
                //    else
                //    {
                //        consultation.State = 3;
                //    }
                //    db.SaveChanges();

                //    return Json(new { code = 0, msg = "咨询单填报信息已完成。" });
                //}
                //else
                //{
                //    return Json(new { code = 0, msg = "提交失败" });
                //}
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }

        //更新
        [HttpPost]
        public ActionResult CaseRecordQC(string gId)
        {
            try
            {
                T_CaseRecord updateCaseRecord = db.T_CaseRecord.Where(o => !o.isDelete && o.gId == gId).OrderByDescending(o => o.EditeTime).FirstOrDefault();
                updateCaseRecord.IsSure = false;
                updateCaseRecord.EditeTime = (short)(updateCaseRecord.EditeTime + 50);
                db.SaveChanges();
                return Json(new { code = 0, msg = "心理咨询个案记录表修改申请成功，请等待审核。" });
             }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion



        #region 补缴费
        public ActionResult addOrder(string id)
        {
            T_Consultation consultation = db.T_Consultation.Include("User").Include("doctor").Where(o => !o.isDelete && o.gId == id).FirstOrDefault();
            ViewBag.consultation = consultation;

            return View();
        }


        [HttpPost]
        public ActionResult postAddOrder(string gid, double money, string remark = "")
        {
            try
            {
                DateTime time = DateTime.Now;
                T_Consultation consultation = db.T_Consultation.Include("User").FirstOrDefault(o => !o.isDelete && o.gId == gid);
                T_Order order0 = db.T_Order.Where(o => o.ordergId == gid && o.Type == 2 && o.State==0 && !o.isDelete).FirstOrDefault();
                if (order0 != null)
                {
                    order0.useTime = time;
                    order0.Money = money;
                    T_PayLog unpay = db.T_PayLog.Where(o => o.orderGId == order0.gId && !o.isDelete).FirstOrDefault();
                    unpay.Money = money;
                    db.SaveChanges();
                }
                else
                {
                    T_Order order = new T_Order(time, consultation.User.gId, 2, "补缴咨询费", consultation.gId, money, 0.0, "", 0, "", 1);
                    order.overTime = consultation.eTime;
                    db.T_Order.Add(order);
                    db.SaveChanges();
                    T_PayLog payLog = new T_PayLog(order.gId, money, 1, 1, consultation.User.OpenID);
                    db.T_PayLog.Add(payLog);
                    db.SaveChanges();
                }
                //T_Order order = new T_Order(time, consultation.User.gId, 2, "补缴咨询费", consultation.gId, money, 0.0, "", 0, "", 1);
                //order.overTime = consultation.eTime;
                //db.T_Order.Add(order);
                //db.SaveChanges();
                //T_PayLog payLog = new T_PayLog(order.gId, money, 1, 1, consultation.User.OpenID);
                //db.T_PayLog.Add(payLog);
                //db.SaveChanges();
                return Json(new { code = 0, msg = "补缴费提交成功，请提醒用户及时缴费。" });
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion


        #region 来访者列表
        // GET: /psychologists/ConsultationRecordLst

        public ActionResult MyConsultationRecordLst()
        {
            return View();
        }
        public ActionResult GetMyConsultationRecordList(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                long ID = (Session["psyD"] as T_Doctor).ID;
                var alistdb = db.T_ConsultationRecord.Include("User").Where(o => !o.IsDelete && !o.IsShow && o.doctorID == ID && (o.name.Contains(keyword) || o.User.Tel.Contains(keyword))).ToList();
                int count = alistdb.Count;
                var listdb = alistdb.OrderByDescending(o => o.CreateTime).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.UserID,
                    formSum = db.T_SubUser.Count(s => s.UserID == o.UserID),
                    o.ID,
                    patientName = o.name,
                    //patientTel = o.User.Tel,
                    createTime = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    IsTop = o.IsTop,
                    record = o.record,
                    Frequency = o.Frequency,
                    ConsultationIDs = o.ConsultationIDs,
                    records = db.T_Consultation.Where(r => !r.isDelete && r.UserID == o.UserID && r.doctorID == o.doctorID).ToList().Select(r => new
                    {
                        r.ID,
                        //tel = r.tel,
                        createTime = r.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
                        appointmentTime = r.appointmentTime.ToString("yyyy-MM-dd HH:mm"),
                        r.duration,
                        r.PayCost,
                        cTime = r.createTime == r.cTime ? "" : r.cTime.ToString("yyyy-MM-dd HH:mm"),
                        State = r.State,
                        StateDescription = r.GetStateDescription()

                    }).OrderBy(r => r.appointmentTime).ToArray(),
                    djbcount = db.T_RegistrationForm.Count(r => !r.IsDelete && r.UserID == o.UserID),
                    djb = db.T_RegistrationForm.Where(r => !r.IsDelete && r.UserID == o.UserID).Select(r => r.gId).ToList()
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion


        #region 编辑 来访者
        public ActionResult EditConsultationRecord(long Id)
        {
            T_ConsultationRecord ConsultationRecord = db.T_ConsultationRecord.Where(o => o.ID == Id && !o.IsDelete).FirstOrDefault();
            ViewBag.ConsultationRecord = ConsultationRecord;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult EditConsultationRecord2(string field = "")
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            T_ConsultationRecord ConsultationRecord = serializer.Deserialize<T_ConsultationRecord>(field);
            try
            {
                T_ConsultationRecord ho = db.T_ConsultationRecord.Where(o => o.ID == ConsultationRecord.ID).FirstOrDefault();
                if (ho != null)
                {
                    ho.record = ConsultationRecord.record;
                    ho.name = ConsultationRecord.name;
                    ho.mobile = ConsultationRecord.mobile;
                    ho.Remark1 = ConsultationRecord.Remark1;
                    ho.IsShow = ConsultationRecord.IsShow;
                    ho.ModifyTime = DateTime.Now;
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "修改成功" }, JsonRequestBehavior.AllowGet);
                }

                return Json(new { code = 0, msg = "修改失败" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 来访者结案
        public ActionResult ConsultationRecordShow(long Id)
        {
            try
            {
                T_ConsultationRecord ho = db.T_ConsultationRecord.Where(o => o.ID == Id && !o.IsDelete).FirstOrDefault();
                if (ho != null)
                {
                    ho.IsShow = true;
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "结案成功" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    return Json(new { code = -1, msg = "结案失败" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion


        #region 日历
        // GET: /psychologists/dateCalendar
        public ActionResult MyDateCalendar()
        {
            ViewBag.doctorID = (Session["psyD"] as T_Doctor).ID;
            List<T_SystemSettings> roomList = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 12).ToList();
            ViewBag.roomList = roomList;

            return View();
        }
        #endregion

        #region 可预约时间，咨询师需要自己排期
        // GET: /psychologists/ScheduleLst

        public ActionResult MyScheduleLst()
        {
            ViewBag.doctorID = (Session["psyD"] as T_Doctor).ID;
            return View();
        }
        public ActionResult GetScheduleList(long ID, int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                DateTime dateTime = DateTime.Now;
                var aCourselistdb = db.T_DoctorSchedule.Where(o => !o.isDelete && o.doctorID == ID && o.startTime >= dateTime && o.numSign==0).ToList();
                int count = aCourselistdb.Count;
                var listdb = aCourselistdb.OrderByDescending(o => o.startTime).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.gId,
                    o.Price,
                    o.maxSign,
                    o.methods,
                    o.address,
                    startTime = o.startTime.ToString("yyyy-MM-dd HH:mm"),
                    endTime = o.endTime.ToString("yyyy-MM-dd HH:mm"),
                    createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    week = o.getWeek(),
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion


        #region 新增 咨询师时间
        public ActionResult AddSchedule(long ID)
        {
            ViewBag.doctorID = ID;
            List<T_SystemSettings> RoomList = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 12).ToList();
            ViewBag.RoomList = RoomList;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult AddSchedule(string field = "")
        {
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                T_DoctorClassSchedule doctorClassSchedule = serializer.Deserialize<T_DoctorClassSchedule>(field);
                string[] startH = doctorClassSchedule.startH.Split(':');
                int startH1 = int.Parse(startH[0]);
                int startH2 = int.Parse(startH[1]);
                string[] endH = doctorClassSchedule.endH.Split(':');
                int endH1 = int.Parse(endH[0]);
                int endH2 = int.Parse(endH[1]);
                DateTime time1 = doctorClassSchedule.startTime.AddHours(startH1).AddMinutes(startH2);
                DateTime time2 = doctorClassSchedule.startTime.AddHours(endH1).AddMinutes(endH2);
                T_DoctorSchedule temp = db.T_DoctorSchedule.SingleOrDefault(o => !o.isDelete && o.doctorID == doctorClassSchedule.doctorID && o.startTime == time1 && o.endTime == time2);
                if (temp == null)
                {
                    T_DoctorSchedule DoctorSchedule = new T_DoctorSchedule(doctorClassSchedule.doctorID, time1, time2, doctorClassSchedule.maxSign, doctorClassSchedule.Price, "");
                    DoctorSchedule.week = ((int)time1.DayOfWeek).ToString();
                    DoctorSchedule.address = doctorClassSchedule.address;
                    DoctorSchedule.methods = doctorClassSchedule.methods;
                    db.T_DoctorSchedule.Add(DoctorSchedule);
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "新增咨询时间成功" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    return Json(new { code = -1, msg = "该时间已存在" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 编辑 咨询师时间
        public ActionResult EditSchedule(string gId)
        {
            T_DoctorSchedule DoctorSchedule = db.T_DoctorSchedule.Where(o => o.gId == gId && !o.isDelete).FirstOrDefault();
            ViewBag.DoctorSchedule = DoctorSchedule;
            List<T_SystemSettings> RoomList = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 12).ToList();
            ViewBag.RoomList = RoomList;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult EditSchedule2(string field = "")
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            T_DoctorSchedule DoctorSchedule = serializer.Deserialize<T_DoctorSchedule>(field);
            try
            {
                if (DoctorSchedule.startTime > DoctorSchedule.endTime)
                {
                    return Json(new { code = -1, msg = "时间设置不正确，请检查！" });
                }
                T_DoctorSchedule ho = db.T_DoctorSchedule.Where(o => o.ID == DoctorSchedule.ID).FirstOrDefault();
                if (ho != null)
                {
                    ho.ModifyTime = DateTime.Now;
                    ho.endTime = DoctorSchedule.endTime;
                    ho.startTime = DoctorSchedule.startTime;
                    //ho.maxSign = DoctorSchedule.maxSign;
                    ho.Price = DoctorSchedule.Price;
                    ho.address = DoctorSchedule.address;
                    ho.methods = DoctorSchedule.methods;
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "修改成功" }, JsonRequestBehavior.AllowGet);
                }

                return Json(new { code = 0, msg = "修改失败" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 删除时间
        public ActionResult DelSchedule(string gId)
        {
            try
            {
                T_DoctorSchedule ho = db.T_DoctorSchedule.Where(o => o.gId == gId && !o.isDelete).FirstOrDefault();
                if (ho != null)
                {
                    ho.isDelete = true;
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

        #region 来访者登记表
        // GET: /main/registrationForm
        public ActionResult registrationForm(string id)
        {
            T_RegistrationForm RegistrationForm = db.T_RegistrationForm.FirstOrDefault(o => o.gId == id);
            if (RegistrationForm == null)
            {

            }

            ViewBag.RegistrationForm = RegistrationForm;

            var Fieldlist = db.T_Field.Where(o => !o.IsDelete).ToList();
            ViewBag.Fieldlist = Fieldlist;

            return View();
        }
        #endregion

        #region 咨询预约登记
        public ActionResult wenjuanZY(string id)
        {
            ViewBag.gId = id;
            return View();
        }

        public ActionResult SubmitInfoZY(long gId)
        {
            var SubUser = db.T_SubUser.Where(s => s.UserID == gId).OrderByDescending(o => o.SubTime).FirstOrDefault();

            if (SubUser == null)
            {
                return Json(new { code = -1, msg = "获取失败" }, JsonRequestBehavior.AllowGet);
            };
            var Action = db.T_Action.Where(o => o.ID == SubUser.ActionID && !o.IsDelete).Select(o => new
            {
                ID = o.ID,
                Name = o.Name,
                FormID = o.FormID
            }).FirstOrDefault();
            var Form = db.T_Form.Where(o => o.gId == Action.FormID && !o.IsDelete).Select(o => new
            {
                ID = o.ID,
                Name = o.Name,
                Info = o.Info,
                CreateTime = o.CreateTime,
                Remark = o.Remark,
            }).FirstOrDefault();
            
            long[] itemS= {2,41};
            long[] optionS= {2,161};
            var SubFormData = db.T_SubUserData.Where(o => o.SubUserID == SubUser.ID && !optionS.Contains(o.OptionID)).Select(sf => new { SubFormID = sf.SubUserID, OptionID = sf.OptionID, Content = sf.Content }).ToList();
            var Item = db.T_Item.Include("Option").Include("ItemType").Where(o => o.FormID == Form.ID && !o.IsDelete && !itemS.Contains(o.ID)).OrderBy(o => o.Order).Select(o => new
            {
                ID = o.ID,
                Name = o.Name,
                Info = o.Info,
                Order = o.Order,
                Remark = o.Remark,
                FormID = o.FormID,
                ItemTypeID = o.ItemTypeID,
                ItemType = o.ItemType,
                Option = o.Option.Where(op => !op.IsDelete).OrderBy(op => op.Order),
            }).ToList();
            JsonSerializerSettings setting = new JsonSerializerSettings()
            {
                ReferenceLoopHandling = ReferenceLoopHandling.Ignore
            };
            var ret = JsonConvert.SerializeObject(SubUser, setting);
            return Json(new { code = 1, data = new { Action = Action, Form = Form, Item = Item, SubForm = SubFormData }, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
        }


        #endregion
    }
}
