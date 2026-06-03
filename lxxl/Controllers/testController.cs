using lxxl.Service;
using lxxl.WxService;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using lxxl.Models;
using System.Net;
using System.Net.Sockets;

namespace lxxl.Controllers
{
    public class testController : Controller
    {
        TMLSContext db = new TMLSContext();
        //
        // GET: /test/
        public ActionResult Index0()
        {
            //lxxl.Service.WeiXinHelper.SendMsg1("o5kJk63n9Um9_gRpc3LhDV3571XM", "张三", "李四", "2023年5月25日 10:00", "测试一下说明", "/we/Index/");
            //lxxl.Service.WeiXinHelper.SendMsg2("o5kJk63n9Um9_gRpc3LhDV3571XM", "已通过", "张三", "李四", "2023年5月25日 10:00", "办公楼", "测试一下说明", "/we/Index/");
            T_Consultation Consulation = db.T_Consultation.Include("User").SingleOrDefault(o => o.gId == "b77939f1ee09446f9abf127c5c5d8b71" && !o.isDelete);
            T_Doctor doctor = db.T_Doctor.SingleOrDefault(o => !o.isDelete && o.ID == Consulation.doctorID);
            if (doctor != null && !string.IsNullOrEmpty(doctor.openid))
            {
                //lxxl.WxService.WeiXinHelper.SendCustomMsg2(doctor.openid, "/doctor/Consulation?ordergid=" + Consulation.gId);
                lxxl.Service.WeiXinHelper.SendMsg1(doctor.openid, Consulation.name, doctor.name, Consulation.appointmentTime.ToString("yyyy-MM-dd HH:mm:ss"), "您有一条预约订单，请查阅！", "/doctor/Consulation?ordergid=" + Consulation.gId);
            }
            List<T_Admin> admindb = db.T_Admin.Where(o => !o.IsDelete && o.Type == 3).ToList();
            foreach (T_Admin item in admindb)
            {
                if (!string.IsNullOrEmpty(item.Backup))
                {
                    lxxl.Service.WeiXinHelper.SendMsg1(item.Backup, Consulation.name, doctor.name, Consulation.appointmentTime.ToString("yyyy-MM-dd HH:mm:ss"), "您有一条预约订单，请查阅！", "/doctor/Consulation?ordergid=" + Consulation.gId);
                }
            }
           
            return View();
        }

        public ActionResult Index(string openid = "o5kJk63n9Um9_gRpc3LhDV3571XM")
        {
            //WxOrderQuery("160366755620230312165608578");
            //WeiXinHelper.SendCustomMsg2("o5kJk63n9Um9_gRpc3LhDV3571XM");o5kJk65Rw_kMGiUBUChwC1sbIAJI

            //lxxl.Service.WeiXinHelper.SendMsg1(openid, "张三", "李四", "2023年5月25日 10:00", "测试一下说明", "/wapform/wenjuan?gId=98c5cba8c74e44f3b15069a581c72b9a");
            //lxxl.Service.WeiXinHelper.SendMsg2(openid, "已通过", "张三", "李四", "2023年5月25日 10:00", "办公楼", "测试一下说明", "/wapform/wenjuan?gId=98c5cba8c74e44f3b15069a581c72b9a");

            
            //lxxl.WxService.WeiXinHelper.SendCustomMsg2("o5kJk63n9Um9_gRpc3LhDV3571XM", "/Patient/Order?ordergid=aef6603822fb490a8159fd446cf1cc4b",
                //"补缴费通知", "您有一条咨询补缴费订单，请查阅！");
            //List<T_SystemSettings> roomList = db.T_SystemSettings.Where(o => !o.isDelete && o.type == 12).ToList();
            //ViewBag.roomList = roomList;
            //List<T_Doctor> DoctorList = db.T_Doctor.Where(o => !o.isDelete).OrderBy(o=>o.number).ToList();
            //ViewBag.DoctorList = DoctorList;

            var alistdb = db.T_Consultation.Include("doctor").Include("admin").Include("User").Where(o => !o.isDelete).ToList();
            foreach (T_Consultation item in alistdb)  ////初始化来访者
            {
                if (item.State >= 1)
                {
                    T_ConsultationRecord oneR = db.T_ConsultationRecord.FirstOrDefault(o => !o.IsDelete && o.UserID == item.UserID && o.doctorID == item.doctorID);
                    if (oneR == null)
                    {
                        oneR = new T_ConsultationRecord(item.type, item.name, "", "", item.tel, "");
                        oneR.UserID = item.UserID;
                        oneR.doctorID = item.doctorID;
                        oneR.Frequency = 1;
                        oneR.ConsultationIDs = item.ID.ToString();
                        db.T_ConsultationRecord.Add(oneR);
                        db.SaveChanges();
                    }
                    else
                    {
                        oneR.Frequency = oneR.Frequency + 1;
                        oneR.ConsultationIDs = oneR.ConsultationIDs + "," + item.ID;
                        db.SaveChanges();
                    }
                }
            }

            return View();
        }

        public ActionResult PayLog()
        {
            DateTime dt = DateTime.Now.AddMinutes(-15);
            List<T_Order> OrderList = db.T_Order.Where(o => o.createTime < dt && !o.isDelete).OrderByDescending(o => o.createTime).ToList();

            foreach(T_Order item in OrderList)
            {
                item.State = -1;
                T_Consultation Consultation = db.T_Consultation.SingleOrDefault(o => o.gId == item.ordergId && !o.isDelete);
                if (Consultation != null && Consultation.State == 0)
                {
                    Consultation.State = -1;
                    T_DoctorSchedule DoctorSchedule = db.T_DoctorSchedule.SingleOrDefault(o => o.ID == Consultation.TDoctorID && !o.isDelete);
                    if (DoctorSchedule != null && DoctorSchedule.numSign > 0)
                    {
                        DoctorSchedule.numSign = DoctorSchedule.numSign - 1;
                    }
                }

                db.SaveChanges();
            }

            return Content("ok");
        }

        public ActionResult dateCalendar()
        {
            return View();
        }

        public ActionResult tb()
        {
            return View();
        }

        public ActionResult pay()
        {
            return View();
        }

        public ActionResult ip()
        {
            string ips = "";
            var host = Dns.GetHostEntry(Dns.GetHostName());
            foreach (var ip in host.AddressList)
            {
                if (ip.AddressFamily == AddressFamily.InterNetwork)
                {
                    ips = ip.ToString();
                }
            }
            return Content(ips);
        }

       

        /**
        *    
        * 查询订单
        * @param WxPayData inputObj 提交给查询订单API的参数
        * @param int timeOut 超时时间
        * @throws WxPayException
        * @return 成功时返回订单查询结果，其他抛异常
        */
        public static WxPayData transactions(string tradeno = "160366755620230312165608578")
        {
            string url = "https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/1217752501201407033233368018?mchid=" + Config.txl_MchId;

            string response = HttpService.Get( url);//调用HTTP通信接口提交数据
            
            //将xml格式的数据转化为对象以返回
            WxPayData result = new WxPayData();
            result.FromXml(response);


            return result;
        }

        #region 微信订单查询接口
        //[HttpPost]
        public JsonResult WxOrderQuery(string out_trade_no)
        {
            WxPayData unifiedOrderResult = JsApiPay.OrderQuery(out_trade_no);
            if (unifiedOrderResult.GetValue("return_code").ToString() == "SUCCESS")
            {
                if (unifiedOrderResult.GetValue("result_code").ToString() == "SUCCESS")
                {
                    if (unifiedOrderResult.GetValue("trade_state").ToString() == "SUCCESS")
                    {
                        LogWriter.Default.WriteWarning("微信条码查询接口支付成功：" + unifiedOrderResult.ToJson());

                        T_PayLog unpay = db.T_PayLog.Where(o => o.orderGId == out_trade_no && !o.isDelete).FirstOrDefault();
                        if (unpay != null)
                        {
                            DateTime time = DateTime.Now;
                            string time_end = unifiedOrderResult.GetValue("time_end").ToString();
                            unpay.Account = unifiedOrderResult.GetValue("openid").ToString();
                            unpay.payTime = DateTime.Parse(time_end.Substring(0, 4) + "-" + time_end.Substring(4, 2) + "-" + time_end.Substring(6, 2) + " " + time_end.Substring(8, 2) + ":" + time_end.Substring(10, 2) + ":" + time_end.Substring(12, 2));
                            unpay.State = 1;
                            T_Order order = db.T_Order.Where(o => o.ordergId == out_trade_no && !o.isDelete).FirstOrDefault();
                            order.State = 1;
                            order.payInfo = unifiedOrderResult.ToXml();
                            db.SaveChanges();

                            return Json(new { code = 0, msg = "支付成功" });

                        }
                        return Json(new { code = -1, msg = "业务处理失败" });
                            
                    }
                    else
                    {
                        LogWriter.Default.WriteWarning("微信条码支付交易状态失败：" + unifiedOrderResult.ToJson());
                        return Json(new { code = -1, msg = unifiedOrderResult.GetValue("err_code_des") });
                    }
                }
                else
                {
                    LogWriter.Default.WriteWarning("微信条码支付业务处理失败：" + unifiedOrderResult.ToJson());
                    return Json(new { code = -1, msg = unifiedOrderResult.GetValue("err_code_des") });
                }
            }
            else
            {
                LogWriter.Default.WriteWarning("微信条码支付失败：" + unifiedOrderResult.ToJson());
                return Json(new { code = -1, msg = unifiedOrderResult.GetValue("err_code_des") });
            }
        }


        /**
        * 
        * 查询订单情况
        * @param string out_trade_no  商户订单号
        * @param int succCode         查询订单结果：0表示订单不成功，1表示订单成功，2表示继续查询
        * @return 订单查询接口返回的数据，参见协议接口
        */
        public static WxPayData Query(string out_trade_no, out int succCode)
        {
            WxPayData result = JsApiPay.OrderQuery(out_trade_no);
            LogWriter.Default.WriteWarning("微信条码支付(订单查询接口)：" + result.ToJson());
            if (result.GetValue("return_code").ToString() == "SUCCESS"
                && result.GetValue("result_code").ToString() == "SUCCESS")
            {
                //支付成功
                if (result.GetValue("trade_state").ToString() == "SUCCESS")
                {
                    succCode = 1;
                    return result;
                }
                //用户支付中，需要继续查询
                else if (result.GetValue("trade_state").ToString() == "USERPAYING")
                {
                    succCode = 2;
                    return result;
                }
            }

            //如果返回错误码为“此交易订单号不存在”则直接认定失败
            if (result.GetValue("err_code").ToString() == "ORDERNOTEXIST")
            {
                succCode = 0;
            }
            else
            {
                //如果是系统错误，则后续继续
                succCode = 2;
            }
            return result;
        }
        #endregion


        public ActionResult appointmentTest(long doctorScheduleID = 72, string xyID = "o5kJk63n9Um9_gRpc3LhDV3571XM")
        {
            Session["patient"] = db.T_User.FirstOrDefault(o => o.ID == 2);
            T_DoctorSchedule doctorSchedule = db.T_DoctorSchedule.SingleOrDefault(o => !o.isDelete && o.ID == doctorScheduleID);
            if (doctorSchedule == null)
            {
                return Json(new { code = -1, msg = "预约失败，请重新选择预约！" }, JsonRequestBehavior.AllowGet);

            }
            else
            {
                if ( doctorSchedule.numSign >0)
                {
                    return Json(new { code = -1, msg = "该时间预约已满，请选择另外的时间预约！" }, JsonRequestBehavior.AllowGet);
                }

                doctorSchedule.numSign = doctorSchedule.numSign + 1;
                db.SaveChanges();

                T_User patient = Session["patient"] as T_User;
                T_Consultation Consulation = new T_Consultation(patient.ID, doctorSchedule.doctorID, doctorSchedule.Price, doctorSchedule.startTime);
                Consulation.TDoctorID = doctorScheduleID;
                Consulation.expectedTime = doctorSchedule.startTime.ToString("HH:mm") + "-" + doctorSchedule.endTime.ToString("HH:mm");
                TimeSpan hoursSpan = new TimeSpan(doctorSchedule.endTime.Ticks - doctorSchedule.startTime.Ticks);
                Consulation.duration = hoursSpan.TotalHours;
                Consulation.openid = xyID;
                Consulation.name = patient.Name;
                Consulation.tel = patient.Tel;
                Consulation.email = patient.Mail;
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

    }
}
