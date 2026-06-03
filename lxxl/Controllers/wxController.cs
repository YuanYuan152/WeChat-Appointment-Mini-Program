using lxxl.Models;
using lxxl.Service;
using lxxl.WxService;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Senparc.Weixin.MP.CommonAPIs;
using Senparc.Weixin.MP.Entities.Menu;
using System;
using System.Collections.Generic;
using System.Data;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Web;
using System.Web.Mvc;
using System.Web.Script.Serialization;
using System.Xml;

namespace lxxl.Controllers
{

    public class wxController : Controller
    {
        JavaScriptSerializer serializer = new JavaScriptSerializer();
        TMLSContext db = new TMLSContext();
        //
        // GET: /wx/Index

        public ActionResult Index()
        {
            Log.Debug("Data", "res000:");
            string token = "jxlToken123";
            string signature = HttpContext.Request.QueryString["signature"];
            string timestamp = HttpContext.Request.QueryString["timestamp"];
            string nonce = HttpContext.Request.QueryString["nonce"];
            string echostr = HttpContext.Request.QueryString["echostr"];

            Log.Debug("Data", HttpContext.Request.ToString());

            if (HttpContext.Request.HttpMethod.ToUpper() == "GET")
            {
                //get method - 仅在微信后台填写URL验证时触发
                if (CheckSignature(signature, timestamp, nonce, token))
                {
                    WriteContent(echostr); //返回随机字符串则表示验证通过
                }
                else
                {
                    WriteContent("failed:" + signature + "," + GetSignature(timestamp, nonce, token) + "。" +
                                "如果你在浏览器中看到这句话，说明此地址可以被作为微信公众账号后台的Url，请注意保持Token一致。");
                }
                HttpContext.Response.End();
            }
            else
            {
                string postString = "";
                using (Stream stream = HttpContext.Request.InputStream)
                {
                    Byte[] postBytes = new Byte[stream.Length];
                    stream.Read(postBytes, 0, (Int32)stream.Length);
                    postString = Encoding.UTF8.GetString(postBytes);
                }

                if (!string.IsNullOrEmpty(postString))
                {
                    Log.Debug("Data", postString);
                    //Execute(postString, accountInfo);
                }
                try
                {
                    //using (System.IO.Stream stream = HttpContext.Request.InputStream)
                    //{
                    //    Byte[] postBytes = new Byte[stream.Length];
                    //    stream.Read(postBytes, 0, (Int32)stream.Length);
                    //    string res = System.Text.Encoding.UTF8.GetString(postBytes);
                    //    Log.Debug(this.GetType().ToString(), res);
                        XmlDocument xmlDoc = new XmlDocument();
                        xmlDoc.LoadXml(postString);
                        XmlNode rootNode = xmlDoc.SelectSingleNode("xml");

                        XmlNode node = xmlDoc.SelectSingleNode("xml/MsgType");
                        string openid = xmlDoc.SelectSingleNode("xml/FromUserName").InnerText;
                        if (node.InnerText == "text")
                        {
                            XmlNode Contentnode = xmlDoc.SelectSingleNode("xml/Content");
                            if (Contentnode.InnerText.ToLower() == "openid")
                            {
                                return Content("<xml><ToUserName><![CDATA[" + xmlDoc.SelectSingleNode("xml/FromUserName").InnerText + "]]></ToUserName><FromUserName><![CDATA[gh_d0e78616f4ea]]></FromUserName><CreateTime>" + xmlDoc.SelectSingleNode("xml/CreateTime").InnerText + "</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[你的openid:" + xmlDoc.SelectSingleNode("xml/FromUserName").InnerText + "]]></Content></xml>");
                            }
                            else if (Contentnode.InnerText.ToLower() == "预约")
                            {
                                return Content(CreateNewsXml(openid));
                            }

                        }
                        else if (node.InnerText == "event")
                        {
                            XmlNode Contentnode = xmlDoc.SelectSingleNode("xml/Event");
                            if (Contentnode.InnerText == "subscribe")
                            {
                                return Content(CreateNewsXml(openid));
                            }

                        }
                    //}
                    return Content("");
                }
                catch (Exception ex) { Log.Debug(this.GetType().ToString(), ex.ToString()); }
            }
            return Content("");
        }

        //创建图文消息
        public string CreateNewsXml(string openid = "oaa91txQdsdF19QcVjicJxpRUJ10")
        {
            string rexml = "<xml><ToUserName>" + openid + "</ToUserName><FromUserName>gh_d0e78616f4ea</FromUserName>";
            rexml += "<CreateTime>" + DateTime.Now.Ticks + "</CreateTime>";
            rexml += "<MsgType>news</MsgType>";
            rexml += "<ArticleCount>1</ArticleCount>"; //图文消息个数，限制为10条以内
            rexml += "<Articles><item><Title>咨询预约</Title> ";
            rexml += "<Description>济心理学苑咨询预约</Description>";
            rexml += "<PicUrl>" + Config.domain + "/Content/images/jxl-erweima.jpg" + "</PicUrl><Url>" + Config.domain + "/we/ConsultantLst" + "</Url></item>";

            rexml += "</Articles></xml> ";

            Log.Debug(this.GetType().ToString(), rexml);
            return rexml;
        }


        //
        // GET: /wx/sendMsg

        public ActionResult sendMsg()
        {
            CreateNewsXmlxx();
            return Content("");
        }

        //创建图文消息
        public string CreateNewsXmlxx(string openid = "oaa91txQdsdF19QcVjicJxpRUJ10")
        {
            string rexml = "<xml><ToUserName>" + openid + "</ToUserName><FromUserName>gh_d0e78616f4ea</FromUserName>";
            rexml += "<CreateTime>" + DateTime.Now.Ticks + "</CreateTime>";
            rexml += "<MsgType>news</MsgType>";
            rexml += "<ArticleCount>1</ArticleCount>"; //图文消息个数，限制为10条以内
            rexml += "<Articles><item><Title>咨询信息</Title> ";
            rexml += "<Description>您有1条咨询预约时间确定,咨询时长：1小时, 点击查看详情，请尽快处理!</Description>";
            rexml += "<PicUrl>" + Config.domain + "/Content/images/jxl-erweima.jpg" + "</PicUrl><Url>" + Config.domain + "/we/ConsultantLst" + "</Url></item>";

            rexml += "</Articles></xml> ";

            Log.Debug(this.GetType().ToString(), rexml);
            return rexml;
        }

        //
        // GET: /wx/Index2
        public ActionResult Index2()
        {
            string accessToken = Config.txl_token;
            List<string> ABC = GetOpenIDs(accessToken);
            return Content("");
        }

        /// <summary>
        /// 获取关注者OpenID集合
        /// </summary>
        public static List<string> GetOpenIDs(string access_token)
        {
            List<string> result = new List<string>();

            List<string> openidList = GetOpenID(access_token, null);
            result.AddRange(openidList);

            while (openidList.Count > 0)
            {
                openidList = GetOpenID(access_token, openidList[openidList.Count - 1]);
                result.AddRange(openidList);
            }

            return result;
        }

        /// <summary>
        /// 获取关注者OpenID集合
        /// </summary>
        public static List<string> GetOpenID(string access_token, string next_openid)
        {
            // 设置参数
            string url = string.Format("https://api.weixin.qq.com/cgi-bin/user/get?access_token={0}&next_openid={1}", access_token, string.IsNullOrWhiteSpace(next_openid) ? "" : next_openid);
            WebHelper webHelper = new Service.WebHelper();
            string returnStr = webHelper.Request_WebRequest(url, 0, null);
            JObject jo = JObject.Parse(returnStr);
            int count = 2;// int.Parse(JObject.GetJsonValue(returnStr, "count"));
            if (count > 0)
            {
                string startFlg = "\"openid\":[";
                int start = returnStr.IndexOf(startFlg) + startFlg.Length;
                int end = returnStr.IndexOf("]", start);
                string openids = returnStr.Substring(start, end - start).Replace("\"", "");
                return openids.Split(',').ToList<string>();
            }
            else
            {
                return new List<string>();
            }
        }

        private void WriteContent(string str)
        {
            HttpContext.Response.Output.Write(str);
        }

        /// <summary>
        /// 检查签名是否正确
        /// </summary>
        /// <param name="signature"></param>
        /// <param name="timestamp"></param>
        /// <param name="nonce"></param>
        /// <param name="token"></param>
        /// <returns></returns>
        public static bool CheckSignature(string signature, string timestamp, string nonce, string token)
        {
            return signature == GetSignature(timestamp, nonce, token);
        }

        /// <summary>
        /// 返回正确的签名
        /// </summary>
        /// <param name="timestamp"></param>
        /// <param name="nonce"></param>
        /// <param name="token"></param>
        /// <returns></returns>
        public static string GetSignature(string timestamp, string nonce, string token)
        {
            string[] arr = new[] { token, timestamp, nonce }.OrderBy(z => z).ToArray();
            string arrString = string.Join("", arr);
            System.Security.Cryptography.SHA1 sha1 = System.Security.Cryptography.SHA1.Create();
            byte[] sha1Arr = sha1.ComputeHash(Encoding.UTF8.GetBytes(arrString));
            StringBuilder enText = new StringBuilder();
            foreach (var b in sha1Arr)
            {
                enText.AppendFormat("{0:x2}", b);
            }
            return enText.ToString();
        }

        #region 统一微信支付回调
        public ActionResult PayNotify()
        {
            WxPayData notifyData = GetNotifyData();
            //检查支付结果中transaction_id是否存在
            if (!notifyData.IsSet("transaction_id"))
            {
                //若transaction_id不存在，则立即返回结果给微信支付后台
                WxPayData rest = new WxPayData();
                rest.SetValue("return_code", "FAIL");
                rest.SetValue("return_msg", "支付结果中微信订单号不存在");
                Response.Write(rest.ToXml());
                Response.End();
            }
            long id = 0;
            if (notifyData.IsSet("trade_type"))
            {
                string trade_type = notifyData.GetValue("trade_type").ToString();
                //if (trade_type == "NATIVE")
                if (trade_type == "JSAPI")
                {
                    string orderid = notifyData.GetValue("out_trade_no").ToString();//支付订单号
                    double paymoney = (float)Convert.ToInt64(notifyData.GetValue("total_fee").ToString()) / 100;//付款金额，用于对比订单金额，不相等，支付方式为微信+余额
                    string openid = notifyData.GetValue("openid").ToString();//支付者openid，与原订单openid不一致，为代付
                    
                    string time_end = notifyData.GetValue("time_end").ToString();                       
                    string payInfo = notifyData.ToXml();
                    
                    paySuccess(orderid, paymoney, openid, time_end, payInfo);

                    WxPayData res = new WxPayData();
                    res.SetValue("return_code", "SUCCESS");
                    res.SetValue("return_msg", "OK");
                    Response.Write(res.ToXml());
                    Response.End();

                    return Content("回调成功");
                }
                else if (trade_type == "NATIVE")
                {
                    string orderid = notifyData.GetValue("out_trade_no").ToString();//支付订单号
                    double paymoney = (float)Convert.ToInt64(notifyData.GetValue("total_fee").ToString()) / 100;//付款金额，用于对比订单金额，不相等，支付方式为微信+余额
                    string openid = notifyData.GetValue("openid").ToString();//支付者openid，与原订单openid不一致，为代付
                    T_PayLog unpay = db.T_PayLog.Where(o => o.orderGId == orderid && !o.isDelete).FirstOrDefault();
                    if (unpay != null)
                    {
                        if (unpay.State == 0)
                        {
                            DateTime time = DateTime.Now;
                            string time_end = notifyData.GetValue("time_end").ToString();
                            unpay.Account = openid;
                            unpay.payTime = DateTime.Parse(time_end.Substring(0, 4) + "-" + time_end.Substring(4, 2) + "-" + time_end.Substring(6, 2) + " " + time_end.Substring(8, 2) + ":" + time_end.Substring(10, 2) + ":" + time_end.Substring(12, 2));
                            unpay.State = 1;
                            db.SaveChanges();
                            T_Order order = db.T_Order.Where(o => o.ordergId == orderid && o.Type == 1 && !o.isDelete).FirstOrDefault();
                            if (order == null) { order = db.T_Order.Where(o => o.gId == orderid && o.Type == 2 && !o.isDelete).FirstOrDefault(); }
                            order.State = 1;
                            order.payInfo = notifyData.ToXml();
                            db.SaveChanges();

                            #region 通知
                            #endregion
                        }


                        WxPayData res = new WxPayData();
                        res.SetValue("return_code", "SUCCESS");
                        res.SetValue("return_msg", "OK");
                        Response.Write(res.ToXml());
                        Response.End();

                        return Content("回调成功");
                        //}
                        //#endregion
                    }
                    else
                    {
                        return Content("回调失败");
                    }
                }
                else
                {
                    return Content("回调失败");
                }
            }
            else
            {
                return Content("回调失败");
            }
        }


        public ActionResult PayNotifyTest()
        {
            string builder ="<xml><appid><![CDATA[wx7c7c6f068de77af8]]></appid><attach><![CDATA[携带参数]]></attach><bank_type><![CDATA[OTHERS]]></bank_type><cash_fee><![CDATA[100]]></cash_fee><fee_type><![CDATA[CNY]]></fee_type><is_subscribe><![CDATA[Y]]></is_subscribe><mch_id><![CDATA[1603667556]]></mch_id><nonce_str><![CDATA[ElrwGCnnAfNVhGh]]></nonce_str><openid><![CDATA[o5kJk63n9Um9_gRpc3LhDV3571XM]]></openid><out_trade_no><![CDATA[a6312ac9f4224d7caf8fe11e9a0ed2b6]]></out_trade_no><result_code><![CDATA[SUCCESS]]></result_code><return_code><![CDATA[SUCCESS]]></return_code><sign><![CDATA[3FBB6F382565E1617E8378DB302B9EB3]]></sign><time_end><![CDATA[20230910091029]]></time_end><total_fee>100</total_fee><trade_type><![CDATA[JSAPI]]></trade_type><transaction_id><![CDATA[4200001961202309101128418545]]></transaction_id></xml>";

            //T_Consultation ction = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.gId == "a6312ac9f4224d7caf8fe11e9a0ed2b6").FirstOrDefault();
            WxPayData notifyData = new WxPayData();
            notifyData.FromXml(builder);
            //检查支付结果中transaction_id是否存在
            if (!notifyData.IsSet("transaction_id"))
            {
                //若transaction_id不存在，则立即返回结果给微信支付后台
                WxPayData rest = new WxPayData();
                rest.SetValue("return_code", "FAIL");
                rest.SetValue("return_msg", "支付结果中微信订单号不存在");
                Response.Write(rest.ToXml());
                Response.End();
            }
            long id = 0;
            if (notifyData.IsSet("trade_type"))
            {
                string trade_type = notifyData.GetValue("trade_type").ToString();
                //if (trade_type == "NATIVE")
                if (trade_type == "JSAPI")
                {
                    string orderid = notifyData.GetValue("out_trade_no").ToString();//支付订单号
                    double paymoney = (float)Convert.ToInt64(notifyData.GetValue("total_fee").ToString()) / 100;//付款金额，用于对比订单金额，不相等，支付方式为微信+余额
                    string openid = notifyData.GetValue("openid").ToString();//支付者openid，与原订单openid不一致，为代付
                    T_PayLog unpay = db.T_PayLog.Where(o => o.orderGId == orderid && !o.isDelete).FirstOrDefault();
                    T_Consultation ction = db.T_Consultation.Where(o => o.gId == orderid && !o.isDelete).FirstOrDefault();
                    if (unpay != null)
                    {
                        if (unpay.State == 0)
                        {
                            short ordertype = unpay.payType;
                            DateTime time = DateTime.Now;
                            string time_end = notifyData.GetValue("time_end").ToString();
                            unpay.Account = openid;
                            unpay.payTime = DateTime.Parse(time_end.Substring(0, 4) + "-" + time_end.Substring(4, 2) + "-" + time_end.Substring(6, 2) + " " + time_end.Substring(8, 2) + ":" + time_end.Substring(10, 2) + ":" + time_end.Substring(12, 2));
                            unpay.State = 1;
                            T_Order order = db.T_Order.Where(o => o.ordergId == orderid && !o.isDelete).FirstOrDefault();
                            order.State = 1;
                            order.payInfo = notifyData.ToXml();
                            //List<T_Consultation> alistdb = db.T_Consultation.Include("doctor").Include("admin").Where(o => !o.isDelete && o.gId == orderid).ToList();
                            //T_Consultation Consulation = alistdb[0];
                            ction.State = 1;
                            db.SaveChanges();

                            #region 通知
                            T_Doctor doctor = db.T_Doctor.SingleOrDefault(o => !o.isDelete && o.ID == ction.doctorID);
                            if (doctor != null && !string.IsNullOrEmpty(doctor.openid))
                            {
                                //lxxl.WxService.WeiXinHelper.SendCustomMsg2(doctor.openid, "/doctor/Consulation?ordergid=" + Consulation.gId);
                                lxxl.Service.WeiXinHelper.SendMsg1(doctor.openid, ction.name, doctor.name, ction.appointmentTime.ToString("yyyy-MM-dd HH:mm:ss"), "您有一条预约订单，请查阅！", "/doctor/Consulation?ordergid=" + ction.gId);
                            }
                            List<T_Admin> admindb = db.T_Admin.Where(o => !o.IsDelete && o.Type == 3).ToList();
                            foreach (T_Admin item in admindb)
                            {
                                if (!string.IsNullOrEmpty(item.Backup))
                                {
                                    lxxl.Service.WeiXinHelper.SendMsg1(item.Backup, ction.name, doctor.name, ction.appointmentTime.ToString("yyyy-MM-dd HH:mm:ss"), "您有一条预约订单，请查阅！", "/doctor/Consulation?ordergid=" + ction.gId);
                                }
                            }

                            #endregion
                        }


                        WxPayData res = new WxPayData();
                        res.SetValue("return_code", "SUCCESS");
                        res.SetValue("return_msg", "OK");
                        Response.Write(res.ToXml());
                        Response.End();

                        return Content("回调成功");
                        //}
                        //#endregion
                    }
                    else
                    {
                        return Content("回调失败");
                    }
                }
                else if (trade_type == "NATIVE")
                {
                    string orderid = notifyData.GetValue("out_trade_no").ToString();//支付订单号
                    double paymoney = (float)Convert.ToInt64(notifyData.GetValue("total_fee").ToString()) / 100;//付款金额，用于对比订单金额，不相等，支付方式为微信+余额
                    string openid = notifyData.GetValue("openid").ToString();//支付者openid，与原订单openid不一致，为代付
                    T_PayLog unpay = db.T_PayLog.Where(o => o.orderGId == orderid && !o.isDelete).FirstOrDefault();
                    if (unpay != null)
                    {
                        if (unpay.State == 0)
                        {
                            DateTime time = DateTime.Now;
                            string time_end = notifyData.GetValue("time_end").ToString();
                            unpay.Account = openid;
                            unpay.payTime = DateTime.Parse(time_end.Substring(0, 4) + "-" + time_end.Substring(4, 2) + "-" + time_end.Substring(6, 2) + " " + time_end.Substring(8, 2) + ":" + time_end.Substring(10, 2) + ":" + time_end.Substring(12, 2));
                            unpay.State = 1;
                            T_Order order = db.T_Order.Where(o => o.ordergId == orderid && !o.isDelete).FirstOrDefault();
                            order.State = 1;
                            order.payInfo = notifyData.ToXml();
                            db.SaveChanges();

                            #region 通知
                            #endregion
                        }


                        WxPayData res = new WxPayData();
                        res.SetValue("return_code", "SUCCESS");
                        res.SetValue("return_msg", "OK");
                        Response.Write(res.ToXml());
                        Response.End();

                        return Content("回调成功");
                        //}
                        //#endregion
                    }
                    else
                    {
                        return Content("回调失败");
                    }
                }
                else
                {
                    return Content("回调失败");
                }
            }
            else
            {
                return Content("回调失败");
            }
        }

        #endregion

        #region 支付回调后处理
        public bool paySuccess(string orderid, double paymoney, string openid, string time_end, string payInfo)
        {
            T_PayLog unpay = db.T_PayLog.Where(o => o.orderGId == orderid && !o.isDelete).FirstOrDefault();
            if (unpay != null)
            {
                if (unpay.State == 0)
                {
                    short ordertype = unpay.payType;
                    DateTime time = DateTime.Now;
                    unpay.Account = openid;
                    unpay.payTime = DateTime.Parse(time_end.Substring(0, 4) + "-" + time_end.Substring(4, 2) + "-" + time_end.Substring(6, 2) + " " + time_end.Substring(8, 2) + ":" + time_end.Substring(10, 2) + ":" + time_end.Substring(12, 2));
                    unpay.State = 1;
                    db.SaveChanges();
                    T_Order order = db.T_Order.Where(o => o.ordergId == orderid && o.Type == 1 && !o.isDelete).FirstOrDefault();
                    if (order == null) { order = db.T_Order.Where(o => o.gId == orderid && o.Type == 2 && !o.isDelete).FirstOrDefault(); }
                    order.State = 1;
                    order.payInfo = payInfo;
                    T_Consultation Consulation = db.T_Consultation.Include("User").SingleOrDefault(o => o.gId == order.ordergId && !o.isDelete);
                    Consulation.State = 1;
                    Consulation.PayTime = unpay.payTime;
                    Consulation.PayType = 1;
                    T_ConsultationRecord oneR = db.T_ConsultationRecord.FirstOrDefault(o => !o.IsDelete && o.UserID == Consulation.UserID && o.doctorID == Consulation.doctorID);
                    if (oneR == null)
                    {
                        oneR = new T_ConsultationRecord(Consulation.type, Consulation.name, "", "", Consulation.tel, "");
                        oneR.UserID = Consulation.UserID;
                        oneR.doctorID = Consulation.doctorID;
                        oneR.Frequency = 1;
                        oneR.ConsultationIDs = Consulation.ID.ToString();
                        db.T_ConsultationRecord.Add(oneR);
                        db.SaveChanges();
                    }
                    else
                    {
                        oneR.Frequency = oneR.Frequency + 1;
                        oneR.ConsultationIDs = oneR.ConsultationIDs + "," + Consulation.ID;
                    }
                    db.SaveChanges();

                    #region 通知
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

                    #endregion
                }

                return true;
            }
            else
            {
                return false;
            }               
            
        }
        #endregion

        #region 公共
        /// <summary>
        /// 接收从微信支付后台发送过来的数据并验证签名
        /// </summary>
        /// <returns>微信支付后台返回的数据</returns>
        public WxPayData GetNotifyData()
        {
            //接收从微信后台POST过来的数据
            System.IO.Stream s = Request.InputStream;
            int count = 0;
            byte[] buffer = new byte[1024];
            StringBuilder builder = new StringBuilder();
            while ((count = s.Read(buffer, 0, 1024)) > 0)
            {
                builder.Append(Encoding.UTF8.GetString(buffer, 0, count));
            }
            s.Flush();
            s.Close();
            s.Dispose();
            Log.Debug(this.GetType().ToString(), builder.ToString());
            //转换数据格式并验证签名
            WxPayData data = new WxPayData();

            try
            {
                data.FromXml(builder.ToString());
            }
            catch (Exception ex)
            {
                //若签名错误，则立即返回结果给微信支付后台
                WxPayData res = new WxPayData();
                res.SetValue("return_code", "FAIL");
                res.SetValue("return_msg", ex.Message);
                Response.Write(res.ToXml());
                Response.End();
            }
            return data;
        }
        #endregion

        #region 微信订单查询接口
        [HttpPost]
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
                            long idd = long.Parse(order.platFormGId);
                            T_Content Content = db.T_Content.Where(o => o.Type == 2 && o.ID == idd && !o.IsDelete).FirstOrDefault();
                            return Json(new { code = 0, Content = Content,msg = "支付成功" });

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
    }
}
