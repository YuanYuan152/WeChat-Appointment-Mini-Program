using lxxl.Service;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Web;
using Weixin.SDK.Helpers;

namespace lxxl.WxService
{
    public static class JsApiPay
    {

        /// <summary>
        /// 统一下单接口返回结果
        /// </summary>
        //public WxPayData unifiedOrderResult { get; set; } 

        /**
         * 调用统一下单，获得下单结果
         * @return 统一下单结果
         * @失败时抛异常WxPayException
         */
        public static WxPayData GetUnifiedOrderResult(string body, string attach, string out_trade_no, string total_fee, string openid, string trade_type)
        {
            LogWriter.Default.WriteInfo(trade_type);
            //trade_type = "JSAPI";
            string domain = Config.domain;// System.Configuration.ConfigurationManager.AppSettings["Domain"];
            //统一下单
            WxPayData data = new WxPayData();
            data.SetValue("attach", attach);
            if (trade_type == "JSAPI" || trade_type == "MWEB")
            {
                data.SetValue("appid", Config.txl_AppId);//公众账号ID
                data.SetValue("time_start", DateTime.Now.ToString("yyyyMMddHHmmss"));
                data.SetValue("time_expire", DateTime.Now.AddHours(1).ToString("yyyyMMddHHmmss"));
                data.SetValue("goods_tag", "");
            }
            //else//app支付
            //{
            //    data.SetValue("appid", ""););//应用ID
            //}
            data.SetValue("body", body);
            data.SetValue("mch_id", Config.txl_MchId);//商户号

            data.SetValue("nonce_str", Util.CreateNonce_str());//随机字符串
            data.SetValue("notify_url", domain + "/wx/PayNotify");
            data.SetValue("out_trade_no", out_trade_no);
            data.SetValue("spbill_create_ip", HttpContext.Current.Request.UserHostAddress);//终端ip	  	
            data.SetValue("total_fee", total_fee);
            data.SetValue("trade_type", trade_type);
            if (trade_type == "JSAPI")
            {
                data.SetValue("openid", openid);
            }
            //if (trade_type == "MWEB")//其他浏览器支付
            //{
            //    data.SetValue("scene_info", "{'h5_info': {'type':'Wap','wap_url': "+Config.domain+",'wap_name': '医'}}");
            //}
            data.SetValue("sign", data.MakeSign());
            string xml = data.ToXml();
            LogWriter.Default.WriteWarning("3:" + domain + "/wx/PayNotify");
            string url = "https://api.mch.weixin.qq.com/pay/unifiedorder";
            //string url = "https://api.mch.weixin.qq.com/v3/pay/unifiedorder";


            string response = HttpService.Post(xml, url);
            LogWriter.Default.WriteWarning("4:" + response);
            WxPayData result = new WxPayData();
            result.FromXml(response);
            LogWriter.Default.WriteWarning("1:" + result.ToJson());
            return result;
        }

        /**
        *  
        * 从统一下单成功返回的数据中获取微信浏览器调起jsapi支付所需的参数，
        * 微信浏览器调起JSAPI时的输入参数格式如下：
        * {
        *   "appId" : "wx2421b1c4370ec43b",     //公众号名称，由商户传入     
        *   "timeStamp":" 1395712654",         //时间戳，自1970年以来的秒数     
        *   "nonceStr" : "e61463f8efa94090b1f366cccfbbb444", //随机串     
        *   "package" : "prepay_id=u802345jgfjsdfgsdg888",     
        *   "signType" : "MD5",         //微信签名方式:    
        *   "paySign" : "70EA570631E4BB79628FBCA90534C63FF7FADD89" //微信签名 
        * }
        * @return string 微信浏览器调起JSAPI时的输入参数，json格式可以直接做参数用
        * 更详细的说明请参考网页端调起支付API：http://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=7_7
        * 
        */
        public static string GetJsApiParameters(WxPayData unifiedOrderResult)
        {
            //return unifiedOrderResult.ToJson();
            LogWriter.Default.WriteWarning("2:" + unifiedOrderResult.ToJson());
            WxPayData jsApiParam = new WxPayData();
            if (unifiedOrderResult.GetValue("trade_type").ToString() == "APP")
            {
                //return unifiedOrderResult.ToJson();
                jsApiParam.SetValue("prepayid", unifiedOrderResult.GetValue("prepay_id"));
                jsApiParam.SetValue("partnerid", Config.txl_MchId);
                jsApiParam.SetValue("package", "Sign=WXPay");
                jsApiParam.SetValue("noncestr", unifiedOrderResult.GetValue("nonce_str"));
                jsApiParam.SetValue("sign", jsApiParam.MakeSign());
            }
            else
            {
                jsApiParam.SetValue("package", "prepay_id=" + unifiedOrderResult.GetValue("prepay_id"));
                jsApiParam.SetValue("nonceStr", Util.CreateNonce_str());
            }

            jsApiParam.SetValue("appId", unifiedOrderResult.GetValue("appid"));
            jsApiParam.SetValue("timeStamp", unifiedOrderResult.GetValue("nonce_str"));
            if (unifiedOrderResult.GetValue("trade_type").ToString() == "MWEB")
            {
                jsApiParam.SetValue("mweb_url", unifiedOrderResult.GetValue("mweb_url"));
            }
            jsApiParam.SetValue("signType", "MD5");
            jsApiParam.SetValue("paySign", jsApiParam.MakeSign());
            //jsApiParam.SetValue("prepay_id", unifiedOrderResult.GetValue("prepay_id"));
            //jsApiParam.SetValue("partnerid", WeixinConfig.mch_id);
            string parameters = jsApiParam.ToJson();
            LogWriter.Default.WriteInfo(parameters);
            return parameters;
        }

        public static string GetRealIP()
        {
            string result = String.Empty;

            result = HttpContext.Current.Request.ServerVariables["HTTP_X_FORWARDED_FOR"];

            //可能有代理   
            if (!string.IsNullOrWhiteSpace(result))
            {
                //没有"." 肯定是非IP格式  
                if (result.IndexOf(".") == -1)
                {
                    result = null;
                }
                else
                {
                    //有","，估计多个代理。取第一个不是内网的IP。  
                    if (result.IndexOf(",") != -1)
                    {
                        result = result.Replace(" ", string.Empty).Replace("\"", string.Empty);

                        string[] temparyip = result.Split(",;".ToCharArray());

                        if (temparyip != null && temparyip.Length > 0)
                        {
                            for (int i = 0; i < temparyip.Length; i++)
                            {
                                //找到不是内网的地址  
                                if (IsIPAddress(temparyip[i])
                                    && temparyip[i].Substring(0, 3) != "10."
                                    && temparyip[i].Substring(0, 7) != "192.168"
                                    && temparyip[i].Substring(0, 7) != "172.16.")
                                {
                                    return temparyip[i];
                                }
                            }
                        }
                    }
                    //代理即是IP格式  
                    else if (IsIPAddress(result))
                    {
                        return result;
                    }
                    //代理中的内容非IP  
                    else
                    {
                        result = null;
                    }
                }
            }

            if (string.IsNullOrWhiteSpace(result))
            {
                result = HttpContext.Current.Request.ServerVariables["REMOTE_ADDR"];
            }

            if (string.IsNullOrWhiteSpace(result))
            {
                result = HttpContext.Current.Request.UserHostAddress;
            }

            LogWriter.Default.WriteInfo(result);
            return result;
        }

        public static bool IsIPAddress(string str)
        {
            if (string.IsNullOrWhiteSpace(str) || str.Length < 7 || str.Length > 15)
                return false;

            string regformat = @"^\d{1,3}[\.]\d{1,3}[\.]\d{1,3}[\.]\d{1,3}{1}";

            Regex regex = new Regex(regformat, RegexOptions.IgnoreCase);

            return regex.IsMatch(str);
        }

        /**
        *    
        * 查询订单
        * @param WxPayData inputObj 提交给查询订单API的参数
        * @param int timeOut 超时时间
        * @throws WxPayException
        * @return 成功时返回订单查询结果，其他抛异常
        */
        public static WxPayData OrderQuery(string out_trade_no)
        {
            string url = "https://api.mch.weixin.qq.com/pay/orderquery";
            WxPayData data = new WxPayData();
            //检测必填参数
            if (string.IsNullOrEmpty(out_trade_no))
            {
                LogWriter.Default.WriteWarning("订单查询接口中，out_trade_no、transaction_id至少填一个！");
            }

            data.SetValue("out_trade_no", out_trade_no);
            data.SetValue("appid", Config.txl_AppId);//公众账号ID
            data.SetValue("mch_id", Config.txl_MchId);//商户号
            data.SetValue("nonce_str", Util.CreateNonce_str());//随机字符串
            data.SetValue("sign_type", "MD5");//签名类型
            data.SetValue("sign", data.MakeSign());//签名
            
            string xml = data.ToXml();
            var start = DateTime.Now;
            string response = HttpService.Post(xml, url, false);//调用HTTP通信接口提交数据


            //将xml格式的数据转化为对象以返回
            WxPayData result = new WxPayData();
            result.FromXml(response);

            return result;
        }


        /**
        * 
        * 撤销订单API接口
        * @param WxPayData inputObj 提交给撤销订单API接口的参数，out_trade_no和transaction_id必填一个
        * @param int timeOut 接口超时时间
        * @throws WxPayException
        * @return 成功时返回API调用结果，其他抛异常
        */
        public static WxPayData Reverse(WxPayData inputObj, int timeOut = 6)
        {
            string url = "https://api.mch.weixin.qq.com/secapi/pay/reverse";
            //检测必填参数
            if (!inputObj.IsSet("out_trade_no") && !inputObj.IsSet("transaction_id"))
            {
                LogWriter.Default.WriteWarning("撤销订单API接口中，参数out_trade_no和transaction_id必须填写一个！");
            }

            inputObj.SetValue("appid", Config.txl_AppId);//公众账号ID
            inputObj.SetValue("mch_id", Config.txl_MchId);//商户号
            inputObj.SetValue("nonce_str", Util.CreateNonce_str());//随机字符串
            inputObj.SetValue("sign_type", "MD5");//签名类型
            inputObj.SetValue("sign", inputObj.MakeSign());//签名
            string xml = inputObj.ToXml();

            string response = HttpService.Post(xml, url, true, timeOut);

            WxPayData result = new WxPayData();
            result.FromXml(response);
            return result;
        }
    }
}