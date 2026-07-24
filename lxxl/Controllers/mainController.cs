using Base;
using lxxl.Models;
using lxxl.Service;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Senparc.Weixin.MP.AppStore;
using System;
using System.Collections.Generic;
using System.Data.Entity.Validation;
using System.IO;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Web.Script.Serialization;
using System.Xml.Linq;

namespace lxxl.Controllers
{
    public class mainController : mainBaseController
    {
        public TMLSContext db = new TMLSContext();
        //
        // GET: /main/

        public ActionResult Index()
        {
            T_Admin user = Session["admin"] as T_Admin;
            if(user.Type ==3){
                return View("IndexAssistant");
            }
            else if (user.Type == 4)
            {
                return View("IndexSCYY");
            }
            return View();
        }

        //
        // GET: /main/oneset

        public ActionResult oneset()
        {
            T_Admin user = Session["admin"] as T_Admin;
            T_Admin userT = db.T_Admin.FirstOrDefault(o => o.ID == user.ID);
            ViewBag.userT = userT;

            return View();
        }

        #region 编辑用户
        public ActionResult EditOne(string field = "")
        {
            try
            {
                JObject jsonObject = JObject.Parse(field);
                T_Admin admin = Session["admin"] as T_Admin;
                T_Admin userT = db.T_Admin.FirstOrDefault(o => o.ID == admin.ID);
                if (userT != null)
                {
                    if (!string.IsNullOrEmpty(jsonObject["newpassword"].ToString()))
                    {
                        if (jsonObject["password"].ToString() != userT.Password)
                        {
                            return Json(new { code = -1, msg = "密码不正确，修改失败" }, JsonRequestBehavior.AllowGet);
                        }
                        userT.Password = jsonObject["newpassword"].ToString();
                    }
                    userT.Name = jsonObject["Name"].ToString();
                    userT.Tel = jsonObject["Tel"].ToString();
                    userT.Mail = jsonObject["Mail"].ToString();
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "修改成功" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    return Json(new { code = -1, msg = "修改失败" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        //
        // GET: /main/welcome

        public ActionResult welcome()
        {
            DateTime dateTime = DateTime.Now.Date;
            DateTime dateTime2 = DateTime.Now.AddDays(1).Date;
            int TodayConsultation = db.T_Consultation.Where(o => !o.isDelete && o.appointmentTime > dateTime && o.appointmentTime <= dateTime2 && o.State == 2).Count();
            int Consultation = db.T_Consultation.Where(o => !o.isDelete && o.State >= 10).Count();
            int ConsultationWWC = db.T_Consultation.Where(o => !o.isDelete && o.State >= 1 && o.State < 10 && o.State != -1).Count();
            ViewBag.TodayConsultation = TodayConsultation;
            ViewBag.Consultation = Consultation;
            ViewBag.ConsultationWWC = ConsultationWWC;

            int MessageRecord = db.T_MessageRecord.Where(o => !o.IsDelete && o.Type == 3).Count();
            int dclRecord = db.T_MessageRecord.Where(o => !o.IsDelete && o.Type == 1).Count();
            ViewBag.MessageRecord = MessageRecord;
            ViewBag.dclRecord = dclRecord;
            return View();
        }


        #region 管理员列表
        // GET: /main/adminLst
        public ActionResult adminLst()
        {
            return View();
        }

        public ActionResult GetAdminList(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var alistdb = db.T_Admin.Where(o => !o.IsDelete && (o.Name.Contains(keyword) || o.UserName.Contains(keyword))).Select(o => new
                {
                    o.ID,
                    o.UserName,
                    o.Password,
                    o.Name,
                    o.CreateTime,
                    o.Tel,
                    o.Type
                }).ToList();
                int count = alistdb.Count;
                var listdb = alistdb.OrderBy(o => o.ID).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.UserName,
                    o.Password,
                    o.Name,
                    time = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    o.Tel,
                    type = o.Type == 1 ? "超级管理员" : o.Type == 2 ? "咨询师" : o.Type == 3 ? "咨询助理" : o.Type == 4 ? "运营" : "其他"
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 新增管理员
        public ActionResult AddAdmin()
        {
            return View();
        }

        [HttpPost]
        public ActionResult AddAdmin(string field = "")
        {
            try
            {
                JObject jsonObject = JObject.Parse(field);
                string username = jsonObject["username"].ToString();
                var ho = db.T_Admin.Where(o => !o.IsDelete && o.UserName == username).FirstOrDefault();
                //JObject jsonObject = JObject.Parse(field);
                if (ho != null)
                {
                    return Json(new { code = -1, msg = "该用户名已存在" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    T_Admin newAdmin = new T_Admin(username, jsonObject["pass"].ToString(), short.Parse(jsonObject["interest"].ToString()), username);
                    newAdmin.Tel = jsonObject["phone"].ToString();
                    newAdmin.Mail = jsonObject["email"].ToString();
                    db.T_Admin.Add(newAdmin);
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "添加成功" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 编辑管理员
        public ActionResult EditAdmin(long id)
        {
            T_Admin TAdmin = db.T_Admin.Where(o => o.ID == id && !o.IsDelete).FirstOrDefault();
            ViewBag.TAdmin = TAdmin;
            return View();
        }
        [HttpPost]
        public ActionResult EditAdmin(string field = "")
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            T_Admin admin = serializer.Deserialize<T_Admin>(field);
            try
            {
                // 写数据库
                T_Admin TAdmin = db.T_Admin.Where(o => o.ID == admin.ID).FirstOrDefault();
                TAdmin.Password = admin.Password;
                TAdmin.Tel = admin.Tel;
                TAdmin.Mail = admin.Mail;
                TAdmin.Type = admin.Type;
                db.SaveChanges();
                return Json(new { code = 0, msg = "修改成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
            //return Content("ok:修改成功");
        }
        #endregion

        #region 删除管理员
        public ActionResult DelAdmin(long id)
        {
            try
            {
                var ho = db.T_Admin.Where(o => !o.IsDelete && o.ID == id).FirstOrDefault();
                if (ho != null)
                {
                    ho.IsDelete = true;
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


        #region 咨询师列表
        // GET: /main/DoctorLst

        public ActionResult DoctorLst()
        {
            return View();
        }
        public ActionResult GetDoctorList(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var aCourselistdb = db.T_Doctor.Where(o => !o.isDelete && (o.name.Contains(keyword) || o.tel.Contains(keyword))).ToList();
                int count = aCourselistdb.Count;
                var listdb = aCourselistdb.OrderBy(o => o.number).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.gId,
                    o.name,
                    o.Profile,
                    o.tel,
                    o.url,
                    time = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    o.number,
                    o.IsShow,
                    o.introduce
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 新增咨询师
        public ActionResult AddDoctor()
        {
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
        public ActionResult AddDoctor(string field = "")
        {
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                T_Doctor Doctor = serializer.Deserialize<T_Doctor>(field);
                if (string.IsNullOrEmpty(Doctor.UserName) || string.IsNullOrEmpty(Doctor.Password))
                {
                    return Json(new { code = -1, msg = "用户密码不能为空" }, JsonRequestBehavior.AllowGet);
                }
                var ho = db.T_Doctor.Where(o => !o.isDelete && (o.tel == Doctor.tel || o.UserName == Doctor.UserName)).FirstOrDefault();
                if (ho != null)
                {
                    return Json(new { code = -1, msg = "该咨询师已存在" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    //T_Doctor newDoctor = new T_Doctor("",Doctor.name, "", "","", Doctor.tel, Doctor.email );
                    //if (Doctor.Backup == "on") { newDoctor.IsTop = true; } else { newDoctor.IsTop = false; }
                    //newDoctor.url = Doctor.url;
                    //newDoctor.Profile = Doctor.Profile;
                    //newDoctor.introduce = Doctor.introduce;
                    //newDoctor.departmentID = 1;
                    //newDoctor.hospitalID = 1;
                    //newDoctor.Field = Doctor.Field;
                    //newDoctor.Province = Doctor.Province;
                    //newDoctor.City = Doctor.City;
                    //newDoctor.Area = Doctor.Area;
                    //newDoctor.Billing = Doctor.Billing;
                    //newDoctor.Careerexperience = Doctor.Careerexperience;
                    //newDoctor.TargetGroup = Doctor.TargetGroup;
                    //newDoctor.Joinerexperience = Doctor.Joinerexperience;
                    //JObject fieldS = JObject.Parse(field);
                    //ho.City = fieldS["province"].ToString() + "-" + fieldS["city"].ToString() + "-" + fieldS["area"].ToString();
                    if (Doctor.Backup == "on") { Doctor.IsTop = true; } else { Doctor.IsTop = false; }
                    //Doctor.UserName = Doctor.name;
                    Doctor.departmentID = 1;
                    Doctor.hospitalID = 1;
                    //Doctor.Password = "123456";
                    T_Doctor addExaminer = db.T_Doctor.Add(Doctor);

                    T_Admin User = new T_Admin();
                    User.Password = Doctor.Password;
                    User.UserName = Doctor.UserName;
                    User.Name = Doctor.name;
                    User.Tel = Doctor.tel;
                    User.Mail = Doctor.email;
                    User.Type = 2;
                    T_Admin UserA = db.T_Admin.Add(User);

                    db.SaveChanges();
                    return Json(new { code = 0, msg = "新增咨询师成功" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 编辑咨询师
        public ActionResult EditDoctor(long ID)
        {
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

            var TargetGrouplist = db.T_SystemSettings.Where(o => !o.isDelete && o.type==2).ToList();
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
                ho.Password = Examiner.Password;                
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
                ho.number = Examiner.number;
                ho.position = Examiner.position;
                if (Examiner.Backup == "on") { ho.IsTop = true; } else { ho.IsTop = false; }
                ho.ModifyTime = DateTime.Now;
                db.SaveChanges();

                T_Admin user = db.T_Admin.Where(o => o.UserName == ho.UserName && o.Type == 2 && !o.IsDelete).FirstOrDefault();
                if (user != null)
                {
                    user.Password = Examiner.Password;
                    db.SaveChanges();
                }

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
        
        #region 设置显示咨询师
        public ActionResult ShowDoctor(long ID, bool isShow = false)
        {
            try
            {
                T_Doctor ho = db.T_Doctor.Where(o => o.ID == ID && !o.isDelete).FirstOrDefault();
                if (ho != null)
                {
                    ho.IsShow = isShow;
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "设置成功" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    return Json(new { code = -1, msg = "设置失败" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 删除咨询师
        public ActionResult DelDoctor(long ID)
        {
            try
            {
                T_Doctor ho = db.T_Doctor.Where(o => o.ID == ID && !o.isDelete).FirstOrDefault();
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

        #region 发送咨询师链接
        /// <summary>
        /// 发送咨询师详情页链接到咨询师的微信
        /// </summary>
        /// <param name="ID">咨询师ID</param>
        /// <returns></returns>
        [HttpPost]
        public ActionResult SendDoctorLink(long ID)
        {
            try
            {
                T_Doctor doctor = db.T_Doctor.Where(o => o.ID == ID && !o.isDelete).FirstOrDefault();
                if (doctor == null)
                {
                    return Json(new { code = -1, msg = "咨询师不存在" }, JsonRequestBehavior.AllowGet);
                }

                if (string.IsNullOrEmpty(doctor.openid))
                {
                    return Json(new { code = -1, msg = "该咨询师未绑定微信，无法发送链接" }, JsonRequestBehavior.AllowGet);
                }

                string consultantViewUrl = "/we/ConsultantView/" + doctor.gId;
                string title = "咨询师详情链接";
                string description = "您的咨询师详情页链接，可分享给来访者查看您的信息并进行预约。";
                
                // 发送微信客服消息
                lxxl.WxService.WeiXinHelper.SendCustomMsg2(
                    doctor.openid,
                    consultantViewUrl,
                    title,
                    description,
                    doctor.url ?? "/Content/images/jxl-erweima.jpg"
                );

                return Json(new { code = 0, msg = "链接已发送至咨询师【" + doctor.name + "】的微信" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = "发送失败：" + ex.Message });
            }
        }
        #endregion

        #region 咨询师时间设置列表
        // GET: /main/ClassScheduleLst

        public ActionResult ClassScheduleLst(long ID)
        {
            //var listdb = db.T_DoctorClassSchedule.Where(o => !o.isDelete && o.doctorID == ID).OrderByDescending(o => o.startTime).ToList();
            //ViewBag.listdb = listdb;
            ViewBag.doctorID = ID;
            return View();
        }
        public ActionResult GetClassScheduleLst(long ID, int limit = 100)
        {
            try//.ThenBy(o => o.startH)
            {
                var listdb = db.T_DoctorClassSchedule.Where(o => !o.isDelete && o.doctorID == ID).OrderByDescending(o => o.startTime).ToList().Select(o => new
                {
                    o.ID,
                    o.gId,
                    o.Price,
                    o.maxSign,
                    o.endH,
                    startTime = o.startTime.ToString("yyyy-MM-dd"),
                    endTime = o.endTime.ToString("yyyy-MM-dd"),
                    createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    week = o.getWeek(),
                    o.startH
                }).ToList();              
                return Json(new { code = 0, data = listdb, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 新增时间设置
        public ActionResult AddClassSchedule(long ID)
        {
            ViewBag.doctorID = ID;
            List<T_SystemSettings> RoomList = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 12).ToList();
            ViewBag.RoomList = RoomList;
            
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult AddClassSchedule(string field = "")
        {
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                T_DoctorClassSchedule DoctorClassSchedule = serializer.Deserialize<T_DoctorClassSchedule>(field);

                //var ho = db.T_DoctorClassSchedule.Where(o => !o.isDelete && o.doctorID == Doctor.doctorID && o.week == Doctor.week).FirstOrDefault();
                //if (ho != null)
                //{
                //    return Json(new { code = -1, msg = "已存在" }, JsonRequestBehavior.AllowGet);
                //}
                //else
                //{
                //    //T_DoctorClassSchedule newDoctor = new T_DoctorClassSchedule(Doctor.doctorID, Doctor.startTime, Doctor.endTime, Doctor.startH, Doctor.endH, Doctor.week);

                //    T_DoctorClassSchedule addExaminer = db.T_DoctorClassSchedule.Add(Doctor);
                //    db.SaveChanges();
                //    return Json(new { code = 0, msg = "新增成功" }, JsonRequestBehavior.AllowGet);
                //}
                try
                {
                    if (DoctorClassSchedule.startTime > DoctorClassSchedule.endTime || !compareTime(DoctorClassSchedule.startH, DoctorClassSchedule.endH))
                    {
                        return Json(new { code = -1, msg = "时间设置不正确，请检查！" });
                    }
                    if (checkClassTime(DoctorClassSchedule) && SetScheduleNew(DoctorClassSchedule))
                    {
                        DoctorClassSchedule.createTime = DateTime.Now;
                        db.T_DoctorClassSchedule.Add(DoctorClassSchedule);
                        db.SaveChanges();
                    }
                    return Json(new { code = 0, msg = "新增成功" }, JsonRequestBehavior.AllowGet);
                }
                catch (Exception ex)
                {
                    return Json(new { code = -1, msg = ex.Message });
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 编辑时间设置
        public ActionResult EditClassSchedule(string gId)
        {
            T_DoctorClassSchedule Doctor = db.T_DoctorClassSchedule.Where(o => o.gId == gId && !o.isDelete).FirstOrDefault();
            ViewBag.Doctor = Doctor;
            List<T_SystemSettings> RoomList = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 12).ToList();
            ViewBag.RoomList = RoomList;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult EditClassSchedule2(string field = "")
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            T_DoctorClassSchedule DoctorClassSchedule = serializer.Deserialize<T_DoctorClassSchedule>(field);
            try
            {
                if (DoctorClassSchedule.startTime > DoctorClassSchedule.endTime || !compareTime(DoctorClassSchedule.startH ,DoctorClassSchedule.endH))
                {
                    return Json(new { code = -1, msg = "时间设置不正确，请检查！" });
                }
                T_DoctorClassSchedule ho = db.T_DoctorClassSchedule.Where(o => o.ID == DoctorClassSchedule.ID).FirstOrDefault();

                ho.createTime = DateTime.Now;
                db.SaveChanges();
                return Json(new { code = 0, msg = "修改成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }

        public bool checkClassTime(T_DoctorClassSchedule DoctorClass)
        {
            try
            {
                //int count = db.T_DoctorClassSchedule.Where(o => o.gId != DoctorClass.gId && o.week == DoctorClass.week && o.startTime > DoctorClass.startTime && o.endTime < DoctorClass.endTime && compareTime(o.startH, DoctorClass.startH) && compareTime(o.endH, DoctorClass.endH) && !o.isDelete).Count();
                //if(count>0)
                //{
                    
                //}
                return true;
            }
            catch (Exception ex)
            {

            }
            return false;
        }



        #region 创建日程表
        /// <summary>
        /// 创建日程表
        /// </summary>
        public bool SetScheduleNew(T_DoctorClassSchedule doctorClassSchedule)
        {
            try
            {
                //DateTime time = DateTime.Now.Date;
                //int day = 0;
                DayOfWeek dayOfWeek = (DayOfWeek)Enum.Parse(typeof(DayOfWeek), doctorClassSchedule.week);
                DateTime startData = doctorClassSchedule.startTime;
                string[] startH = doctorClassSchedule.startH.Split(':');
                int startH1 = int.Parse(startH[0]);
                int startH2 = int.Parse(startH[1]);
                string[] endH = doctorClassSchedule.endH.Split(':');
                int endH1 = int.Parse(endH[0]);
                int endH2 = int.Parse(endH[1]);
                for (int i = 0; i < 7; i++)
                {
                    if (startData.AddDays(i).DayOfWeek == dayOfWeek)
                    {
                        startData = startData.AddDays(i);
                        break;
                    }
                }
                while (startData <= doctorClassSchedule.endTime)
                {
                    DateTime startTime = startData.AddHours(startH1).AddMinutes(startH2);
                    DateTime endTime = startData.AddHours(endH1).AddMinutes(endH2);
                    T_DoctorSchedule temp = db.T_DoctorSchedule.SingleOrDefault(o => !o.isDelete && o.doctorID == doctorClassSchedule.doctorID && ((o.endTime < endTime && o.endTime > startTime) || (o.startTime < endTime && o.startTime > startTime) || (o.startTime < startTime && o.endTime > endTime) || (o.startTime > startTime && o.endTime < endTime)));
                    if (temp != null)
                    {
                        return false;
                    }
                    T_DoctorSchedule DoctorSchedule = new T_DoctorSchedule(doctorClassSchedule.doctorID, startTime, endTime, doctorClassSchedule.maxSign, doctorClassSchedule.Price, "");
                    DoctorSchedule.week = doctorClassSchedule.week;
                    DoctorSchedule.address = doctorClassSchedule.address;
                    DoctorSchedule.methods = doctorClassSchedule.methods;
                    DoctorSchedule.ClassScheduleId = doctorClassSchedule.ID;
                    db.T_DoctorSchedule.Add(DoctorSchedule);
                    startData = startData.AddDays(7);
                }
                db.SaveChanges();
                return true;
            }
            catch (Exception e)
            {
            }
            return false;
        }

        #endregion


        public bool compareTime(string time1,string time2)
        {
            try
            {
                string[] time1s = time1.Split(':');
                string[] time2s = time2.Split(':');
                if (int.Parse(time2s[0])>int.Parse(time1s[0]))
                {
                    return true;
                }
                else if (int.Parse(time2s[0]) == int.Parse(time1s[0]))
                {
                    if (int.Parse(time2s[1]) > int.Parse(time1s[1]))
                    {
                        return true;
                    }
                }
            }
            catch (Exception ex)
            {
                
            }
            return false;
        }

        #endregion

        #region 删除时间设置
        public ActionResult DelClassSchedule(string gId)
        {
            try
            {
                T_DoctorClassSchedule ho = db.T_DoctorClassSchedule.Where(o => o.gId == gId && !o.isDelete).FirstOrDefault();
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

        #region 咨询师时间列表
        // GET: /main/ScheduleLst

        public ActionResult ScheduleLst(long ID)
        {
            ViewBag.doctorID = ID;
            return View();
        }
        public ActionResult GetScheduleList(long ID, int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var aCourselistdb = db.T_DoctorSchedule.Where(o => !o.isDelete && o.doctorID == ID).ToList();
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

        #region 课程列表
        // GET: /main/Course

        public ActionResult Course()
        {
            return View();
        }
        public ActionResult GetCourseList(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var aCourselistdb = db.T_Course.Where(o => !o.IsDelete && o.Name.Contains(keyword) ).ToList();
                int count = aCourselistdb.Count;
                var listdb = aCourselistdb.OrderBy(o => o.ID).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.Name,
                    o.Profile,
                    o.url,
                    time = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    o.number
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        
        #endregion

        #region 新增课程
        public ActionResult AddCourse()
        {
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult AddCourse(string field = "")
        {
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                T_Course Course = serializer.Deserialize<T_Course>(field);
                var ho = db.T_Course.Where(o => !o.IsDelete && o.Name == Course.Name).FirstOrDefault();
                if (ho != null)
                {
                    return Json(new { code = -1, msg = "该课程名已存在" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    T_Course newCourse = new T_Course(Course.Name, Course.Profile, false, Course.ContentMain, true, Course.url);
                    db.T_Course.Add(newCourse);
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "新增课程成功" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 编辑课程
        public ActionResult EditCourse(long ID)
        {
            T_Course Course = db.T_Course.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            ViewBag.Course = Course;
            return View();
        }
        [HttpPost]
        [ValidateInput(false)]
        public ActionResult EditCourse(string field = "")
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            T_Course Course = serializer.Deserialize<T_Course>(field);
            try
            {
                T_Course TCourse = db.T_Course.Where(o => o.ID == Course.ID).FirstOrDefault();
                TCourse.Name = Course.Name;
                TCourse.Profile = Course.Profile;
                TCourse.url = Course.url;
                TCourse.ContentMain = Course.ContentMain;
                TCourse.ModifyTime = DateTime.Now;
                db.SaveChanges();
                return Json(new { code = 0, msg = "修改成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 删除课程
        public ActionResult DelCourse(long ID)
        {
            try
            {
                T_Course ho = db.T_Course.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
                if (ho != null)
                {
                    ho.IsDelete = true;
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

        #region 咨询师列表
        // GET: /main/Examiner

        public ActionResult Examiner()
        {
            return View();
        }

        public ActionResult GetExaminerList(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var aCourselistdb = db.T_Examiner.Where(o => !o.IsDelete && o.Name.Contains(keyword)).ToList();
                int count = aCourselistdb.Count;
                var listdb = aCourselistdb.OrderBy(o => o.ID).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.Name,
                    o.Profile,
                    o.url,
                    time = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    o.number,
                    o.Course
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion
        
        #region 新增咨询师
        public ActionResult AddExaminer()
        {
            IList<T_ExamC> aCourselistdb = new List<T_ExamC>();
            var TEMP = db.T_Course.Where(o => !o.IsDelete).ToList();
            foreach(T_Course item in TEMP)
            {
                aCourselistdb.Add(new T_ExamC(item.ID,item.Name));
            }
            ViewBag.aCourselistdb = aCourselistdb;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult AddExaminer(string field="")
        {
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                T_Examiner Examiner = serializer.Deserialize<T_Examiner>(field);
                
                var ho = db.T_Examiner.Where(o => !o.IsDelete && o.Name == Examiner.Name).FirstOrDefault();
                if (ho != null)
                {
                    return Json(new { code = -1, msg = "该咨询师名已存在" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    T_Examiner newExaminer = new T_Examiner(Examiner.Name, "", Examiner.url, Examiner.Profile, Examiner.ContentMain);
                    if (Examiner.Backup == "on") { newExaminer.IsBanner = true; } else { newExaminer.IsBanner = false; }
                    newExaminer.Course = Examiner.Course;
                    //Examiner.Course = "3";
                    //string[] courseLst = Examiner.Course.Split(',');
                    //foreach(string item in courseLst)
                    //{

                    //}
                    T_Examiner addExaminer = db.T_Examiner.Add(newExaminer);
                    db.SaveChanges();
                    //string[] courseLst = addExaminer.Course.Split(',');
                    //foreach (string item in courseLst)
                    //{
                    //    db.T_ExaminerCourse.Add(new T_ExaminerCourse());
                    //}
                    //db.SaveChanges();
                    return Json(new { code = 0, msg = "新增咨询师成功" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 编辑咨询师
        public ActionResult EditExaminer(long ID)
        {
            T_Examiner Examiner = db.T_Examiner.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            ViewBag.Examiner = Examiner;
            IList<T_ExamC> aCourselistdb = new List<T_ExamC>();
            var TEMP = db.T_Course.Where(o => !o.IsDelete).ToList();
            foreach (T_Course item in TEMP)
            {
                aCourselistdb.Add(new T_ExamC(item.ID, item.Name));
            }
            ViewBag.aCourselistdb = aCourselistdb;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult EditExaminer(string field = "")
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            T_Examiner Examiner = serializer.Deserialize<T_Examiner>(field);
            try
            {
                T_Examiner ho = db.T_Examiner.Where(o => o.ID == Examiner.ID).FirstOrDefault();
                ho.Name = Examiner.Name;
                ho.Profile = Examiner.Profile;
                ho.url = Examiner.url;
                ho.ContentMain = Examiner.ContentMain;
                ho.Course = Examiner.Course;
                if (Examiner.Backup == "on") { ho.IsBanner = true; } else { ho.IsBanner = false; }
                ho.ModifyTime = DateTime.Now;
                db.SaveChanges();
                return Json(new { code = 0, msg = "修改成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }           
        }
        #endregion

        #region 删除咨询师
        public ActionResult DelExaminer(long ID)
        {
            try
            {
                T_Examiner ho = db.T_Examiner.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
                if (ho != null)
                {
                    ho.IsDelete = true;
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

        #region 文章列表
        // GET: /main/ContentLst

        public ActionResult ContentLst()
        {
            return View();
        }
        public ActionResult GetContentList(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var aCourselistdb = db.T_Content.Where(o => !o.IsDelete && o.Title.Contains(keyword)).ToList();
                int count = aCourselistdb.Count;
                var listdb = aCourselistdb.OrderBy(o => o.ID).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.Title,
                    o.Profile,
                    o.Source,
                    o.url,
                    time = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    o.IsTop,
                    o.IsShow,
                    o.Views
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
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
        public ActionResult AddContent(string field = "")
        {
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                T_Content Content = serializer.Deserialize<T_Content>(field);
                if (Content.Backup == "on") { Content.IsTop = true; } else { Content.IsTop = false; }
                Content.MenuID = 1;
                T_Content addContent = db.T_Content.Add(Content);
                db.SaveChanges();
                return Json(new { code = 0, msg = "新增成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 编辑文章
        public ActionResult EditContent(long ID)
        {
            T_Content Content = db.T_Content.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            ViewBag.Content = Content;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult EditContent(string field = "")
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            T_Content Content = serializer.Deserialize<T_Content>(field);
            try
            {
                T_Content ho = db.T_Content.Where(o => o.ID == Content.ID).FirstOrDefault();
                ho.Title = Content.Title;
                ho.Profile = Content.Profile;
                ho.Source = Content.Source;
                ho.ContentMain = Content.ContentMain;
                ho.Profile = Content.Profile;
                ho.url = Content.url;
                if (Content.Backup == "on") { ho.IsTop = true; } else { ho.IsTop = false; }
                ho.IsShow = Content.IsShow;
                ho.ModifyTime = DateTime.Now;
                db.SaveChanges();
                return Json(new { code = 0, msg = "修改成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 删除文章
        public ActionResult DelContent(long ID)
        {
            try
            {
                T_Content ho = db.T_Content.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
                if (ho != null)
                {
                    ho.IsDelete = true;
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

        #region 设置显示文章
        public ActionResult ShowContent(long ID, bool isShow = false)
        {
            try
            {
                T_Content ho = db.T_Content.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
                if (ho != null)
                {
                    ho.IsShow = isShow;
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "设置成功" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    return Json(new { code = -1, msg = "设置失败" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 轮播列表
        // GET: /main/BannerLst

        public ActionResult BannerLst()
        {
            return View();
        }
        public ActionResult GetBannerList(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var aCourselistdb = db.T_Banner.Where(o => !o.IsDelete && o.MenuID == 1 && o.Type == 1 && o.Title.Contains(keyword)).ToList();
                int count = aCourselistdb.Count;
                var listdb = aCourselistdb.OrderBy(o => o.ID).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.Title,
                    o.Profile,
                    o.url,
                    time = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion
        
        #region 新增轮播
        public ActionResult AddBanner()
        {
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult AddBanner(string field = "")
        {
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                T_Banner Banner = serializer.Deserialize<T_Banner>(field);

                T_Banner newBanner = new T_Banner(1, Banner.Title, Banner.url, Banner.Profile, 1, "");
                db.T_Banner.Add(newBanner);
                db.SaveChanges();
                return Json(new { code = 0, msg = "新增成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 编辑轮播
        public ActionResult EditBanner(long ID)
        {
            T_Banner Banner = db.T_Banner.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            ViewBag.Banner = Banner;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult EditBanner(string field = "")
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            T_Banner Banner = serializer.Deserialize<T_Banner>(field);
            try
            {
                T_Banner ho = db.T_Banner.Where(o => o.ID == Banner.ID).FirstOrDefault();
                ho.Title = Banner.Title;
                ho.Profile = Banner.Profile;
                ho.url = Banner.url;
                ho.ModifyTime = DateTime.Now;
                db.SaveChanges();
                return Json(new { code = 0, msg = "修改成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 删除轮播
        public ActionResult DelBanner(long ID)
        {
            try
            {
                T_Banner ho = db.T_Banner.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
                if (ho != null)
                {
                    ho.IsDelete = true;
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

        #region 院校列表
        // GET: /main/CollegeLst

        public ActionResult CollegeLst()
        {
            return View();
        }
        public ActionResult GetCollegeList(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var aCourselistdb = db.T_Banner.Where(o => !o.IsDelete && o.MenuID == 1 && o.Type == 12 && o.Title.Contains(keyword)).ToList();
                int count = aCourselistdb.Count;
                var listdb = aCourselistdb.OrderBy(o => o.ID).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.Title,
                    o.Profile,
                    o.url,
                    time = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion
        
        #region 新增院校
        public ActionResult AddCollege()
        {
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult AddCollege(string field = "")
        {
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                T_Banner Banner = serializer.Deserialize<T_Banner>(field);

                T_Banner newBanner = new T_Banner(1, Banner.Title, Banner.url, Banner.Profile, 12, "");
                db.T_Banner.Add(newBanner);
                db.SaveChanges();
                return Json(new { code = 0, msg = "新增成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion
        
        #region 编辑院校
        public ActionResult EditCollege(long ID)
        {
            T_Banner Banner = db.T_Banner.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            ViewBag.Banner = Banner;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult EditCollege(string field = "")
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            T_Banner Banner = serializer.Deserialize<T_Banner>(field);
            try
            {
                T_Banner ho = db.T_Banner.Where(o => o.ID == Banner.ID).FirstOrDefault();
                ho.Title = Banner.Title;
                ho.Profile = Banner.Profile;
                ho.url = Banner.url;
                ho.ModifyTime = DateTime.Now;
                db.SaveChanges();
                return Json(new { code = 0, msg = "修改成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion
        
        #region 资料列表
        // GET: /main/InfoDataLst

        public ActionResult InfoDataLst()
        {
            return View();
        }
        public ActionResult GetInfoDataList(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var aCourselistdb = db.T_InfoData.Where(o => !o.IsDelete && o.Title.Contains(keyword)).ToList();
                int count = aCourselistdb.Count;
                var listdb = aCourselistdb.OrderBy(o => o.ID).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.Title,
                    o.Profile,
                    o.Source,
                    o.url,
                    time = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    o.IsTop,
                    o.IsShow,
                    o.Views
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion
        
        #region 新增资料
        public ActionResult AddInfoData()
        {
            IList<T_ExamC> aCourselistdb = new List<T_ExamC>();
            var TEMP = db.T_Course.Where(o => !o.IsDelete).ToList();
            foreach (T_Course item in TEMP)
            {
                aCourselistdb.Add(new T_ExamC(item.ID, item.Name));
            }
            ViewBag.aCourselistdb = aCourselistdb;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult AddInfoData(string field = "")
        {
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                T_InfoData InfoData = serializer.Deserialize<T_InfoData>(field);
                if (InfoData.Backup == "on") { InfoData.IsTop = true; } else { InfoData.IsTop = false; }
                T_InfoData addInfoData = db.T_InfoData.Add(InfoData);
                db.SaveChanges();
                return Json(new { code = 0, msg = "新增成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 编辑资料
        public ActionResult EditInfoData(long ID)
        {
            IList<T_ExamC> aCourselistdb = new List<T_ExamC>();
            var TEMP = db.T_Course.Where(o => !o.IsDelete).ToList();
            foreach (T_Course item in TEMP)
            {
                aCourselistdb.Add(new T_ExamC(item.ID, item.Name));
            }
            ViewBag.aCourselistdb = aCourselistdb;
            T_InfoData InfoData = db.T_InfoData.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            ViewBag.InfoData = InfoData;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult EditInfoData(string field = "")
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            T_InfoData InfoData = serializer.Deserialize<T_InfoData>(field);
            try
            {
                T_InfoData ho = db.T_InfoData.Where(o => o.ID == InfoData.ID).FirstOrDefault();
                ho.Title = InfoData.Title;
                ho.Profile = InfoData.Profile;
                ho.Source = InfoData.Source;
                ho.Profile = InfoData.Profile;
                ho.url = InfoData.url;
                if (InfoData.Backup == "on") { ho.IsTop = true; } else { ho.IsTop = false; }
                ho.IsShow = InfoData.IsShow;
                ho.ModifyTime = DateTime.Now;
                db.SaveChanges();
                return Json(new { code = 0, msg = "修改成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 删除资料
        public ActionResult DelInfoData(long ID)
        {
            try
            {
                T_InfoData ho = db.T_InfoData.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
                if (ho != null)
                {
                    ho.IsDelete = true;
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

        #region 咨询室列表
        // GET: /main/ConsultingRoomLst

        public ActionResult ConsultingRoomLst()
        {
            return View();
        }
        public ActionResult GetConsultingRoomList(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var aCourselistdb = db.T_SystemSettings.Where(o => !o.isDelete && o.content1.Contains(keyword) && o.type == 12).ToList();
                int count = aCourselistdb.Count;
                var listdb = aCourselistdb.OrderBy(o => o.id).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.id,
                    o.content1,
                    o.remark,
                    time = o.createTime.ToString("yyyy-MM-dd HH:mm:ss")
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 新增咨询室
        public ActionResult AddConsultingRoom()
        {
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult AddConsultingRoom(string field = "")
        {
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                T_SystemSettings InfoData = serializer.Deserialize<T_SystemSettings>(field);
                InfoData.type = 12;
                T_SystemSettings addInfoData = db.T_SystemSettings.Add(InfoData);
                db.SaveChanges();
                return Json(new { code = 0, msg = "新增成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 编辑咨询室
        public ActionResult EditConsultingRoom(long ID)
        {
            T_SystemSettings InfoData = db.T_SystemSettings.Where(o => o.id == ID && o.type == 12 && !o.isDelete).FirstOrDefault();
            ViewBag.InfoData = InfoData;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult EditConsultingRoom(string field = "")
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            T_SystemSettings InfoData = serializer.Deserialize<T_SystemSettings>(field);
            try
            {
                T_SystemSettings ho = db.T_SystemSettings.Where(o => o.id == InfoData.id).FirstOrDefault();
                ho.content1 = InfoData.content1;
                ho.remark = InfoData.remark;
                db.SaveChanges();
                return Json(new { code = 0, msg = "修改成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 删除咨询室
        public ActionResult DelConsultingRoom(long ID)
        {
            try
            {
                T_SystemSettings ho = db.T_SystemSettings.Where(o => o.id == ID && !o.isDelete).FirstOrDefault();
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

        #region 设置显示文章
        public ActionResult ShowInfoData(long ID, bool isShow = false)
        {
            try
            {
                T_InfoData ho = db.T_InfoData.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
                if (ho != null)
                {
                    ho.IsShow = isShow;
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "设置成功" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    return Json(new { code = -1, msg = "设置失败" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 消息列表
        // GET: /main/MessageRecordLst

        public ActionResult MessageLst()
        {
            return View();
        }
        public ActionResult GetMessageLst(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var aCourselistdb = db.T_MessageRecord.Where(o => !o.IsDelete && o.name.Contains(keyword)).ToList();
                int count = aCourselistdb.Count;
                var listdb = aCourselistdb.OrderBy(o => o.ID).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o,
                    time = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss")
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion
        
        #region 知识列表
        // GET: /user/KnowledgeLst

        public ActionResult KnowledgeLst()
        {
            return View();
        }
        public ActionResult GetKnowledgeList(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var aCourselistdb = db.T_Content.Where(o => !o.IsDelete && o.Type == 2 && o.Title.Contains(keyword)).ToList();
                int count = aCourselistdb.Count;
                var listdb = aCourselistdb.OrderBy(o => o.ID).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.Title,
                    o.Profile,
                    o.Source,
                    o.url,
                    time = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    o.IsTop,
                    o.IsShow,
                    o.userID,
                    o.Views
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion
        
        #region 新增知识
        public ActionResult AddKnowledge(long MenuID = 0)
        {
            ViewBag.MenuID = MenuID;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult AddKnowledge(string field = "")
        {
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                T_Content Content = serializer.Deserialize<T_Content>(field);
                if (Content.Backup == "on") { Content.IsTop = true; } else { Content.IsTop = false; }
                Content.MenuID = 1;
                Content.userID = 1;
                Content.Source = "连心理";
                T_Content addContent = db.T_Content.Add(Content);
                db.SaveChanges();
                return Json(new { code = 0, msg = "新增成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 编辑知识
        public ActionResult EditKnowledge(long ID)
        {
            T_Content Content = db.T_Content.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            ViewBag.Content = Content;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult EditKnowledge(string field = "")
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            T_Content Content = serializer.Deserialize<T_Content>(field);
            try
            {
                T_Content ho = db.T_Content.Where(o => o.ID == Content.ID).FirstOrDefault();
                ho.Title = Content.Title;
                ho.Profile = Content.Profile;
                //ho.Source = Content.Source;
                ho.ContentMain = Content.ContentMain;
                ho.Profile = Content.Profile;
                ho.url = Content.url;
                if (Content.Backup == "on") { ho.IsTop = true; } else { ho.IsTop = false; }
                ho.IsShow = Content.IsShow;
                ho.ModifyTime = DateTime.Now;
                db.SaveChanges();
                return Json(new { code = 0, msg = "修改成功" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 删除知识
        public ActionResult DelKnowledge(long ID)
        {
            try
            {
                T_Content ho = db.T_Content.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
                if (ho != null)
                {
                    ho.IsDelete = true;
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

        #region 设置显示知识
        public ActionResult ShowKnowledge(long ID, bool isShow = false)
        {
            try
            {
                T_Content ho = db.T_Content.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
                if (ho != null)
                {
                    ho.IsShow = isShow;
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "设置成功" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    return Json(new { code = -1, msg = "设置失败" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion
        
        #region 用户列表
        // GET: /main/PatientLst

        public ActionResult PatientLst()
        {
            return View();
        }
        public ActionResult GetPatientList(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var aCourselistdb = db.T_User.Where(o => !o.IsDelete && (o.Name.Contains(keyword) || o.Tel.Contains(keyword))).ToList();
                int count = aCourselistdb.Count;
                var listdb = aCourselistdb.OrderBy(o => o.ID).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.Name,
                    o.nickname,
                    o.Tel,
                    o.TopUrl,
                    time = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    o.OpenID,
                    o.IsWeChat,
                    djbcount = db.T_RegistrationForm.Count(r => !r.IsDelete && r.UserID == o.ID),
                    djb = db.T_RegistrationForm.Where(r => !r.IsDelete && r.UserID == o.ID).Select(r=>r.gId).ToList()
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 新增用户
        public ActionResult AddPatient()
        {
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult AddPatient(string field = "")
        {
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                T_User user = serializer.Deserialize<T_User>(field);
                if (string.IsNullOrEmpty(user.Name) || string.IsNullOrEmpty(user.Tel) || string.IsNullOrEmpty(user.PassWord))
                {
                    return Json(new { code = -1, msg = "用户、手机、密码不能为空" }, JsonRequestBehavior.AllowGet);
                }
                var ho = db.T_User.Where(o => !o.IsDelete && (o.Tel == user.Tel || o.UserName == user.Tel)).FirstOrDefault();
                if (ho != null && ho.type == "patient")
                {
                    return Json(new { code = -1, msg = "该手机号已存在" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    user.type = "patient";
                    user.UserName = user.Tel;
                    user.SourceID = 1;
                    T_User UserA = db.T_User.Add(user);
                    db.SaveChanges();

                    return Json(new { code = 0, msg = "新增用户成功" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 来访者列表
        // GET: /main/ConsultationRecordLst

        public ActionResult ConsultationRecordLst()
        {
            return View();
        }
        public ActionResult GetConsultationRecordList(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var alistdb = db.T_ConsultationRecord.Include("doctor").Include("User").Where(o => !o.IsDelete && !o.IsShow && (o.name.Contains(keyword) || o.User.Tel.Contains(keyword))).ToList();
                int count = alistdb.Count;
                var listdb = alistdb.OrderBy(o => o.ID).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.UserID,
                    //formSum = db.T_SubUser.Count(s => s.UserID == o.UserID),
                    o.ID,
                    name = o.doctor.name,
                    tel = o.doctor.tel,
                    email = o.doctor.email,
                    patientName = o.name,
                    patientTel = o.User.Tel,
                    createTime = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    hospital = o.doctor.hospitalName,
                    department = o.doctor.departmentName,
                    position = o.doctor.position,
                    IsTop = o.IsTop,
                    record = o.record,
                    Frequency = o.Frequency,
                    ConsultationIDs = o.ConsultationIDs,
                    TimeXY = o.TimeXY,
                    TimeJA = o.TimeJA,
                    records = db.T_Consultation.Where(r => !r.isDelete && r.UserID == o.UserID && r.doctorID == o.doctorID).ToList().Select(r => new
                    {
                        r.ID,               
                        name = o.doctor.name,
                        tel = r.tel,
                        createTime = r.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
                        appointmentTime = r.appointmentTime.ToString("yyyy-MM-dd HH:mm"),
                        r.duration,
                        r.PayCost,
                        cTime = r.createTime == r.cTime ? "" : r.cTime.ToString("yyyy-MM-dd HH:mm"),
                        State = r.State
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

        #region 已结案来访者列表
        // GET: /main/ConsultationRecordJA

        public ActionResult ConsultationRecordJA()
        {
            return View();
        }
        public ActionResult GetConsultationRecordJA(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var alistdb = db.T_ConsultationRecord.Include("doctor").Include("User").Where(o => !o.IsDelete && o.IsShow && (o.name.Contains(keyword) || o.User.Tel.Contains(keyword))).ToList();
                int count = alistdb.Count;
                var listdb = alistdb.OrderBy(o => o.ID).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    name = o.doctor.name,
                    tel = o.doctor.tel,
                    email = o.doctor.email,
                    patientName = o.name,
                    patientTel = o.User.Tel,
                    createTime = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    hospital = o.doctor.hospitalName,
                    department = o.doctor.departmentName,
                    position = o.doctor.position,
                    IsTop = o.IsTop,
                    record = o.record,
                    Frequency = o.Frequency,
                    ConsultationIDs = o.ConsultationIDs,
                    TimeXY = o.TimeXY,
                    records = db.T_Consultation.Where(r => !r.isDelete && r.UserID == o.UserID && r.doctorID == o.doctorID).ToList().Select(r => new
                    {
                        r.ID,
                        name = o.doctor.name,
                        tel = r.tel,
                        createTime = r.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
                        appointmentTime = r.appointmentTime.ToString("yyyy-MM-dd HH:mm"),
                        r.duration,
                        r.PayCost,
                        cTime = r.createTime == r.cTime ? "" : r.cTime.ToString("yyyy-MM-dd HH:mm"),
                        State = r.State

                    }).OrderBy(r => r.appointmentTime).ToArray()
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

        #region 咨询师报表
        // GET: /main/DreportLst

        public ActionResult DreportLst()
        {
            return View();
        }
        public ActionResult GetDreportLst(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var aCourselistdb = db.T_Doctor.Where(o => !o.isDelete && o.name.Contains(keyword)).ToList();
                int count = aCourselistdb.Count;
                var listdb = aCourselistdb.OrderBy(o => o.number).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.name,
                    o.Profile,
                    o.tel,
                    o.url,
                    time = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    o.number,
                    o.IsShow,
                    o.introduce,
                    userCount = db.T_ConsultationRecord.Count(p => !p.IsDelete && p.doctorID == o.ID),
                    Consultation = db.T_Consultation.Where(c => !c.isDelete && c.doctorID == o.ID),
                }).ToList().Select(o => new
                {
                    o.ID,
                    o.name,
                    o.Profile,
                    o.tel,
                    o.url,
                    o.time,
                    o.number,
                    o.IsShow,
                    o.introduce,
                    o.userCount,
                    Consultation1 = o.Consultation.Count(d => d.State >= 1 && d.State < 10 && d.State != -1),
                    Consultation10 = o.Consultation.Count(d => d.State >= 10)
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 咨询列表
        // GET: /main/ConsultationLst
        public ActionResult ConsultationLst()
        {            
            T_Admin user = Session["admin"] as T_Admin;
            ViewBag.userType = user.Type;
            return View();
        }
        public ActionResult HighriskList()
        {
            T_Admin user = Session["admin"] as T_Admin;
            ViewBag.userType = user.Type;
            return View();
        }
        public ActionResult GetConsultationList(int page = 1, int limit = 15, string keyword = "", string startDay = "", string endDay = "", int state = 10000)
        {
            DateTime Starttime = Convert.ToDateTime("2022-01-01");
            DateTime Endtime = DateTime.Now.AddDays(100);

            if (!string.IsNullOrEmpty(startDay))
            {
                Starttime = Convert.ToDateTime(startDay);
            }
            if (!string.IsNullOrEmpty(endDay))
            {
                Starttime = Convert.ToDateTime(endDay);
            }

            var alistdb = db.T_Consultation.Include("doctor").Include("admin").Include("User").Where(o => !o.isDelete && (o.doctor.name.Contains(keyword) || o.doctor.tel.Contains(keyword) || o.User.Name.Contains(keyword) || o.User.Tel.Contains(keyword)) && o.appointmentTime >= Starttime && o.appointmentTime < Endtime && (state == 10000 ? true : o.State==state)).ToList();

            //foreach (T_Consultation item in alistdb)////初始化来访者
            //{
            //    if (item.State >= 1)
            //    {
            //        T_ConsultationRecord oneR = db.T_ConsultationRecord.FirstOrDefault(o => !o.IsDelete && o.UserID == item.UserID && o.doctorID == item.doctorID);
            //        if (oneR == null)
            //        {
            //            oneR = new T_ConsultationRecord(item.type, item.name, "", "", item.tel, "");
            //            oneR.UserID = item.UserID;
            //            oneR.doctorID = item.doctorID;
            //            oneR.Frequency = 1;
            //            oneR.ConsultationIDs = item.ID.ToString();
            //            db.T_ConsultationRecord.Add(oneR);
            //            db.SaveChanges();
            //        }
            //        else
            //        {
            //            oneR.Frequency = oneR.Frequency + 1;
            //            oneR.ConsultationIDs = oneR.ConsultationIDs + "," + item.ID;
            //            db.SaveChanges();
            //        }
            //    }
            //}
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
                hospital = o.hospital,
                department = o.doctor.departmentName,
                position = o.doctor.position,
                o.content1,
                o.problems,
                o.expectedTime,
                o.remark,
                o.type,
                appointmentTime = o.appointmentTime.ToString("yyyy-MM-dd HH:mm"),
                o.handler,
                cTime = o.createTime == o.cTime ? "" : o.cTime.ToString("yyyy-MM-dd HH:mm"),
                o.duration,
                o.address,
                o.expert,
                o.record,
                o.upfile,
                o.IsSure,
                o.State,
                updateTime = o.updateTime.ToString("yyyy-MM-dd HH:mm"),
                o.PayCost,
                StateDescription = o.GetStateDescription(),
                o.homeRenark,
                CaseRecords = db.T_CaseRecord.Where(c => !c.isDelete && o.gId == c.gId).OrderBy(c => c.EditeTime).ToList().Select(c => new{
                    ID = c.ID,
                    EditeTime = c.EditeTime,
                    IsSure = c.IsSure
                })
            }).OrderBy(o=>o.appointmentTime).ToList();
            return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
        }


        public ActionResult GetHighriskList(int page = 1, int limit = 15, string keyword = "", string chooseDay = "", int state = 10000)
        {
            DateTime Starttime = Convert.ToDateTime("2022-01-01");
            DateTime Endtime = DateTime.Now.AddDays(100);
            if (!string.IsNullOrEmpty(chooseDay))
            {
                Starttime = Convert.ToDateTime(chooseDay.Substring(0, 10));
                Endtime = Convert.ToDateTime(chooseDay.Substring(13, 10)).AddDays(1);
            }
            string[] itemXS= {"B","A"};
            var alistdb = db.T_Consultation.Include("doctor").Include("admin").Include("User").Where(o => !o.isDelete && (o.doctor.name.Contains(keyword) || o.doctor.tel.Contains(keyword) || o.User.Name.Contains(keyword) || o.User.Tel.Contains(keyword)) && o.appointmentTime >= Starttime && o.appointmentTime < Endtime && (state == 10000 ? true : o.State == state)
                && db.T_CaseRecord.Count(c => !c.isDelete && o.gId == c.gId && itemXS.Contains(c.ItemX)) > 0
                ).ToList();

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
                hospital = o.hospital,
                department = o.doctor.departmentName,
                position = o.doctor.position,
                o.content1,
                o.problems,
                o.expectedTime,
                o.remark,
                o.type,
                appointmentTime = o.appointmentTime.ToString("yyyy-MM-dd HH:mm"),
                o.handler,
                cTime = o.createTime == o.cTime ? "" : o.cTime.ToString("yyyy-MM-dd HH:mm"),
                o.duration,
                o.expert,
                o.record,
                o.upfile,
                o.IsSure,
                o.State,
                updateTime = o.updateTime.ToString("yyyy-MM-dd HH:mm"),
                o.PayCost,
                o.homeRenark,
                CaseRecords = db.T_CaseRecord.Where(c => !c.isDelete && o.gId == c.gId && itemXS.Contains(c.ItemX)).OrderBy(c => c.EditeTime).ToList().Select(c => new
                {
                    ID = c.ID,
                    EditeTime = c.EditeTime,
                    IsSure = c.IsSure,
                    ItemX = c.ItemX == "A" ? "一级风险/危机" : "二级风险/危机"
                })
            }).OrderBy(o => o.appointmentTime).ToList();
            return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
        }
        #endregion


        #region 新增咨询
        public ActionResult AddConsultation()
        {
            // 获取咨询室列表
            List<T_SystemSettings> RoomList = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 12).ToList();
            ViewBag.RoomList = RoomList;
            return View();
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult AddConsultation(long patientId, long doctorId, long? scheduleId = null, 
            string consultationContent = "", string remark = "", bool isCustomTime = false,
            DateTime? customStartTime = null, DateTime? customEndTime = null, 
            double? customPrice = null, string customMethods = "", string customAddress = "")
        {
            try
            {
                T_Admin admin = Session["admin"] as T_Admin;
                if (admin == null)
                {
                    return Json(new { code = -1, msg = "请先登录" }, JsonRequestBehavior.AllowGet);
                }

                // 获取来访者信息
                T_User patient = db.T_User.Where(o => !o.IsDelete && o.ID == patientId).FirstOrDefault();
                if (patient == null)
                {
                    return Json(new { code = -1, msg = "来访者信息不存在" }, JsonRequestBehavior.AllowGet);
                }

                // 获取咨询师信息
                T_Doctor doctor = db.T_Doctor.Where(o => !o.isDelete && o.ID == doctorId).FirstOrDefault();
                if (doctor == null)
                {
                    return Json(new { code = -1, msg = "咨询师信息不存在" }, JsonRequestBehavior.AllowGet);
                }

                T_DoctorSchedule schedule = null;
                DateTime appointmentStartTime, appointmentEndTime;
                double appointmentPrice;
                string appointmentMethods, appointmentAddress;

                if (isCustomTime)
                {
                    // 处理自定义时间
                    if (!customStartTime.HasValue || !customEndTime.HasValue || 
                        !customPrice.HasValue || string.IsNullOrEmpty(customMethods))
                    {
                        return Json(new { code = -1, msg = "自定义时间信息不完整" }, JsonRequestBehavior.AllowGet);
                    }

                    appointmentStartTime = customStartTime.Value;
                    appointmentEndTime = customEndTime.Value;
                    appointmentPrice = customPrice.Value;
                    appointmentMethods = customMethods;
                    appointmentAddress = customAddress ?? "";

                    // 验证时间合理性
                    if (appointmentStartTime >= appointmentEndTime)
                    {
                        return Json(new { code = -1, msg = "结束时间必须大于开始时间" }, JsonRequestBehavior.AllowGet);
                    }

                    if (appointmentStartTime <= DateTime.Now)
                    {
                        return Json(new { code = -1, msg = "预约时间不能是过去的时间" }, JsonRequestBehavior.AllowGet);
                    }

                    // 再次检查时间冲突（服务端验证）
                    var conflictSchedules = db.T_DoctorSchedule.Where(o => 
                        !o.isDelete && 
                        o.doctorID == doctorId &&
                        ((o.startTime < appointmentEndTime && o.endTime > appointmentStartTime))
                    ).ToList();

                    var conflictConsultations = db.T_Consultation.Where(o => 
                        !o.isDelete && 
                        o.doctorID == doctorId &&
                        o.State != ConsultationState.Cancelled && // 排除已取消的预约
                        ((o.appointmentTime < appointmentEndTime && o.eTime > appointmentStartTime))
                    ).ToList();

                    if (conflictSchedules.Any() || conflictConsultations.Any())
                    {
                        return Json(new { code = -1, msg = "该时间段与现有预约冲突，请选择其他时间" }, JsonRequestBehavior.AllowGet);
                    }

                    // 创建新的排班记录
                    schedule = new T_DoctorSchedule(doctorId, appointmentStartTime, appointmentEndTime, 1, appointmentPrice, appointmentAddress);
                    schedule.methods = appointmentMethods;
                    schedule.week = appointmentStartTime.DayOfWeek.ToString("d");
                    
                    // 设置为已预约状态
                    schedule.numSign = 1;
                    
                    db.T_DoctorSchedule.Add(schedule);
                    db.SaveChanges(); // 保存以获取ID
                }
                else
                {
                    // 处理现有排班时间
                    if (!scheduleId.HasValue)
                    {
                        return Json(new { code = -1, msg = "请选择预约时间" }, JsonRequestBehavior.AllowGet);
                    }

                    schedule = db.T_DoctorSchedule.Where(o => !o.isDelete && o.ID == scheduleId.Value).FirstOrDefault();
                    if (schedule == null)
                    {
                        return Json(new { code = -1, msg = "预约时间不存在" }, JsonRequestBehavior.AllowGet);
                    }

                    // 检查时间是否已被预约
                    if (schedule.numSign > 0)
                    {
                        return Json(new { code = -1, msg = "该时间已被预约，请选择其他时间" }, JsonRequestBehavior.AllowGet);
                    }

                    appointmentStartTime = schedule.startTime;
                    appointmentEndTime = schedule.endTime;
                    appointmentPrice = schedule.Price;
                    appointmentMethods = schedule.methods;
                    appointmentAddress = schedule.address;

                    // 更新排班预约数量
                    schedule.numSign = schedule.numSign + 1;
                }

                // 创建咨询记录
                T_Consultation consultation = new T_Consultation(patientId, doctorId, appointmentPrice, appointmentStartTime);
                consultation.name = patient.Name;
                consultation.tel = patient.Tel;
                consultation.email = patient.Mail;
                consultation.content1 = consultationContent;
                consultation.methods = appointmentMethods;
                consultation.remark = remark;
                consultation.address = appointmentAddress;
                consultation.handler = admin.ID.ToString();
                consultation.State = ConsultationState.UserConfirmed; // 已接受状态
                consultation.IsSure = false;
                consultation.appointmentTime = appointmentStartTime;
                consultation.cTime = appointmentStartTime;
                consultation.eTime = appointmentEndTime;
                TimeSpan duration = appointmentEndTime - appointmentStartTime;
                consultation.duration = duration.TotalHours;
                consultation.TDoctorID = schedule.ID;
                consultation.PayTime = DateTime.Now;
                consultation.PayType = 4;
                consultation.expectedTime = appointmentStartTime.ToString("HH:mm") + "-" + appointmentEndTime.ToString("HH:mm");

                db.T_Consultation.Add(consultation);
                db.SaveChanges();

                return Json(new { code = 0, msg = "咨询记录新增成功", consultationId = consultation.gId }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = "新增失败：" + ex.Message }, JsonRequestBehavior.AllowGet);
            }
        }

        // 获取患者列表
        public ActionResult GetPatients()
        {
            try
            {
                var patients = db.T_User.Where(o => !o.IsDelete && o.type == "patient")
                    .Select(o => new { o.ID, o.Name, o.Tel, o.Age, o.Sex })
                    .OrderBy(o => o.Name)
                    .ToList();

                return Json(new { code = 0, patients = patients }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message }, JsonRequestBehavior.AllowGet);
            }
        }

        // 搜索来访者
        public ActionResult SearchPatients(string searchTerm)
        {
            try
            {
                var patients = db.T_User.Where(o => !o.IsDelete && o.type == "patient" && 
                    (o.Name.Contains(searchTerm) || o.Tel.Contains(searchTerm)))
                    .Select(o => new { o.ID, o.Name, o.Tel, o.Age, o.Sex })
                    .OrderBy(o => o.Name)
                    .Take(10)
                    .ToList();

                return Json(new { code = 0, patients = patients }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message }, JsonRequestBehavior.AllowGet);
            }
        }

        // 获取患者详细信息
        public ActionResult GetPatientInfo(long id)
        {
            try
            {
                var patient = db.T_User.Where(o => !o.IsDelete && o.ID == id)
                    .Select(o => new { o.ID, o.Name, o.Tel, o.Age, o.Sex, o.Mail })
                    .FirstOrDefault();

                if (patient == null)
                {
                    return Json(new { code = -1, msg = "患者信息不存在" }, JsonRequestBehavior.AllowGet);
                }

                return Json(new { code = 0, patient = patient }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message }, JsonRequestBehavior.AllowGet);
            }
        }

        // 获取医生列表
        public ActionResult GetDoctors()
        {
            try
            {
                var doctors = db.T_Doctor.Where(o => !o.isDelete && o.IsShow)
                    .Select(o => new { 
                        o.ID, 
                        o.name, 
                        o.hospitalName, 
                        o.departmentName, 
                        o.position, 
                        o.Billing, 
                        o.Profile,
                        o.url
                    })
                    .OrderBy(o => o.name)
                    .ToList();

                return Json(new { code = 0, doctors = doctors }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message }, JsonRequestBehavior.AllowGet);
            }
        }

        // 获取医生可约时间
        public ActionResult GetDoctorSchedule(long doctorId)
        {
            try
            {
                DateTime sTime = DateTime.Now.AddDays(1).Date;
                DateTime endTime = DateTime.Now.AddDays(31);
                var schedules = db.T_DoctorSchedule.Where(o => !o.isDelete && o.doctorID == doctorId && o.numSign == 0 &&  sTime < o.startTime && o.startTime < endTime).ToList()
                    .Select(o => new { 
                        o.ID,
                        o.Price, 
                        o.address,
                        o.methods,
                        startDate = o.startTime.ToString("yyyy-MM-dd"),
                        startHH = o.startTime.ToString("HH:mm"),
                        endHH = o.endTime.ToString("HH:mm"),
                        startTime = o.startTime.ToString("yyyy-MM-dd HH:mm"),
                        endTime = o.endTime.ToString("yyyy-MM-dd HH:mm"),
                        createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
                        time = (o.endTime - o.startTime).Hours == 0 ? "" : ((o.endTime - o.startTime).Hours + "小时") + ((o.endTime - o.startTime).Minutes == 0 ? "" : ((o.endTime - o.startTime).Minutes + "分钟")),
                        week = o.getWeek(),
                    })
                    .OrderBy(o => o.startTime)
                    .ToList();

                return Json(new { code = 0, schedules = schedules }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message }, JsonRequestBehavior.AllowGet);
            }
        }
        
        // 检查时间冲突
        [HttpPost]
        public ActionResult CheckTimeConflict(long doctorId, DateTime startTime, DateTime endTime)
        {
            try
            {
                // 检查该医生在指定时间段是否已有排班或预约
                var existingSchedules = db.T_DoctorSchedule.Where(o => 
                    !o.isDelete && 
                    o.doctorID == doctorId &&
                    ((o.startTime < endTime && o.endTime > startTime)) // 时间段重叠判断
                ).ToList();

                // 检查是否有已确认的咨询预约在该时间段
                var existingConsultations = db.T_Consultation.Where(o => 
                    !o.isDelete && 
                    o.doctorID == doctorId &&
                    o.State != ConsultationState.Cancelled && // 排除已取消的预约
                    ((o.appointmentTime < endTime && o.eTime > startTime)) // 时间段重叠判断
                ).ToList();

                bool hasConflict = existingSchedules.Any() || existingConsultations.Any();
                
                return Json(new { code = 0, hasConflict = hasConflict }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message }, JsonRequestBehavior.AllowGet);
            }
        }
        #endregion

        #region 编辑咨询
        public ActionResult EditConsultation(string id)
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

        public ActionResult EditConsultation3(string id)
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
            List<T_Doctor> DoctorList = db.T_Doctor.Where(o => !o.isDelete).OrderBy(o => o.number).ToList();
            ViewBag.DoctorList = DoctorList;
            
            return View();
        }

        [HttpPost]
        public ActionResult Editconsultation3(string gid, string address,long doctorID, string appointmentTime, float duration)
        {
            try
            {
                T_Admin admin = Session["admin"] as T_Admin;
                if (admin == null)
                {
                    return Json(new { code = -1, msg = "提交失败，请刷新页面" });
                }
                T_Consultation consultation = db.T_Consultation.Where(o => !o.isDelete && o.gId == gid).FirstOrDefault();
                if (consultation != null)
                {
                    consultation.appointmentTime = DateTime.Parse(appointmentTime);
                    consultation.eTime = consultation.appointmentTime.AddHours(duration);
                    TimeSpan hoursSpan = new TimeSpan(consultation.eTime.Ticks - consultation.appointmentTime.Ticks);          
                    consultation.updateTime = DateTime.Now;
                    consultation.handler = admin.ID.ToString();
                    consultation.address = address;
                    consultation.doctorID = doctorID;
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "提交成功" });
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

        public ActionResult EditConsultation0(string id)
        {
            T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.gId == id).FirstOrDefault();
            ViewBag.consultation = consultation;
            string ss = consultation.appointmentTime.ToString("yyyy-MM-dd HH:mm");
            ViewBag.getDate = consultation.appointmentTime.ToString("yyyy-MM-dd");
            ViewBag.gettime = consultation.appointmentTime.ToString("HH:mm");
            T_SystemSettings systemSettings = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 1).FirstOrDefault();
            ViewBag.EndDay = DateTime.Now.AddDays((int)systemSettings.number).ToString("yyyy-MM-dd");
            ViewBag.time0 = DateTime.Now.AddDays(1).ToString("yyyy-MM-dd");
            return View();
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
                if(money<1)
                {
                    return Json(new { code = -1, msg = "不能小于1元" });
                }
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
                return Json(new { code = 0, msg = "补缴费提交成功，请提醒用户及时缴费。" });
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 个案记录表
        public ActionResult CaseRecord(long id)
        {
            T_CaseRecord CaseRecord = db.T_CaseRecord.FirstOrDefault(o => !o.isDelete && o.ID == id);
            if (CaseRecord == null) { return Content(" 查询出错！"); }
            ViewBag.CaseRecord = CaseRecord;

            T_Consultation consultation = db.T_Consultation.Include("User").Include("doctor").Include("admin").Where(o => !o.isDelete && o.gId == CaseRecord.gId).FirstOrDefault();
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
        public ActionResult EditCaseRecord(string id)
        {
            T_CaseRecord CaseRecord = db.T_CaseRecord.Where(o => !o.isDelete && o.gId == id).OrderByDescending(o => o.EditeTime).FirstOrDefault();
            if (CaseRecord == null) { CaseRecord = new T_CaseRecord(id); }
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
        
        //咨询师申请个案记录修改的审核权
        [HttpPost]
        public ActionResult CaseRecordQC(long id, bool isSure)
        {
            try
            {
                T_CaseRecord updateCaseRecord = db.T_CaseRecord.FirstOrDefault(o => !o.isDelete && o.ID == id);
                updateCaseRecord.IsSure = isSure;
                db.SaveChanges();
                return Json(new { code = 0, msg = "心理咨询个案记录表修改申请审核通过。" });
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion
        
        #region 日历
        // GET: /main/dateCalendar
        public ActionResult MyDateCalendar()
        {
            List<T_SystemSettings> roomList = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 12).ToList();
            ViewBag.roomList = roomList;
            List<T_Doctor> DoctorList = db.T_Doctor.Where(o => !o.isDelete).OrderBy(o => o.number).ToList();
            ViewBag.DoctorList = DoctorList;
            return View();
        }
        #endregion

        #region 咨询预约登记
        public ActionResult wenjuanR(string id)
        {
            ViewBag.gId = id;
            return View();
        }

        public ActionResult SubmitInfo(long gId)
        {
            var SubUser = db.T_SubUser.Where(s => s.UserID == gId).OrderByDescending(o=>o.SubTime).FirstOrDefault();

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
            var SubFormData = db.T_SubUserData.Where(o => o.SubUserID == SubUser.ID).Select(sf => new { SubFormID = sf.SubUserID, OptionID = sf.OptionID, Content = sf.Content }).ToList();
            var Item = db.T_Item.Include("Option").Include("ItemType").Where(o => o.FormID == Form.ID && !o.IsDelete).OrderBy(o => o.Order).Select(o => new
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

        // 取消咨询记录
        [HttpPost]
        public ActionResult CancelConsultation(string gid)
        {
            try
            {
                T_Admin admin = Session["admin"] as T_Admin;
                if (admin == null)
                {
                    return Json(new { code = -1, msg = "请先登录" }, JsonRequestBehavior.AllowGet);
                }

                // 获取咨询记录
                T_Consultation consultation = db.T_Consultation.Where(o => !o.isDelete && o.gId == gid).FirstOrDefault();
                if (consultation == null)
                {
                    return Json(new { code = -1, msg = "咨询记录不存在" }, JsonRequestBehavior.AllowGet);
                }

                // 检查是否可以取消（只有未完成的咨询可以取消）
                if (consultation.State >= ConsultationState.Reported)
                {
                    return Json(new { code = -1, msg = "该咨询已完成，无法取消" }, JsonRequestBehavior.AllowGet);
                }

                // 更新状态为已取消
                consultation.State = ConsultationState.Cancelled;
                consultation.updateTime = DateTime.Now;
                consultation.handler = admin.ID.ToString();

                // 如果已预约时间，需要释放排班
                if (consultation.State >= ConsultationState.TimeConfirmed)
                {
                    var schedule = db.T_DoctorSchedule.Where(o => !o.isDelete && o.doctorID == consultation.doctorID && 
                        o.startTime == consultation.appointmentTime).FirstOrDefault();
                    if (schedule != null)
                    {
                        schedule.numSign = Math.Max(0, schedule.numSign - 1);
                    }
                }

                db.SaveChanges();

                return Json(new { code = 0, msg = "咨询记录已取消" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = "取消失败：" + ex.Message }, JsonRequestBehavior.AllowGet);
            }
        }
    }
}
