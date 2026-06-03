using lxxl.Models;
using lxxl.Service;
using Newtonsoft.Json.Linq;
//using NPOI.HSSF.UserModel;
//using NPOI.SS.UserModel;
//using NPOI.SS.Util;
//using NPOI.XSSF.UserModel;
using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Controllers
{
    public class mapiController : Controller
    {
        public TMLSContext db = new TMLSContext();
        int pagesize = 15;

        //
        // GET: /main/
        public ActionResult Index()
        {
            return View();
        }

        #region 管理员列表
        // GET: /main/adminLst
        public ActionResult adminLst()
        {
            return View();
        }

        public ActionResult GetAdminList(int page = 1, int limit = 15, string keyword = null)
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
                var listdb = alistdb.OrderByDescending(o => o.CreateTime).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.UserName,
                    password = "******",
                    o.Name,
                    time = o.CreateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    o.Tel,
                    type = o.Type == 1 ? "管理员" : o.Type == 2 ? "咨询师" : "其他"
                    //type = o.type == 1 ? "超级管理员" : o.type == 2 ? "管理员" : o.type == 3 ? "统计师" : o.type == 4 ? "专家" : "其他"
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 用户列表
        public ActionResult GetUserList(int page = 1, int limit = 15, string keyword = null)
        {
            try
            {
                var alistdb = db.T_Doctor.Where(o => !o.isDelete && (o.name.Contains(keyword) || o.tel.Contains(keyword) || o.hospitalName.Contains(keyword))).Select(o => new
                {
                    o.ID,
                    o.name,
                    o.tel,
                    o.email,
                    o.createTime,
                    o.hospitalName,
                    o.departmentName,
                    o.position,
                    o.nickName,
                    o.number,
                    o.SourceID
                }).ToList();
                int count = alistdb.Count;
                var listdb = alistdb.OrderBy(o => o.number).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.name,
                    o.tel,
                    o.email,
                    o.hospitalName,
                    o.departmentName,
                    o.position,
                    o.nickName,
                    time = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    SourceID = o.SourceID == 0 ? "网上" : "导入"
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 编辑用户
        public ActionResult EditUser(string field = "")
        {
            try
            {
                JObject jsonObject = JObject.Parse(field);
                long id = long.Parse(jsonObject["id"].ToString());
                T_Admin admin = Session["admin"] as T_Admin;
                var ho = db.T_Doctor.Where(o => !o.isDelete && o.ID == id).FirstOrDefault();
                if (ho != null)
                {
                    ho.name = jsonObject["title"].ToString();
                    ho.hospitalName = jsonObject["hospitalName"].ToString();
                    ho.tel = jsonObject["phone"].ToString();
                    ho.email = jsonObject["email"].ToString();
                    ho.departmentName = jsonObject["departmentName"].ToString();
                    ho.position = jsonObject["position"].ToString();
                    db.SaveChanges();

                    CacheHelper.ClearDoctorCache();

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

        #region 角色管理
        public ActionResult GetRoleList(int page = 1, int limit = 10, string keyword = null)
        {
            try
            {
                var alistdb = db.T_Role.Where(o => !o.isDelete).Select(o => new
                {
                    o.ID,
                    o.roleName,
                    o.authority,
                    o.createTime,
                }).ToList();
                int count = alistdb.Count;
                var listdb = alistdb.OrderBy(o => o.ID).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.ID,
                    o.roleName,
                    time = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    o.authority,
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 系统日志
        public ActionResult GetLogList(int page = 1, int limit = 15, string keyword = "", string chooseDay = "")
        {
            try
            {
                DateTime staT = DateTime.Parse("2020-01-01");
                DateTime endT = DateTime.Now.AddDays(1);
                if (!string.IsNullOrEmpty(chooseDay))
                {
                    staT = DateTime.Parse(chooseDay.Substring(0, 10));
                    endT = DateTime.Parse(chooseDay.Substring(13, 10)).AddDays(1);
                }
                string[] controllerArray = { "wapyy", "wapgl", "main" };
                var alistdb = db.T_Log.Where(o => !o.isDelete && o.url.Contains(keyword) && controllerArray.Contains(o.controller) && o.getType <= 3 && o.createTime >= staT && o.createTime < endT).Select(o => new
                {
                    o.id,
                    o.getType,
                    o.adminId,
                    o.url,
                    o.createTime,
                    o.controller,
                    o.action,
                    o.remark
                }).ToList();
                int count = alistdb.Count;
                var listdb = alistdb.OrderBy(o => o.id).Skip((page - 1) * limit).Take(limit).Select(o => new
                {
                    o.id,
                    getType = o.getType == 1 ? "管理员" : o.getType == 2 ? "管理员手机端" : o.getType == 3 ? "医生" : o.getType == 4 ? "其他" : "游客",
                    o.adminId,
                    o.remark,
                    o.url,
                    createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    o.controller,
                    o.action
                }).ToList();
                return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        #endregion

        #region 邮箱服务器配置
        // GET: /main/emailC
        public ActionResult emailC()
        {
            return View();
        }
        public ActionResult Getemail(string gid = "")
        {
            try
            {
                T_Admin admin = Session["admin"] as T_Admin;
                var listdb = db.T_EmailSettings.Where(o => !o.isDelete && o.adminID == admin.ID).FirstOrDefault();//o => new
                //{
                //    o.id,
                //    o.smtp,
                //    o.fromAddress,
                //    o.frompwd,
                //    o.port,
                //    o.isSSL
                //}).ToString(); 
                if (listdb != null)
                {
                    return Json(new { code = 0, data = listdb, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    var data = new Dictionary<string, object>
                    {
                        {"smtp", ""},
                        {"fromAddress", ""},
                        {"frompwd", ""},
                        {"port", 587},
                        {"isSSL", true}
                    };
                    return Json(new { code = 0, data = data, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }

        public ActionResult Editemail(string field = "")
        {
            try
            {
                T_Admin admin = Session["admin"] as T_Admin;
                var ho = db.T_EmailSettings.Where(o => !o.isDelete && o.adminID == admin.ID).FirstOrDefault();
                JObject jsonObject = JObject.Parse(field);
                if (ho != null)
                {
                    ho.smtp = jsonObject["smtp"].ToString();
                    ho.fromAddress = jsonObject["fromAddress"].ToString();
                    ho.frompwd = jsonObject["frompwd"].ToString();
                    ho.port = int.Parse(jsonObject["port"].ToString());
                    ho.isSSL = jsonObject["isSSL"].ToString() == "on" ? true : false;
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "提交成功" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    db.T_EmailSettings.Add(new T_EmailSettings(admin.ID, jsonObject["smtp"].ToString(), jsonObject["fromAddress"].ToString(), jsonObject["frompwd"].ToString(), int.Parse(jsonObject["port"].ToString()), jsonObject["isSSL"].ToString() == "on" ? true : false));
                    db.SaveChanges();
                    return Json(new { code = 0, msg = "提交成功" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }
        public ActionResult testemail(string field = "{'smtp':'smtp.163.com','fromAddress':'03123312@163.com','frompwd':'Tiderway@3188','port':'587','isSSL':'on'}")
        {
            try
            {
                T_EmailSettings ho = new T_EmailSettings();
                JObject jsonObject = JObject.Parse(field);
                ho.smtp = jsonObject["smtp"].ToString();
                ho.fromAddress = jsonObject["fromAddress"].ToString();
                ho.frompwd = jsonObject["frompwd"].ToString();
                ho.port = int.Parse(jsonObject["port"].ToString());
                ho.isSSL = jsonObject["isSSL"].ToString() == "on" ? true : false;
                bool res = SendMsg.SendMailtest2(ho.fromAddress, ho.fromAddress, ho.smtp, ho.frompwd, "邮箱测试", "邮箱测试", ho.port, ho.isSSL);
                if (res)
                {
                    return Json(new { code = 0, msg = "测试成功" }, JsonRequestBehavior.AllowGet);
                }
                else
                {

                    return Json(new { code = -1, msg = "测试失败" }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message }, JsonRequestBehavior.AllowGet);
            }
        }
        #endregion



        #region 短信平台配置
        // GET: /main/msnC
        public ActionResult msnC()
        {
            return View();
        }
        #endregion

        //
        // GET: /main/consultationLst
        public ActionResult consultationLst()
        {
            return View();
        }

        //
        // GET: /main/test
        public ActionResult test()
        {
            return View();
        }

        #region 获取预约咨询列表
        //public ActionResult GetConsultationList(int page = 1, int limit = 15, string keyword = "", string chooseDay = "")
        //{
        //    try
        //    {
        //        if (string.IsNullOrEmpty(chooseDay))
        //        {
        //            var alistdb = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && (o.doctor.name.Contains(keyword) || o.doctor.tel.Contains(keyword) || o.doctor.hospitalName.Contains(keyword))).Select(o => new
        //            {
        //                o.id,
        //                o.gId,
        //                o.doctor,
        //                o.projectName,
        //                o.createTime,
        //                o.diseaseArea,
        //                o.content1,
        //                o.problems,
        //                o.expectedTime,
        //                o.remark,
        //                o.type,
        //                o.appointmentTime,
        //                o.handler,
        //                o.cTime,
        //                o.duration,
        //                o.PIteam,
        //                o.projectSource,
        //                o.expert,
        //                o.record,
        //                o.upfile,
        //                o.intention,
        //                o.isSend,
        //                o.isCheck,
        //                o.state,
        //                o.updateTime,
        //                o.homeRenark
        //            }).ToList();
        //            int count = alistdb.Count;
        //            var listdb = alistdb.OrderBy(o => o.id).Skip((page - 1) * limit).Take(limit).Select(o => new
        //            {
        //                o.id,
        //                o.gId,
        //                name = o.doctor.name,
        //                tel = o.doctor.tel,
        //                email = o.doctor.email,
        //                o.projectName,
        //                createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
        //                hospital = o.doctor.hospitalName,
        //                department = o.doctor.departmentName,
        //                position = o.doctor.position,
        //                o.diseaseArea,
        //                o.content1,
        //                o.problems,
        //                o.expectedTime,
        //                o.remark,
        //                o.type,
        //                appointmentTime = o.appointmentTime.ToString("yyyy-MM-dd HH:mm"),
        //                o.handler,
        //                cTime = o.state < 3 ? "" : o.cTime.ToString("yyyy-MM-dd HH:mm"),
        //                duration = o.state < 3 ? "" : (o.duration + "小时"),
        //                o.PIteam,
        //                o.projectSource,
        //                o.expert,
        //                o.record,
        //                o.upfile,
        //                o.intention,
        //                o.isSend,
        //                o.isCheck,
        //                state = o.state == 0 ? "新建预约" : o.state == 1 ? "预约时间未反馈" : o.state == 2 ? "预约成功" : o.state == 3 ? "已咨询已填报" : o.state == 4 ? "已关单" : o.state == 5 ? "转立项" : "已取消 ",
        //                updateTime = o.updateTime.ToString("yyyy-MM-dd HH:mm"),
        //                o.homeRenark
        //            }).ToList();
        //            return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
        //        }
        //        else
        //        {
        //            DateTime staT = DateTime.Parse(chooseDay.Substring(0, 10));
        //            DateTime endT = DateTime.Parse(chooseDay.Substring(13, 10)).AddDays(1);
        //            var alistdb = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.cTime >= staT && o.cTime < endT && (o.doctor.name.Contains(keyword) || o.doctor.tel.Contains(keyword) || o.doctor.hospitalName.Contains(keyword))).Select(o => new
        //            {
        //                o.id,
        //                o.gId,
        //                o.doctor,
        //                o.projectName,
        //                o.createTime,
        //                o.diseaseArea,
        //                o.content1,
        //                o.problems,
        //                o.expectedTime,
        //                o.remark,
        //                o.type,
        //                o.appointmentTime,
        //                o.handler,
        //                o.cTime,
        //                o.duration,
        //                o.PIteam,
        //                o.projectSource,
        //                o.expert,
        //                o.record,
        //                o.upfile,
        //                o.intention,
        //                o.isSend,
        //                o.isCheck,
        //                o.state,
        //                o.updateTime,
        //                o.homeRenark
        //            }).ToList();
        //            int count = alistdb.Count;
        //            var listdb = alistdb.OrderBy(o => o.id).Skip((page - 1) * limit).Take(limit).Select(o => new
        //            {
        //                o.id,
        //                o.gId,
        //                name = o.doctor.name,
        //                tel = o.doctor.tel,
        //                email = o.doctor.email,
        //                o.projectName,
        //                createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
        //                hospital = o.doctor.hospitalName,
        //                department = o.doctor.departmentName,
        //                position = o.doctor.position,
        //                o.diseaseArea,
        //                o.content1,
        //                o.problems,
        //                o.expectedTime,
        //                o.remark,
        //                o.type,
        //                appointmentTime = o.appointmentTime.ToString("yyyy-MM-dd HH:mm"),
        //                o.handler,
        //                cTime = o.state < 3 ? "" : o.cTime.ToString("yyyy-MM-dd HH:mm"),
        //                duration = o.state < 3 ? "" : (o.duration + "小时"),
        //                o.PIteam,
        //                o.projectSource,
        //                o.expert,
        //                o.record,
        //                o.upfile,
        //                o.intention,
        //                o.isSend,
        //                o.isCheck,
        //                state = o.state == 0 ? "新建预约" : o.state == 1 ? "预约时间未反馈" : o.state == 2 ? "预约成功" : o.state == 3 ? "已咨询已填报" : o.state == 4 ? "已关单" : o.state == 5 ? "转立项" : "已取消 ",
        //                updateTime = o.updateTime.ToString("yyyy-MM-dd HH:mm"),
        //                o.homeRenark
        //            }).ToList();
        //            return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
        //        }
        //    }
        //    catch (Exception ex)
        //    {
        //        return Json(new { code = -1, msg = "查询出错", count = 0 }, JsonRequestBehavior.AllowGet);
        //    }
        //}

        public ActionResult EditConsultation(string field = "")
        {
            try
            {
                JObject jsonObject = JObject.Parse(field);
                long id = long.Parse(jsonObject["id"].ToString());
                T_Admin admin = Session["admin"] as T_Admin;
                var ho = db.T_Doctor.Where(o => !o.isDelete && o.ID == id).FirstOrDefault();
                if (ho != null)
                {
                    ho.name = jsonObject["title"].ToString();
                    ho.hospitalName = jsonObject["hospitalName"].ToString();
                    ho.tel = jsonObject["phone"].ToString();
                    ho.email = jsonObject["email"].ToString();
                    ho.departmentName = jsonObject["departmentName"].ToString();
                    ho.position = jsonObject["position"].ToString();
                    db.SaveChanges();

                    CacheHelper.ClearDoctorCache();

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

        #region 获取预约咨询列表0
        public ActionResult GetConsultation0List(int page = 1, int limit = 15, string keyword = "")
        {
            var alistdb = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.State == 0 && o.type == 0 && (o.doctor.name.Contains(keyword) || o.doctor.tel.Contains(keyword) || o.doctor.hospitalName.Contains(keyword))).Select(o => new
            {
                o.ID,
                o.gId,
                o.doctor,
                o.createTime,
                o.content1,
                o.problems,
                o.expectedTime,
                o.remark,
                o.type,
                o.appointmentTime,
                o.handler,
                o.cTime,
                o.duration,
                o.expert,
                o.record,
                o.upfile,
                o.updateTime,
                o.homeRenark
            }).ToList();
            int count = alistdb.Count;
            var listdb = alistdb.OrderByDescending(o => o.appointmentTime).Skip((page - 1) * limit).Take(limit).Select(o => new
            {
                o.ID,
                o.gId,
                name = o.doctor.name,
                tel = o.doctor.tel,
                email = o.doctor.email,
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
                cTime = o.cTime.ToString("yyyy-MM-dd HH:mm"),
                o.duration,
                o.expert,
                o.record,
                o.upfile,
                updateTime = o.updateTime.ToString("yyyy-MM-dd HH:mm"),
                o.homeRenark
            }).ToList();
            return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
        }
        #endregion

        #region 获取预约咨询列表1
        //public ActionResult GetConsultation1List(int page = 1, int limit = 15, string keyword = "")
        //{
        //    var alistdb = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.state == 1 && o.type == 0 && (o.doctor.name.Contains(keyword) || o.doctor.tel.Contains(keyword) || o.doctor.hospitalName.Contains(keyword))).Select(o => new
        //    {
        //        o.id,
        //        o.gId,
        //        o.doctor,
        //        o.projectName,
        //        o.createTime,
        //        o.diseaseArea,
        //        o.content1,
        //        o.problems,
        //        o.expectedTime,
        //        o.remark,
        //        o.type,
        //        o.appointmentTime,
        //        o.handler,
        //        o.cTime,
        //        o.duration,
        //        o.PIteam,
        //        o.projectSource,
        //        o.expert,
        //        o.record,
        //        o.upfile,
        //        o.intention,
        //        o.isSend,
        //        o.isCheck,
        //        o.state,
        //        o.updateTime,
        //        o.homeRenark
        //    }).ToList();
        //    int count = alistdb.Count;
        //    var listdb = alistdb.OrderBy(o => o.id).Skip((page - 1) * limit).Take(limit).Select(o => new
        //    {
        //        o.id,
        //        o.gId,
        //        name = o.doctor.name,
        //        tel = o.doctor.tel,
        //        email = o.doctor.email,
        //        o.projectName,
        //        createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
        //        hospital = o.doctor.hospitalName,
        //        department = o.doctor.departmentName,
        //        position = o.doctor.position,
        //        o.diseaseArea,
        //        o.content1,
        //        o.problems,
        //        o.expectedTime,
        //        o.remark,
        //        o.type,
        //        appointmentTime = o.appointmentTime.ToString("yyyy-MM-dd HH:mm"),
        //        o.handler,
        //        cTime = o.cTime.ToString("yyyy-MM-dd HH:mm"),
        //        o.duration,
        //        o.PIteam,
        //        o.projectSource,
        //        o.expert,
        //        o.record,
        //        o.upfile,
        //        o.intention,
        //        o.isSend,
        //        o.isCheck,
        //        o.state,
        //        updateTime = o.updateTime.ToString("yyyy-MM-dd HH:mm"),
        //        o.homeRenark
        //    }).ToList();
        //    return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
        //}
        #endregion

        #region 获取预约咨询列表2
        //public ActionResult GetConsultation2List(int page = 1, int limit = 15, string keyword = "")
        //{
        //    var alistdb = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.state == 2 && o.type == 0 && (o.doctor.name.Contains(keyword) || o.doctor.tel.Contains(keyword) || o.doctor.hospitalName.Contains(keyword))).Select(o => new
        //    {
        //        o.id,
        //        o.gId,
        //        o.doctor,
        //        o.projectName,
        //        o.createTime,
        //        o.diseaseArea,
        //        o.content1,
        //        o.problems,
        //        o.expectedTime,
        //        o.remark,
        //        o.type,
        //        o.appointmentTime,
        //        o.handler,
        //        o.cTime,
        //        o.duration,
        //        o.PIteam,
        //        o.projectSource,
        //        o.expert,
        //        o.record,
        //        o.upfile,
        //        o.intention,
        //        o.isSend,
        //        o.isCheck,
        //        o.state,
        //        o.updateTime,
        //        o.homeRenark
        //    }).ToList();
        //    int count = alistdb.Count;
        //    var listdb = alistdb.OrderBy(o => o.id).Skip((page - 1) * limit).Take(limit).Select(o => new
        //    {
        //        o.id,
        //        o.gId,
        //        name = o.doctor.name,
        //        tel = o.doctor.tel,
        //        email = o.doctor.email,
        //        o.projectName,
        //        createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
        //        hospital = o.doctor.hospitalName,
        //        department = o.doctor.departmentName,
        //        position = o.doctor.position,
        //        o.diseaseArea,
        //        o.content1,
        //        o.problems,
        //        o.expectedTime,
        //        o.remark,
        //        o.type,
        //        appointmentTime = o.appointmentTime.ToString("yyyy-MM-dd HH:mm"),
        //        o.handler,
        //        cTime = o.cTime.ToString("yyyy-MM-dd HH:mm"),
        //        o.duration,
        //        o.PIteam,
        //        o.projectSource,
        //        o.expert,
        //        o.record,
        //        o.upfile,
        //        o.intention,
        //        o.isSend,
        //        o.isCheck,
        //        o.state,
        //        updateTime = o.updateTime.ToString("yyyy-MM-dd HH:mm"),
        //        o.homeRenark
        //    }).ToList();
        //    return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
        //}
        #endregion

        #region 获取预约咨询列表3
        //public ActionResult GetConsultation3List(int page = 1, int limit = 15, string keyword = "")
        //{
        //    var alistdb = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.state == 3 && (o.doctor.name.Contains(keyword) || o.doctor.tel.Contains(keyword) || o.doctor.hospitalName.Contains(keyword))).Select(o => new
        //    {
        //        o.id,
        //        o.gId,
        //        o.doctor,
        //        o.projectName,
        //        o.createTime,
        //        o.diseaseArea,
        //        o.content1,
        //        o.problems,
        //        o.expectedTime,
        //        o.remark,
        //        o.type,
        //        o.appointmentTime,
        //        o.handler,
        //        o.cTime,
        //        o.duration,
        //        o.PIteam,
        //        o.projectSource,
        //        o.expert,
        //        o.record,
        //        o.upfile,
        //        o.intention,
        //        o.isSend,
        //        o.isCheck,
        //        o.state,
        //        o.updateTime,
        //        o.homeRenark
        //    }).ToList();
        //    int count = alistdb.Count;
        //    var listdb = alistdb.OrderBy(o => o.id).Skip((page - 1) * limit).Take(limit).Select(o => new
        //    {
        //        o.id,
        //        o.gId,
        //        name = o.doctor.name,
        //        tel = o.doctor.tel,
        //        email = o.doctor.email,
        //        o.projectName,
        //        createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
        //        hospital = o.doctor.hospitalName,
        //        department = o.doctor.departmentName,
        //        position = o.doctor.position,
        //        o.diseaseArea,
        //        o.content1,
        //        o.problems,
        //        o.expectedTime,
        //        o.remark,
        //        o.type,
        //        appointmentTime = o.appointmentTime.ToString("yyyy-MM-dd HH:mm"),
        //        o.handler,
        //        cTime = o.cTime.ToString("yyyy-MM-dd HH:mm"),
        //        o.duration,
        //        o.PIteam,
        //        o.projectSource,
        //        o.expert,
        //        o.record,
        //        o.upfile,
        //        o.intention,
        //        o.isSend,
        //        o.isCheck,
        //        o.state,
        //        updateTime = o.updateTime.ToString("yyyy-MM-dd HH:mm"),
        //        o.homeRenark
        //    }).ToList();
        //    return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
        //}
        #endregion

        #region 获取预约咨询列表4
        //public ActionResult GetConsultation4List(int page = 1, int limit = 15, string keyword = "")
        //{
        //    var alistdb = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.state == 4 && (o.doctor.name.Contains(keyword) || o.doctor.tel.Contains(keyword) || o.doctor.hospitalName.Contains(keyword))).Select(o => new
        //    {
        //        o.id,
        //        o.gId,
        //        o.doctor,
        //        o.projectName,
        //        o.createTime,
        //        o.diseaseArea,
        //        o.content1,
        //        o.problems,
        //        o.expectedTime,
        //        o.remark,
        //        o.type,
        //        o.appointmentTime,
        //        o.handler,
        //        o.cTime,
        //        o.duration,
        //        o.PIteam,
        //        o.projectSource,
        //        o.expert,
        //        o.record,
        //        o.upfile,
        //        o.intention,
        //        o.isSend,
        //        o.isCheck,
        //        o.state,
        //        o.updateTime,
        //        o.homeRenark
        //    }).ToList();
        //    int count = alistdb.Count;
        //    var listdb = alistdb.OrderBy(o => o.id).Skip((page - 1) * limit).Take(limit).Select(o => new
        //    {
        //        o.id,
        //        o.gId,
        //        name = o.doctor.name,
        //        tel = o.doctor.tel,
        //        email = o.doctor.email,
        //        o.projectName,
        //        createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
        //        hospital = o.doctor.hospitalName,
        //        department = o.doctor.departmentName,
        //        position = o.doctor.position,
        //        o.diseaseArea,
        //        o.content1,
        //        o.problems,
        //        o.expectedTime,
        //        o.remark,
        //        o.type,
        //        appointmentTime = o.appointmentTime.ToString("yyyy-MM-dd HH:mm"),
        //        o.handler,
        //        cTime = o.cTime.ToString("yyyy-MM-dd HH:mm"),
        //        o.duration,
        //        o.PIteam,
        //        o.projectSource,
        //        o.expert,
        //        o.record,
        //        o.upfile,
        //        o.intention,
        //        o.isSend,
        //        o.isCheck,
        //        o.state,
        //        updateTime = o.updateTime.ToString("yyyy-MM-dd HH:mm"),
        //        o.homeRenark
        //    }).ToList();
        //    return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
        //}
        #endregion

        #region 获取预约咨询列表5
        //public ActionResult GetConsultation5List(int page = 1, int limit = 15, string keyword = "")
        //{
        //    var alistdb = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.state >= 5 && (o.doctor.name.Contains(keyword) || o.doctor.tel.Contains(keyword) || o.doctor.hospitalName.Contains(keyword))).Select(o => new
        //    {
        //        o.id,
        //        o.gId,
        //        o.doctor,
        //        o.projectName,
        //        o.createTime,
        //        o.diseaseArea,
        //        o.content1,
        //        o.problems,
        //        o.expectedTime,
        //        o.remark,
        //        o.type,
        //        o.appointmentTime,
        //        o.handler,
        //        o.cTime,
        //        o.duration,
        //        o.PIteam,
        //        o.projectSource,
        //        o.expert,
        //        o.record,
        //        o.upfile,
        //        o.intention,
        //        o.isSend,
        //        o.isCheck,
        //        o.state,
        //        o.updateTime,
        //        o.homeRenark
        //    }).ToList();
        //    int count = alistdb.Count;
        //    var listdb = alistdb.OrderBy(o => o.id).Skip((page - 1) * limit).Take(limit).Select(o => new
        //    {
        //        o.id,
        //        o.gId,
        //        name = o.doctor.name,
        //        tel = o.doctor.tel,
        //        email = o.doctor.email,
        //        o.projectName,
        //        createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
        //        hospital = o.doctor.hospitalName,
        //        department = o.doctor.departmentName,
        //        position = o.doctor.position,
        //        o.diseaseArea,
        //        o.content1,
        //        o.problems,
        //        o.expectedTime,
        //        o.remark,
        //        o.type,
        //        appointmentTime = o.appointmentTime.ToString("yyyy-MM-dd HH:mm"),
        //        o.handler,
        //        cTime = o.cTime.ToString("yyyy-MM-dd HH:mm"),
        //        o.duration,
        //        o.PIteam,
        //        o.projectSource,
        //        o.expert,
        //        o.record,
        //        o.upfile,
        //        o.intention,
        //        o.isSend,
        //        o.isCheck,
        //        o.state,
        //        updateTime = o.updateTime.ToString("yyyy-MM-dd HH:mm"),
        //        o.homeRenark
        //    }).ToList();
        //    return Json(new { code = 0, data = listdb, msg = "获取成功", count = count }, JsonRequestBehavior.AllowGet);
        //}
        #endregion

        #region 确定咨询预约时间
        [HttpPost]
        public ActionResult EditconsultationTime(string gid, string appointmentTime, string eTime = "", string remark = "")
        {
            try
            {
                //T_Doctor Doctor = Session["psyD"] as T_Doctor;
                T_Admin admin = Session["admin"] as T_Admin;
                if (admin == null)
                {
                    return Json(new { code = -1, msg = "提交失败，请刷新页面" });
                }
                T_Consultation consultation = db.T_Consultation.Include("doctor").Include("User").Where(o => !o.isDelete && o.State <= 2 && o.gId == gid).FirstOrDefault();
                if (consultation != null)
                {
                    consultation.appointmentTime = DateTime.Parse(appointmentTime);
                    consultation.eTime = DateTime.Parse(eTime);
                    TimeSpan hoursSpan= new TimeSpan(consultation.eTime.Ticks-consultation.appointmentTime.Ticks);
                    //consultation.duration = hoursSpan.TotalHours;
                    consultation.updateTime = DateTime.Now;
                    consultation.handler = admin.ID.ToString();
                    consultation.remark = remark;
                    consultation.State = 2;
                    db.SaveChanges();
                    //WeiXinHelper.SendMsg2(consultation.doctor.openid, "您有1条咨询预约时间确定", appointmentTime + " 咨询时长：" + duration + "小时", consultation.content1, "点击查看详情，请尽快处理!", "/wapyy/consultationTimeByU/" + consultation.gId);
                    WeiXinHelper.SendMsg1(consultation.User.OpenID, consultation.name, consultation.doctor.name, consultation.appointmentTime.ToString("yyyy-MM-dd HH:mm:ss"), "您有一条预约时间确定消息，请查阅！", "/Patient/Consulation?ordergid=" + consultation.gId);
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

        
        [HttpPost]
        public ActionResult EditconsultationTimeD(string gid, string appointmentTime, string eTime = "", string remark = "")
        {
            try
            {
                T_Doctor Doctor = Session["psyD"] as T_Doctor;
                //T_Admin admin = Session["admin"] as T_Admin;
                if (Doctor == null)
                {
                    return Json(new { code = -1, msg = "提交失败，请刷新页面" });
                }
                T_Consultation consultation = db.T_Consultation.Include("doctor").Include("User").Where(o => !o.isDelete && o.State <= 2 && o.gId == gid).FirstOrDefault();
                if (consultation != null)
                {
                    consultation.appointmentTime = DateTime.Parse(appointmentTime);
                    consultation.eTime = DateTime.Parse(eTime);
                    TimeSpan hoursSpan= new TimeSpan(consultation.eTime.Ticks-consultation.appointmentTime.Ticks);
                    //consultation.duration = hoursSpan.TotalHours;
                    consultation.updateTime = DateTime.Now;
                    consultation.handler = Doctor.ID.ToString();
                    consultation.remark = remark;
                    consultation.State = 2;
                    db.SaveChanges();
                    //WeiXinHelper.SendMsg2(consultation.doctor.openid, "您有1条咨询预约时间确定", appointmentTime + " 咨询时长：" + duration + "小时", consultation.content1, "点击查看详情，请尽快处理!", "/wapyy/consultationTimeByU/" + consultation.gId);
                    WeiXinHelper.SendMsg1(consultation.User.OpenID, consultation.name, consultation.doctor.name, consultation.appointmentTime.ToString("yyyy-MM-dd HH:mm:ss"), "您有一条预约时间确定消息，请查阅！", "/Patient/Consulation?ordergid=" + consultation.gId);
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

        #endregion

        #region 提交咨询数据
        //[HttpPost]
        //public ActionResult postConsultationRecord(string gid, string PIteam, string projectName, string projectSource, string cTime, string duration, string expert, string record, string upfile, string intention, bool isSend = false, bool isguandan = false)
        //{
        //    try
        //    {
        //        T_Admin admin = Session["admin"] as T_Admin;
        //        if (admin == null)
        //        {
        //            return Json(new { code = -1, msg = "提交失败，请刷新页面" });
        //        }
        //        T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.state == 2 && o.gId == gid).FirstOrDefault();
        //        if (consultation != null)
        //        {
        //            consultation.cTime = DateTime.Parse(cTime);
        //            consultation.duration = double.Parse(duration);
        //            consultation.updateTime = DateTime.Now;
        //            consultation.handler = admin.gId;
        //            consultation.PIteam = PIteam;
        //            consultation.projectName = projectName;
        //            consultation.projectSource = projectSource;
        //            consultation.expert = expert;
        //            consultation.record = record;
        //            consultation.upfile = upfile;
        //            consultation.intention = intention;
        //            consultation.isSend = isSend;
        //            if (isguandan) { consultation.state = 4; }
        //            else
        //            {
        //                consultation.state = 3;
        //            }
        //            db.SaveChanges();
        //            if (isSend)
        //            {
        //                T_EmailSettings emailSetting = db.T_EmailSettings.Where(o => !o.isDelete && o.adminID == admin.id).FirstOrDefault();
        //                bool res = SendMsg.SendMailtest2(emailSetting.fromAddress, consultation.doctor.email, emailSetting.smtp, emailSetting.frompwd, "立项邮箱测试", "立项邮件", emailSetting.port, emailSetting.isSSL, "C:/progect/kpywxyy/kpywxyy/Upload/lixiang/立项文件.docx");
        //                if (res)
        //                {
        //                    return Json(new { code = 0, msg = "预约单填报信息已完成，发送邮件成功。" }, JsonRequestBehavior.AllowGet);
        //                }
        //                else
        //                {

        //                    return Json(new { code = 0, msg = "预约单填报信息已完成，发送邮件失败。" }, JsonRequestBehavior.AllowGet);
        //                }
        //            }
        //            return Json(new { code = 0, msg = "预约单填报信息已完成。" });
        //        }
        //        else
        //        {
        //            return Json(new { code = 0, msg = "提交失败" });
        //        }
        //    }
        //    catch (Exception ex)
        //    {
        //        return Json(new { code = -1, msg = ex.Message });
        //    }
        //}
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

        #region 提交关单数据
        [HttpPost]
        public ActionResult postConsultationGD(string gid, string upfile, bool isguandan = false)
        {
            try
            {
                T_Admin admin = Session["admin"] as T_Admin;
                if (admin == null)
                {
                    return Json(new { code = -1, msg = "提交失败，请刷新页面" });
                }
                T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.State == 4 && o.gId == gid).FirstOrDefault();
                if (consultation != null)
                {
                    consultation.upfile = upfile;
                    if (isguandan) { consultation.State = 5; } // 已关单
                    else
                    {
                        consultation.State = 4; // 保持已填报状态
                    }
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
        #endregion

        #region 发立项申请表
        [HttpPost]
        public ActionResult postConsultationSend(string gid, bool isSend = false)
        {
            try
            {
                T_Admin admin = Session["admin"] as T_Admin;
                if (admin == null)
                {
                    return Json(new { code = -1, msg = "提交失败，请刷新页面" });
                }
                T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.State > 3 && o.gId == gid).FirstOrDefault();
                if (consultation != null)
                {
                    //consultation.IsSend = isSend;
                    //db.SaveChanges();
                    if (isSend)
                    {
                        T_EmailSettings emailSetting = db.T_EmailSettings.Where(o => !o.isDelete && o.adminID == admin.ID).FirstOrDefault();
                        bool res = SendMsg.SendMailtest2(emailSetting.fromAddress, consultation.doctor.email, emailSetting.smtp, emailSetting.frompwd, "立项邮箱测试", "立项邮件", emailSetting.port, emailSetting.isSSL, "C:/progect/kpywxyy/kpywxyy/Upload/lixiang/立项文件.docx");
                        if (res)
                        {
                            return Json(new { code = 0, msg = "发送邮件成功。" }, JsonRequestBehavior.AllowGet);
                        }
                        else
                        {

                            return Json(new { code = 0, msg = "发送邮件失败。" }, JsonRequestBehavior.AllowGet);
                        }
                    }
                    return Json(new { code = 0, msg = "发送邮件失败。" });
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

        #region 转立项
        [HttpPost]
        public ActionResult postConsultationCheck(string gid, short state = 5)
        {
            try
            {
                T_Admin admin = Session["admin"] as T_Admin;
                if (admin == null)
                {
                    return Json(new { code = -1, msg = "提交失败，请刷新页面" });
                }
                if (state == 6) // 转立项
                {
                    T_Consultation consultation = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.State >= 4 && o.gId == gid).FirstOrDefault();
                    if (consultation != null)
                    {
                        consultation.State = state;
                        db.SaveChanges();

                        return Json(new { code = 0, msg = "设置转立项成功。" }, JsonRequestBehavior.AllowGet);

                    }
                    return Json(new { code = 0, msg = "设置转立项失败。" });
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

        #region 导入
        //[HttpPost]
        //public ActionResult ImportExcel()
        //{
        //    try
        //    {
        //        T_Admin admin = Session["admin"] as T_Admin;
        //        if (admin == null)
        //        {
        //            return Json(new { code = -1, msg = "提交失败，请刷新页面" });
        //        }
        //        HttpPostedFileBase file = Request.Files["file"];//接收客户端传递过来的数据.
        //        string ComgId = Request["ComgId"];
        //        if (file == null)
        //        {
        //            return Json(new { errcode = -1, errmsg = "请选择上传的Excel文件" });
        //        }
        //        else
        //        {
        //            string FileType = ".xls,.xlsx";//定义上传文件的类型字符串

        //            string filename = Path.GetFileName(file.FileName);
        //            int filesize = file.ContentLength;//获取上传文件的大小单位为字节byte
        //            string fileEx = System.IO.Path.GetExtension(filename);//获取上传文件的扩展名
        //            string NoFileName = System.IO.Path.GetFileNameWithoutExtension(filename);//获取无扩展名的文件名
        //            if (!FileType.Contains(fileEx))
        //            {
        //                return Json(new { errcode = -1, errmsg = "文件类型不对，只能导入xls和xlsx格式的文件" });
        //            }

        //            string path = Server.MapPath("~/Upload/Excel");
        //            string FileName = DateTime.Now.ToString("yyyyMMddhhmmss") + NoFileName + fileEx;
        //            string savePath = Path.Combine(path, FileName);
        //            file.SaveAs(savePath);
        //            //string strConn;
        //            //if (savePath.EndsWith("xlsx"))
        //            //{
        //            //    strConn = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=" + savePath + ";" + "Extended Properties=Excel 12.0";
        //            //}
        //            //else
        //            //{
        //            //    strConn = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=" + savePath + ";" + "Extended Properties=Excel 8.0";
        //            //}
        //            //OleDbConnection conn = new OleDbConnection(strConn);
        //            //conn.Open();
        //            //OleDbDataAdapter myCommand = new OleDbDataAdapter("select * from [Sheet1$]", strConn);
        //            //DataSet myDataSet = new DataSet();
        //            //myCommand.Fill(myDataSet, "ExcelInfo");
        //            //DataTable table = myDataSet.Tables["ExcelInfo"].DefaultView.ToTable();
        //            //for (int i = 0; i < table.Rows.Count; i++)
        //            //{
        //            //    string Name = table.Rows[i][0].ToString();
        //            //    string IdCard = table.Rows[i][1].ToString();

        //            //}
        //            //db.SaveChanges();
        //            string filePath = savePath;
        //            IWorkbook wk = null;
        //            string extension = System.IO.Path.GetExtension(filePath);
        //            try
        //            {
        //                FileStream fs = System.IO.File.OpenRead(filePath);
        //                if (extension.Equals(".xls"))
        //                {
        //                    //把xls文件中的数据写入wk中
        //                    wk = new HSSFWorkbook(fs);
        //                }
        //                else
        //                {
        //                    //把xlsx文件中的数据写入wk中
        //                    wk = new XSSFWorkbook(fs);
        //                }

        //                fs.Close();
        //                //读取当前表数据
        //                ISheet sheet = wk.GetSheetAt(0);
        //                wk.Close();

        //                IRow row = sheet.GetRow(0);  //读取当前行数据

        //                //LastRowNum 是当前表的总行数-1
        //                for (int i = 1; i <= sheet.LastRowNum; i++)
        //                {
        //                    row = sheet.GetRow(i);  //读取当前行数据
        //                    if (row != null)
        //                    {
        //                        //string cTime = new SimpleDateFormat("yyyy-MM-dd").Format(row.GetCell(0).GetType());// row.GetCell(0).ToString();
        //                        DateTime cTime = row.GetCell(1).DateCellValue;
        //                        //string cTime = date.ToString("yyy-MM-dd");
        //                        double duration = row.GetCell(2) == null ? 0 : double.Parse(row.GetCell(2).ToString());
        //                        string name = row.GetCell(0).ToString();
        //                        string tel = row.GetCell(3).ToString();
        //                        string email = row.GetCell(4) == null ? "" : row.GetCell(4).ToString();
        //                        string PIteam = row.GetCell(5) == null ? "" : row.GetCell(5).ToString();
        //                        string hospitalName = row.GetCell(6) == null ? "" : row.GetCell(6).ToString();
        //                        string departmentName = row.GetCell(7) == null ? "" : row.GetCell(7).ToString();
        //                        string position = row.GetCell(8) == null ? "" : row.GetCell(8).ToString();
        //                        string projectName = row.GetCell(9) == null ? "" : row.GetCell(9).ToString();
        //                        string projectSource = row.GetCell(10) == null ? "" : row.GetCell(10).ToString();
        //                        string content1 = row.GetCell(11) == null ? "" : row.GetCell(11).ToString();
        //                        string diseaseArea = row.GetCell(12) == null ? "" : row.GetCell(12).ToString();
        //                        string problems = row.GetCell(13) == null ? "" : row.GetCell(13).ToString();
        //                        string expert = row.GetCell(14) == null ? "" : row.GetCell(14).ToString();
        //                        string record = row.GetCell(15) == null ? "" : row.GetCell(15).ToString();
        //                        string intention = row.GetCell(16) == null ? "" : row.GetCell(16).ToString();
        //                        bool isSend = row.GetCell(17) == null ? false : row.GetCell(17).ToString() == "是" ? true : false;
        //                        bool isCheck = row.GetCell(18) == null ? false : row.GetCell(18).ToString() == "是" ? true : false;

        //                        //T_Doctor doctor = db.T_Doctor.Where(o => !o.isDelete && o.name == name && o.tel == tel).FirstOrDefault();
        //                        T_Doctor doctor = db.T_Doctor.Where(o => !o.isDelete && o.name == name && o.tel == tel && o.hospitalName == hospitalName && o.departmentName == departmentName).FirstOrDefault();
        //                        if (doctor == null)
        //                        {
        //                            doctor = new T_Doctor("openid", name, hospitalName, departmentName, position, tel, email, "男", 30);
        //                            T_Hospital THospital = db.T_Hospital.FirstOrDefault(o => !o.isDelete && o.name.Contains(hospitalName));
        //                            if (THospital == null) { doctor.hospitalID = 1; } else { doctor.hospitalID = THospital.id; }
        //                            T_Department TDepartment = db.T_Department.FirstOrDefault(o => !o.isDelete && o.name.Contains(departmentName));
        //                            if (TDepartment == null) { doctor.departmentID = 1; } else { doctor.departmentID = TDepartment.id; }
        //                            doctor.SourceID = admin.id;
        //                            doctor = db.T_Doctor.Add(doctor);
        //                            db.SaveChanges();
        //                        }
        //                        T_Consultation consultation = new T_Consultation(doctor.id, diseaseArea, content1, problems, cTime.ToString("yyy-MM-dd"), "导入", 1);
        //                        consultation.adminID = admin != null ? admin.id : 1;
        //                        consultation.cTime = cTime;
        //                        consultation.duration = duration;
        //                        consultation.PIteam = PIteam;
        //                        consultation.projectName = projectName;
        //                        consultation.projectSource = projectSource;
        //                        consultation.expert = expert;
        //                        consultation.record = record;
        //                        consultation.intention = intention;
        //                        consultation.state = 4;
        //                        db.T_Consultation.Add(consultation);
        //                        db.SaveChanges();
        //                    }
        //                }

        //                return Json(new { errcode = 0, errmsg = "导入成功" });
        //            }

        //            catch (Exception e)
        //            {

        //                return Json(new { errcode = -1, errmsg = "导入失败" + e.Message });
        //            }
        //        }
        //    }
        //    catch (Exception ex)
        //    {
        //        return Json(new { errcode = -1, errmsg = "导入失败" + ex.Message });
        //    }
        //}

        //private static string GetCellValue(ICell cell)
        //{
        //    if (cell == null)
        //        return string.Empty;
        //    switch (cell.CellType)
        //    {
        //        case CellType.Blank:
        //            return string.Empty;
        //        case CellType.Boolean:
        //            return cell.BooleanCellValue.ToString();
        //        case CellType.Error:
        //            return cell.ErrorCellValue.ToString();
        //        case CellType.Numeric:
        //        case CellType.Unknown:
        //        default:
        //            return cell.ToString();//This is a trick to get the correct value of the cell. NumericCellValue will return a numeric value no matter the cell value is a date or a number
        //        case CellType.String:
        //            return cell.StringCellValue;
        //        case CellType.Formula:
        //            try
        //            {
        //                HSSFFormulaEvaluator e = new HSSFFormulaEvaluator(cell.Sheet.Workbook);
        //                e.EvaluateInCell(cell);
        //                return cell.ToString();
        //            }
        //            catch
        //            {
        //                return cell.NumericCellValue.ToString();
        //            }
        //    }
        //}
        #endregion

        #region 科室管理列表
        public ActionResult DepartmentLst()
        {
            List<T_Department> DepartmentList = db.T_Department.Where(o => !o.isDelete).ToList();
            ViewBag.DepartmentList = DepartmentList;
            return View();
        }
        #endregion

        #region 新增科室
        public ActionResult AddDepartment(long toDepartmentID)
        {
            T_Department Department = db.T_Department.Where(o => o.id == toDepartmentID).FirstOrDefault();
            ViewBag.Department = Department;
            return View();
        }

        [HttpPost]
        public ActionResult AddDepartment(T_Department Department)
        {
            T_Department oldDepartment = new T_Department();
            if (Department.toDepartmentID == 0)
            {
                oldDepartment = db.T_Department.Where(o => o.toDepartmentID == Department.toDepartmentID && o.name == Department.name).FirstOrDefault();
            }
            else
            {
                oldDepartment = db.T_Department.Where(o => o.toDepartmentID == Department.toDepartmentID && o.name == Department.name && o.grade == 2).FirstOrDefault();
            }
            if (oldDepartment != null)
            {
                if (oldDepartment.isDelete)
                {
                    oldDepartment.isDelete = false;
                    db.SaveChanges();
                }
                else
                {
                    return Content("no:该科室已存在");
                }
            }
            else
            {
                db.T_Department.Add(Department);
                db.SaveChanges();
                try
                {
                    db.Configuration.AutoDetectChangesEnabled = false;
                    List<long> longlist = db.T_Hospital.Where(o => !o.isDelete).Select(o => o.id).ToList();
                    foreach (var list in longlist)
                    {
                        db.T_HospitalDepartment.Add(new T_HospitalDepartment(list, Department.id));
                    }
                    db.SaveChanges();
                }
                finally
                {
                    db.Configuration.AutoDetectChangesEnabled = true;
                }
            }

            return Content("ok:添加成功");
        }
        #endregion

        #region 编辑科室
        public ActionResult EditDepartment(long id)
        {
            T_Department Department = db.T_Department.Where(o => o.id == id).FirstOrDefault();
            ViewBag.Department = Department;
            return View();
        }
        [HttpPost]
        public ActionResult EditDepartment(T_Department Department)
        {
            T_Department department = db.T_Department.Where(o => o.id == Department.id).FirstOrDefault();
            department.name = Department.name;
            db.SaveChanges();
            return Content("ok:修改成功");
        }
        #endregion

        #region 删除科室
        public ActionResult DelDepartment(long id)
        {
            T_Department Department = db.T_Department.Where(o => o.id == id && !o.isDelete).FirstOrDefault();
            if (Department != null)
            {
                if (db.T_Doctor.Where(o => o.departmentID == Department.id).Count() > 0)
                {
                    Session["alert"] = "删除失败，该科室下已有医生，不可以删除！";
                }
                else
                {
                    Department.isDelete = true;
                    db.SaveChanges();
                    Session["alert"] = "删除成功";
                }
            }
            else
                Session["alert"] = "该科室不存在,删除失败";
            string hosturl = Request["hosturl"];
            return Redirect(string.IsNullOrEmpty(hosturl) ? "/main/DepartmentLst" : hosturl);
        }
        #endregion

        #region 医院列表
        public ActionResult HospitalLst(int page = 1, string keyword = null)
        {
            if (keyword != null)
            {
                ViewBag.hospital = db.T_Hospital.Where(o => !o.isDelete && (o.name.Contains(keyword))).OrderBy(o => o.id).Skip((page - 1) * pagesize).Take(pagesize).ToList();
                ViewBag.count = db.T_Hospital.Where(o => !o.isDelete && (o.name.Contains(keyword))).Count();
            }
            else
            {
                ViewBag.hospital = db.T_Hospital.Where(o => !o.isDelete).OrderBy(o => o.id).Skip((page - 1) * pagesize).Take(pagesize).ToList();
                ViewBag.count = db.T_Hospital.Where(o => !o.isDelete).Count();
            }
            ViewBag.ThisPage = page;
            ViewBag.Pagesize = pagesize;
            ViewBag.keyword = keyword;
            return View();
        }
        #endregion

        #region 修改医院//模态框弹出
        public ActionResult EditHospital(long id)
        {
            T_Hospital hos = db.T_Hospital.Where(o => o.id == id && !o.isDelete).FirstOrDefault();
            List<string> grade = db.T_Hospital.Where(o => !o.isDelete && !string.IsNullOrEmpty(o.grade)).Select(o => o.grade).Distinct().ToList();
            List<T_Department> Department = db.T_Department.Where(o => !o.isDelete && o.grade != 0).ToList();
            ViewBag.Grade = grade;
            ViewBag.Department = Department;
            ViewBag.hos = hos;
            return View();
        }

        [HttpPost]
        public ActionResult EditHospital(T_Hospital hos, string[] Special)
        {
            hos.special = Special == null ? "" : string.Join("、", Special);
            T_Hospital ho = db.T_Hospital.Where(o => o.id == hos.id && !o.isDelete).FirstOrDefault();
            ho.name = hos.name;
            ho.profiles = hos.profiles;
            ho.tel = hos.tel;
            ho.adress = hos.adress;
            ho.grade = hos.grade;
            ho.special = hos.special;
            db.SaveChanges();
            return Content("ok:新增成功");
        }
        #endregion

        #region 删除医院
        public ActionResult DelHospital(long id, int page)
        {
            Session["alert"] = "删除成功!";
            T_Hospital dehos = db.T_Hospital.Where(o => o.id == id).FirstOrDefault();
            dehos.isDelete = true;
            db.SaveChanges();
            return RedirectToAction("HospitalLst", "main", new { page = page });
        }
        #endregion

        #region 科室管理//模态框弹出
        public ActionResult ChooseDep(long id)
        {
            List<T_Department> dep = db.T_Department.Where(o => !o.isDelete).ToList();
            List<T_HospitalDepartment> hodep = db.T_HospitalDepartment.Where(o => !o.isDelete && o.hospitalID == id).ToList();
            ViewBag.id = id;
            ViewBag.dep = dep;
            ViewBag.hodep = hodep;
            return View();
        }

        [HttpPost]
        public ActionResult ChooseDep(long id, long[] DepartmentID)
        {
            if (DepartmentID == null)
            {
                return Content("no:请选择科室再提交！");
            }
            List<T_HospitalDepartment> HosDepList = db.T_HospitalDepartment.Where(o => o.hospitalID == id).ToList();
            List<T_Department> dep = new List<T_Department>();
            foreach (var depid in DepartmentID)
            {
                dep.Add(db.T_Department.Where(o => !o.isDelete && o.id == depid).FirstOrDefault());//找出所有勾选
            }
            foreach (var deplist in dep.Where(o => o.grade == 2))//找出二级科室
            {
                int i = 0;
                foreach (var deplist1 in dep.Where(o => o.grade == 1))
                {
                    if (deplist.toDepartmentID == deplist1.id)//判断二级科室是否选中一级
                    {
                        i++;
                    }
                }
                if (i <= 0)
                {
                    return Content("no:您已选择二级科室，请必须选择同科室一级科室！");
                }
            }
            foreach (var deplist in dep.Where(o => o.grade == 1))//找出一级科室
            {
                int j = 0;
                foreach (var deplist1 in dep.Where(o => o.grade == 2))
                {
                    if (deplist1.toDepartmentID == deplist.id)//判断一级是否包含二级
                    {
                        j++;
                    }
                }
                if (j <= 0)
                {
                    return Content("no:您已选择一级科室，请必须选择至少一个同科室二级科室！");
                }
            }
            if (DepartmentID != null)
            {
                foreach (var Deid in DepartmentID)
                {
                    if (HosDepList.Where(o => o.departmentID == Deid).Count() == 0)
                    {
                        db.T_HospitalDepartment.Add(new T_HospitalDepartment(id, Deid));
                    }
                }
                HosDepList = HosDepList.Where(o => !DepartmentID.Contains(o.departmentID)).ToList();
            }
            foreach (var Hos in HosDepList)
            {
                db.T_HospitalDepartment.Remove(Hos);
            }
            db.SaveChanges();
            return Content("ok:保存成功");
        }
        #endregion

        #region 根据医院查找医生列表
        public ActionResult HosDoctorLst(string keyword = "", int page = 1, long hosID = 0)
        {
            List<T_Doctor> doc = new List<T_Doctor>();
            doc = db.T_Doctor.Include("Department").Include("Hospital").Where(o => o.hospitalID == hosID && !o.isDelete && (o.name.Contains(keyword) || o.tel.Contains(keyword))).OrderByDescending(o => o.createTime).Skip((page - 1) * pagesize).Take(pagesize).ToList();
            ViewBag.count = db.T_Doctor.Where(o => o.hospitalID == hosID && !o.isDelete && (o.name.Contains(keyword) || o.tel.Contains(keyword))).Count();
            ViewBag.Doc = doc;
            ViewBag.hosID = hosID;
            ViewBag.ThisPage = page;
            ViewBag.Pagesize = pagesize;
            ViewBag.keyword = keyword;
            return View();
        }
        #endregion

        #region 新增医院//模态框弹出
        public ActionResult AddHospital()
        {
            List<string> grade = db.T_Hospital.Where(o => !o.isDelete && !string.IsNullOrEmpty(o.grade)).Select(o => o.grade).Distinct().ToList();
            List<T_Department> Department = db.T_Department.Where(o => !o.isDelete && o.grade != 0).ToList();
            ViewBag.Grade = grade;
            ViewBag.Department = Department;
            return View();
        }

        [HttpPost]
        public ActionResult AddHospital(T_Hospital hos, string[] Special)
        {
            hos.special = Special == null ? "" : string.Join("、", Special);
            db.T_Hospital.Add(hos);
            db.SaveChanges();
            List<T_Department> dep = db.T_Department.Where(o => !o.isDelete).ToList();
            long[] DepartmentID = new long[dep.Count()];
            int count = 0;
            foreach (var depid in dep)
            {
                DepartmentID[count] = depid.id;
                count++;
            }
            ChooseDep1(hos.id, DepartmentID);
            return Content("ok:新增成功");
        }
        public void ChooseDep1(long ID, long[] DepartmentID)
        {
            List<T_HospitalDepartment> HosDepList = db.T_HospitalDepartment.Where(o => o.hospitalID == ID).ToList();
            List<T_Department> dep = new List<T_Department>();
            foreach (var depid in DepartmentID)
            {
                dep.Add(db.T_Department.Where(o => !o.isDelete && o.id == depid).FirstOrDefault());//找出所有勾选
            }
            foreach (var deplist in dep.Where(o => o.grade == 2))//找出二级科室
            {
                int i = 0;
                foreach (var deplist1 in dep.Where(o => o.grade == 1))
                {
                    if (deplist.toDepartmentID == deplist1.id)//判断二级科室是否选中一级
                    {
                        i++;
                    }
                }
            }
            foreach (var deplist in dep.Where(o => o.grade == 1))//找出一级科室
            {
                int j = 0;
                foreach (var deplist1 in dep.Where(o => o.grade == 2))
                {
                    if (deplist1.toDepartmentID == deplist.id)//判断一级是否包含二级
                    {
                        j++;
                    }
                }
            }
            if (DepartmentID != null)
            {
                foreach (var Deid in DepartmentID)
                {
                    if (HosDepList.Where(o => o.departmentID == Deid).Count() == 0)
                    {
                        db.T_HospitalDepartment.Add(new T_HospitalDepartment(ID, Deid));
                    }
                }
                HosDepList = HosDepList.Where(o => !DepartmentID.Contains(o.departmentID)).ToList();
            }
            foreach (var Hos in HosDepList)
            {
                db.T_HospitalDepartment.Remove(Hos);
            }
            db.SaveChanges();
        }
        #endregion


        #region 日程管理
        public ActionResult listevents(string startDate = "", string endDate = "", string room = "", int doctoeID=0)
        {
            DateTime start_date =  string.IsNullOrEmpty(startDate) ? DateTime.Parse("2000-01-01") : DateTime.Parse(startDate);
            DateTime end_date = string.IsNullOrEmpty(endDate)?DateTime.Parse("2030-01-01"):DateTime.Parse(endDate);

            var alistdb = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && (doctoeID == 0 ? true : o.doctorID == doctoeID) && o.appointmentTime >= start_date & o.appointmentTime <= end_date && (room == "" ? true : o.address == room)).ToList().Select(o => new
            {
                o.createTime,
                title = o.doctor.name + "-" + o.name,// 日程标题
                doctorName = o.doctor.name,
                appointPerson = o.name,
                room = o.address,
                start= o.appointmentTime.ToString("yyyy-MM-dd HH:mm:ss"),// 日程开始时间
                end = o.appointmentTime.AddHours(1).ToString("yyyy-MM-dd HH:mm:ss"),// 日程结束时间
                id=o.gId, // 日程id
                color = "red" // 背景色
            }).Concat(
            db.T_DoctorSchedule.Include("doctor").Where(o => !o.isDelete && (doctoeID == 0 ? true : o.doctorID == doctoeID) && o.startTime >= start_date && o.startTime <= end_date && o.numSign == 0 && (room == "" ? true : o.address == room)).OrderBy(o => o.startTime).ToList().Select(o => new
            {
                o.createTime,
                title = o.doctor.name + "-价格：" + o.Price,// 日程标题
                doctorName = o.doctor.name,
                appointPerson = "" ,
                room = o.address,
                start = o.startTime.ToString("yyyy-MM-dd HH:mm:ss"),
                end = o.endTime.ToString("yyyy-MM-dd HH:mm:ss"),
                id = o.gId, // 日程id
                color = "green" // 背景色
            })
            ).ToList();            

            return Json(new { code = 200, data = alistdb, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
        }

        #endregion

        #region 日程管理
        public ActionResult getInfo(string userID)
        {
            
            return Json(new { code = 200, data = "NULL", msg = "获取成功" }, JsonRequestBehavior.AllowGet);
        }

        #endregion
    }
}
