using lxxl.Models;
using lxxl.Service;
using lxxl.WxService;
using Newtonsoft.Json.Linq;
using Senparc.Weixin.MP;
using Senparc.Weixin.MP.AdvancedAPIs;
using Senparc.Weixin.MP.AdvancedAPIs.OAuth;
using Senparc.Weixin.TenPay.V3;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Web;
using System.Web.Mvc;
using System.Web.Script.Serialization;
using System.Xml.Linq;

namespace lxxl.Controllers
{
    public class TenPayV3Controller : Controller
    {
        string AppId = Config.txl_AppId;
        TMLSContext db = new TMLSContext();
        WebHelper webHelper = new WebHelper();
        JavaScriptSerializer serializer = new JavaScriptSerializer();

        public ActionResult Index()
        {
            return View();
        }

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

            //转换数据格式并验证签名
            WxPayData data = new WxPayData();
            //Write(builder);
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

        #region 扫码付费
        //生成二维码, id是订单id
        public ActionResult Native(string id="")
        {
            if (string.IsNullOrEmpty(id)) { id = DateTime.Now.ToString("yyyMMddHHmmssfff"); }
            ViewData["sp_billno"] = id;
            return View();
        }
        public ActionResult GetQRImg1(string id)
        {
            WxService.NativePay nativePay = new WxService.NativePay();

            //生成扫码支付模式一url
            string url1 = nativePay.GetPrePayUrl(id);

            System.Drawing.Bitmap bt;
            ThoughtWorks.QRCode.Codec.QRCodeEncoder qrEncoder = new ThoughtWorks.QRCode.Codec.QRCodeEncoder();
            qrEncoder.QRCodeVersion = 0;
            bt = qrEncoder.Encode(url1);
            MemoryStream ms = new MemoryStream();
            bt.Save(ms, System.Drawing.Imaging.ImageFormat.Jpeg);

            return File(ms.ToArray(), "image/jpeg");
        }

        //public ActionResult NativeCall()
        //{
        //    ResponseHandler NativeCallBackRepHandler = new ResponseHandler(null);

        //    string re_appid = NativeCallBackRepHandler.GetParameter("appid");
        //    string re_openid = NativeCallBackRepHandler.GetParameter("openid");
        //    string re_mchid = NativeCallBackRepHandler.GetParameter("mch_id");
        //    string re_is_subscribe = NativeCallBackRepHandler.GetParameter("is_subscribe");
        //    string re_nonce_str = NativeCallBackRepHandler.GetParameter("nonce_str");
        //    string re_product_id = NativeCallBackRepHandler.GetParameter("product_id");
        //    string re_sign = NativeCallBackRepHandler.GetParameter("sign");

        //    T_QrRecord qr = db.T_QrRecord.Where(o => o.Number == re_product_id).FirstOrDefault();
        //    if (qr == null)
        //        return Content("订单不存在，支付失败");
        //    string sp_billno = Request["order_no"];
        //    if (null == sp_billno)
        //    {
        //        //生成订单10位序列号，此处用时间和随机数生成，商户根据自己调整，保证唯一
        //        sp_billno = DateTime.Now.ToString("yyyMMddHHmmssfff");
        //    }
        //    else
        //    {
        //        sp_billno = Request["order_no"].ToString();
        //    }
        //    qr.Remark = re_openid;
        //    string nonceStr = TenPayV3Util.GetNoncestr();
        //    string body = re_product_id;//商品或支付单简要描述
        //    string out_trade_no = qr.Number;//商户系统内部的订单号，32个字符内，可包含字母，其他说明见商户订单号
        //    string total_fee = (qr.Money * 100).ToString();//Convert.ToInt32(trade.TRADE_PAYMENT.Value*100);//订单总金额，只能是整数。
        //    string spbill_create_ip = Request.UserHostAddress;//APP和网页支付提交用户端IP，Native支付填调用微信支付API的机器IP
        //    string notify_url = Config.domain + "/TenPayV3/PayNativeUrl";//接收微信支付异步通知回调地址
        //    string trade_type = "NATIVE";//JSAPI,NATIVE,APP,WAP
        //    //创建支付应答对象
        //    RequestHandler packageReqHandler = new RequestHandler(null);
        //    //初始化
        //    packageReqHandler.Init();
        //    //设置package订单参数
        //    packageReqHandler.SetParameter("appid", Config.txl_AppId);
        //    packageReqHandler.SetParameter("mch_id", Config.yly_MchId);
        //    packageReqHandler.SetParameter("nonce_str", nonceStr);
        //    packageReqHandler.SetParameter("body", body);
        //    packageReqHandler.SetParameter("out_trade_no", out_trade_no);
        //    packageReqHandler.SetParameter("total_fee", total_fee);
        //    packageReqHandler.SetParameter("spbill_create_ip", spbill_create_ip);
        //    packageReqHandler.SetParameter("notify_url", notify_url);
        //    packageReqHandler.SetParameter("trade_type", trade_type);
        //    packageReqHandler.SetParameter("product_id", re_product_id);
        //    //packageReqHandler.SetParameter("openid", re_openid);

        //    string sign = packageReqHandler.CreateMd5Sign("key", Config.yly_Key);
        //    packageReqHandler.SetParameter("sign", sign);

        //    string data = packageReqHandler.ParseXML();
        //    var UnifiedorderResult = TenPayV3.Unifiedorder(data);
        //    var res = System.Xml.Linq.XDocument.Parse(UnifiedorderResult);
        //    string prepayId = res.Element("xml").Element("prepay_id").Value;
        //    RequestHandler returnreqHandler = new RequestHandler(null);

        //    returnreqHandler.SetParameter("return_code", "SUCCESS");
        //    returnreqHandler.SetParameter("result_code", "SUCCESS");
        //    returnreqHandler.SetParameter("appid", Config.txl_AppId);
        //    returnreqHandler.SetParameter("mch_id", Config.yly_MchId);
        //    returnreqHandler.SetParameter("nonce_str", re_nonce_str);
        //    returnreqHandler.SetParameter("prepay_id", prepayId);
        //    returnreqHandler.SetParameter("product_id", re_product_id);

        //    string returnsign = returnreqHandler.CreateMd5Sign("key", Config.yly_Key);

        //    returnreqHandler.SetParameter("sign", returnsign);

        //    string xml = returnreqHandler.ParseXML();
        //    db.SaveChanges();
        //    return Content(xml, "text/xml");
        //}

        //public ActionResult PayNativeUrl()
        //{
        //    WxPayData notifyData = GetNotifyData();

        //    检查支付结果中transaction_id是否存在
        //    if (!notifyData.IsSet("transaction_id"))
        //    {
        //        若transaction_id不存在，则立即返回结果给微信支付后台
        //        WxPayData rest = new WxPayData();
        //        rest.SetValue("return_code", "FAIL");
        //        rest.SetValue("return_msg", "支付结果中微信订单号不存在");
        //        Response.Write(rest.ToXml());
        //        Response.End();
        //    }
        //    double id = 0;
        //    if (notifyData.IsSet("trade_type"))
        //    {
        //        string trade_type = notifyData.GetValue("trade_type").ToString();
        //        if (trade_type == "NATIVE")
        //        {
        //            string orderid = notifyData.GetValue("out_trade_no").ToString();
        //            T_QrRecord order = db.T_QrRecord.Where(o => o.Number == orderid).FirstOrDefault();
        //            id = order.ID;
        //            if (order != null)
        //            {
        //                if (order.Remark != null)
        //                {
        //                    T_User pat = db.T_User.Where(o => o.OpenID == order.Remark).FirstOrDefault();
        //                    if (pat != null)
        //                    {
        //                        order.UserID = pat.ID;
        //                        order.Type = 2;
        //                    }
        //                }
        //                order.PayTime = DateTime.Now;
        //                order.State = 1;
        //                db.SaveChanges();
        //            }
        //        }
        //    }

        //    WxPayData res = new WxPayData();
        //    res.SetValue("return_code", "SUCCESS");
        //    res.SetValue("return_msg", "OK");
        //    Log.Info(this.GetType().ToString(), "order query success : " + res.ToXml());
        //    Response.Write(res.ToXml());
        //    Response.End();

        //    return RedirectToAction("OrderSuccess", "Register");
        //}
        #endregion

        //统一支付
        #region 统一支付-选择支付方式
        //ID    订单ID
        public ActionResult PublicPay(string code, string state)//state包括 openid  ID  paytype 支付类型：1微信，2微信+余额   payuser支付用户类型，1自己支付 2代付医生 3代付患者
        {
            if (string.IsNullOrEmpty(code))
            {
                return Content("您拒绝了授权！");
            }
            string openid = state.Split(',')[0].ToString();
            if (openid != Session["OpenID"].ToString())
            {
                return Content("验证失败！请从正规途径进入！");
            }
            string ordergId = state.Split(',')[1].ToString();
            string url = "/Patient/UserCenter";

            T_PayLog unpay = db.T_PayLog.SingleOrDefault(s => s.orderGId == ordergId);
            if (unpay == null)
            {
                return Content("订单不存在，支付失败！");
            }
            else if (unpay.State == 1 && unpay.payTime != null)
            {
                return Content("已付款!");
            }

            WxPayData unifiedOrderResult = JsApiPay.GetUnifiedOrderResult("预约咨询费", "携带参数", unpay.orderGId, (unpay.Money * 100).ToString(), openid, "JSAPI");//DateTime.Now.ToString("yyyyMMddHHmmssfff")
            Write(unifiedOrderResult.ToJson());
            string wxJsApiParam = JsApiPay.GetJsApiParameters(unifiedOrderResult);
            ViewBag.wxJsApiParam = DynamicJson.DeserializeObject(wxJsApiParam);
                        
            ViewBag.url = url;

            return View();
        }
       
        #endregion

        #region 统一微信支付页面
        public ActionResult PublicJsPay(string code, string state)
        {
            if (string.IsNullOrEmpty(code))
            {
                return Content("您拒绝了授权！");
            }
            //return Content(state.Split(',')[0].ToString());
            //if (state.Split(',')[0].ToString() != Session["OpenID"].ToString())
            //{
            //    return Content("验证失败！请从正规途径进入！");
            //}
            string orderId = state;
            string url = "";
            T_PayLog unpay = db.T_PayLog.SingleOrDefault(s => s.orderGId == orderId);
            if (unpay == null)
            {
                return Content("订单不存在，支付失败！");
            }
            else if (unpay.State == 2 && unpay.payTime != null)
            {
                return Content("已付款!");
            }

            string accessToken1 = Config.txl_token;

            string jsapitoken = webHelper.Request_WebRequest("https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=" + accessToken1 + "&type=jsapi", 0, null);

            JObject jo = JObject.Parse(jsapitoken);
            string jsapi_ticket = jo["ticket"].ToString();

            long timestamp1 = CommonHelper.CreatenTimestamp();
            string nonceStr = CommonHelper.CreatenNonce_str().ToLower();
            string res1 = "";
            string signature1 = CommonHelper.GetSignature(jsapi_ticket, nonceStr, timestamp1, Config.domain + "/TenPayV3/PublicJsPay?code=" + code + "&state=" + state, out res1);

            ViewBag.signature1 = signature1;

            string getAccessToken = webHelper.Request_WebRequest("https://api.weixin.qq.com/sns/oauth2/access_token?appid=" + Config.txl_AppId + "&secret=" + Config.txl_AppSecret + "&code=" + code + "&grant_type=authorization_code", 0, null);

            string openid = "";

            if (getAccessToken != null)
            {
                jo = JObject.Parse(getAccessToken);

                openid = jo["openid"].ToString();
            }

            string timeStamp = timestamp1.ToString();
            string date = DateTime.Now.ToString("yyyyMMdd");//当前时间 yyyyMMdd

            string sp_billno = unpay.orderGId;//统一支付订单号，不是原始订单号
            decimal money = Convert.ToDecimal(unpay.Money);
            if (money <= 0)
                return Content("服务器出错");
            //创建支付应答对象
            RequestHandler packageReqHandler = new RequestHandler(null);
            //初始化
            packageReqHandler.Init();
            string body = "微信支付";
            short paytype = Convert.ToInt16(state.Split(',')[2].ToString());//1微信 2微信+支付
            short payuser = Convert.ToInt16(state.Split(',')[3].ToString());//1自己支付 2代付
            

            double paymoney = Convert.ToDouble(money);
            //Write(" " + paytype + "," + payuser + "," + money + "," + paymoney);
            //设置package订单参数
            packageReqHandler.SetParameter("appid", Config.txl_AppId);	  //公众账号ID
            packageReqHandler.SetParameter("mch_id", Config.txl_MchId);		  //商户号
            packageReqHandler.SetParameter("nonce_str", nonceStr);                    //随机字符串
            packageReqHandler.SetParameter("body", body);
            packageReqHandler.SetParameter("out_trade_no", sp_billno);		//商家订单号
            packageReqHandler.SetParameter("total_fee", (paymoney * 100).ToString());//商品金额,以分为单位(money * 100).ToString()
            packageReqHandler.SetParameter("spbill_create_ip", Request.UserHostAddress);   //用户的公网ip，不是商户服务器IP
            packageReqHandler.SetParameter("notify_url", Config.domain + "/TenPayV3/PublicPayNotifyUrl");		    //接收财付通通知的URL
            packageReqHandler.SetParameter("trade_type", "JSAPI");	                    //交易类型
            packageReqHandler.SetParameter("openid", openid);	                    //用户的openId

            string sign = packageReqHandler.CreateMd5Sign("key", Config.txl_Key);
            packageReqHandler.SetParameter("sign", sign);	                    //签名

            string data = packageReqHandler.ParseXML();

            var result = TenPayV3.Unifiedorder(data);
            var res = XDocument.Parse(result);
            Write(data);
            string prepayId = res.Element("xml").Element("prepay_id").Value;

            //---以上用于获取prepayid

            RequestHandler payReqHandler = new RequestHandler(null);

            payReqHandler.SetParameter("appId", Config.txl_AppId);
            payReqHandler.SetParameter("timeStamp", timeStamp);
            payReqHandler.SetParameter("nonceStr", nonceStr);
            payReqHandler.SetParameter("package", "prepay_id=" + prepayId);
            payReqHandler.SetParameter("signType", "MD5");
            string paysign = payReqHandler.CreateMd5Sign("key", Config.txl_Key);

            string paydata = payReqHandler.ParseXML();

            //设置支付参数
            ViewBag.AppID = Config.txl_AppId;
            ViewData["timeStamp"] = timeStamp;
            ViewData["nonceStr"] = nonceStr;
            ViewData["package"] = "prepay_id=" + prepayId;
            ViewData["paySign"] = paysign;

            Session["PayData"] = data + paydata;
            //Session["SignId"] = orderId;
            ViewBag.PaySign = paysign;
            ViewBag.OpenId = openid;
            ViewBag.SignId = orderId;
            ViewBag.ID = unpay.Id;
            ViewBag.url = url;

            return View();
        }
        #endregion

        #region 统一微信支付回调
        public ActionResult PublicPayNotifyUrl()
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
                    T_PayLog unpay = db.T_PayLog.Where(o => o.orderGId == orderid && !o.isDelete).FirstOrDefault();
                    if (unpay != null)
                    {
                        //short ordertype = unpay.Type;
                        DateTime time = DateTime.Now;
                        //unpay.PayOpenId = openid;
                        unpay.payTime = time;
                        unpay.State = 2;
                        ////////////////
                        #region 其他
                        return RedirectToAction("Index", "Doctor");
                        #endregion
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

        public ActionResult Pay(string orderid, string code = "11")
        {
            if (string.IsNullOrEmpty(code))
            {
                string OAuthUrl = OAuthApi.GetAuthorizeUrl(Config.txl_AppId, this.Request.Url.Scheme + "://" + this.Request.Url.Host + this.Request.Url.PathAndQuery, "", OAuthScope.snsapi_base);
                return Redirect(OAuthUrl);
            }
            else
            {
                OAuthAccessTokenResult oAuthAccessTokenResult = OAuthApi.GetAccessToken(Config.txl_AppId, Config.txl_AppSecret, code);
                string openid =  oAuthAccessTokenResult.openid;//"o5kJk63n9Um9_gRpc3LhDV3571XM";
                WxPayData unifiedOrderResult = JsApiPay.GetUnifiedOrderResult("测试支付", "携带参数", DateTime.Now.ToString("yyyyMMddHHmmssfff"), "1", openid, "JSAPI");
                Write(unifiedOrderResult.ToJson());
                string wxJsApiParam = JsApiPay.GetJsApiParameters(unifiedOrderResult);
                ViewBag.wxJsApiParam = DynamicJson.DeserializeObject(wxJsApiParam);
                return View();
            }
        }

        public void Write(string str)
        {
            FileStream fs = new FileStream("C://payLog.txt", FileMode.Append);
            StreamWriter sw = new StreamWriter(fs);
            //开始写入
            sw.WriteLine(str);
            //清空缓冲区
            sw.Flush();
            //关闭流
            sw.Close();
            fs.Close();
        }


        //#region 微信退款公众方法
        //public static string WxRefund(string orderGId)
        //{
        //    TMLSContext db1 = new TMLSContext();
        //    T_PayLog unpay = db1.T_PayLog.Where(s => s.orderGId == orderGId).FirstOrDefault();
        //    if (unpay == null)
        //    {
        //        return "订单不存在，退款失败！";
        //    }
        //    else if (unpay.State < 2)
        //    {
        //        return "订单未付款，退款失败!";
        //    }


        //    string sp_billno = unpay.gId;
        //    string out_refund_no = unpay.orderGId;
        //    decimal money = (decimal)unpay.Money;
        //    if (money <= 0)
        //        return "微信支付金额小于0";

        //    WxPayData packageReqHandler = new WxPayData();
        //    double paymoney = Convert.ToDouble(money);

        //    packageReqHandler.SetValue("out_trade_no", sp_billno);		//商家订单号
        //    packageReqHandler.SetValue("out_refund_no", out_refund_no);		//商户退款单号

        //    packageReqHandler.SetValue("total_fee", (paymoney * 100).ToString());//商品金额,以分为单位(money * 100).ToString()
        //    packageReqHandler.SetValue("refund_fee", (paymoney * 100).ToString());//退款,以分为单位(money * 100).ToString()

        //    packageReqHandler.SetValue("notify_url", "http://" + WeiXinUtil.WXDomain + "/TenPayV3/PublicPayNotifyUrl");		    //接收财付通通知的URL

        //    var result = WeiXinUtil.Refund(packageReqHandler);

        //    return result.ToJson();
        //}
        //#endregion

        #region 微信登陆
        public ActionResult smPay(string id,string code)
        {
            string openid = "";
            if (Session["OpenID"] == null)
            {
                if (string.IsNullOrEmpty(code))
                {
                    string url = string.Format("https://open.weixin.qq.com/connect/oauth2/authorize?appid={0}&redirect_uri={1}" + "&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect", Config.txl_AppId, this.Request.Url.Scheme + "://" + this.Request.Url.Host + this.Request.Url.PathAndQuery);

                    Write("Login" + url);
                    return Redirect(url);
                }
                else
                {
                    string url = string.Format("https://api.weixin.qq.com/sns/oauth2/access_token?appid={0}&secret={1}&code={2}&grant_type=authorization_code", Config.txl_AppId, Config.txl_AppSecret, code);
                    string data = Post.GetJson(url);
                    var obj = serializer.Deserialize<Dictionary<string, string>>(data);
                    openid = obj["openid"];
                    Session["OpenID"] = openid;
                }
            }
            else
            {
                openid = Session["OpenID"] as string;
            }

            T_PayLog unpay = db.T_PayLog.SingleOrDefault(s => s.orderGId == id);
            if (unpay == null)
            {
                return Content("订单不存在，支付失败！");
            }
            else if (unpay.State == 1 && unpay.payTime != null)
            {
                return Content("已付款!");
            }

            WxPayData unifiedOrderResult = JsApiPay.GetUnifiedOrderResult("付费阅读费", "携带参数", unpay.orderGId, (unpay.Money * 100).ToString(), openid, "JSAPI");
            Write(unifiedOrderResult.ToJson());
            string wxJsApiParam = JsApiPay.GetJsApiParameters(unifiedOrderResult);
            ViewBag.wxJsApiParam = DynamicJson.DeserializeObject(wxJsApiParam);

            return View();

        }
        #endregion
    }


}
