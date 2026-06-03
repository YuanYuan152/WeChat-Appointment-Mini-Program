using lxxl.Service;
using lxxl.WxService;
using Senparc.Weixin.MP;
using Senparc.Weixin.MP.AdvancedAPIs;
using Senparc.Weixin.MP.AdvancedAPIs.OAuth;
using Senparc.Weixin.MP.CommonAPIs;
using Senparc.Weixin.MP.Containers;
using Senparc.Weixin.MP.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using Weixin.SDK.Helpers;
using Weixin.SDK.JSSDK;

namespace lxxl.Controllers
{

    public class WeixinCurrencyController : Controller
    {
        #region 获取微信token(对外开放)
        //
        // GET: /WeixinCurrency/
        /// <summary>
        /// 获取微信token
        /// </summary>
        /// <param name="appId"></param>
        /// <returns></returns>
        public JsonResult GetAccessTokenResult(string appId)
        {
            AccessTokenResult accessTokenResult = AccessTokenContainer.GetAccessTokenResult(appId);
            return Json(accessTokenResult, JsonRequestBehavior.AllowGet);
        }
        #endregion

        #region 获取微信ticket(对外开放)
        /// <summary>
        /// 获取微信ticket
        /// </summary>
        /// <param name="appId"></param>
        /// <returns></returns>
        public JsonResult GetTicketByAccessToken(string appId)
        {
            JsApiTicketResult jsApiTicketResult = CommonApi.GetTicketByAccessToken(appId);
            return Json(jsApiTicketResult, JsonRequestBehavior.AllowGet);
        }
        #endregion

        #region 获取微信token和ticket(对外开放)
        public JsonResult getAppInfo(string appId)
        {
            object obj = new
            {
                appId = appId,
                token = AccessTokenContainer.GetAccessTokenResult(appId),
                ticket = CommonApi.GetTicketByAccessToken(appId)
            };
            return Json(obj, JsonRequestBehavior.AllowGet);
        }
        #endregion

        #region 获取微信JsToken签名
        public ActionResult getJsToken()
        {
            var appId = Config.txl_AppId;
            var nonceStr = Util.CreateNonce_str();
            var timestamp = Util.CreateTimestamp();
            var url = Request["url"];
            var jsTickect = Config.txl_ticket;
            var string1 = "";
            var signature = JSAPI.GetSignature(jsTickect, nonceStr, timestamp, url, out string1);
            var model = new JSSDKModel
            {
                appId = appId,
                nonceStr = nonceStr,
                signature = signature,
                timestamp = timestamp,
                shareUrl = url,
                jsapiTicket = jsTickect,
                shareImg = "",
                string1 = string1,
            };
            return Json(new { errcode = 0, weixin = model, errmsg = "获取config参数成功" });
        }
        #endregion

        public ActionResult Pay(string orderid, string code = "")
        {
            if (string.IsNullOrEmpty(code))
            {
                string OAuthUrl = OAuthApi.GetAuthorizeUrl(Config.txl_AppId, this.Request.Url.Scheme + "://" + this.Request.Url.Host + this.Request.Url.PathAndQuery, "", OAuthScope.snsapi_base);
                return Redirect(OAuthUrl);
            }
            else
            {
                OAuthAccessTokenResult oAuthAccessTokenResult = OAuthApi.GetAccessToken(Config.txl_AppId, Config.txl_AppSecret, code);
                string openid = oAuthAccessTokenResult.openid;
                WxPayData unifiedOrderResult = JsApiPay.GetUnifiedOrderResult("测试支付", "携带参数", DateTime.Now.ToString("yyyyMMddHHmmssfff"), "1", openid, "JSAPI");
                string wxJsApiParam = JsApiPay.GetJsApiParameters(unifiedOrderResult);
                ViewBag.wxJsApiParam = DynamicJson.DeserializeObject(wxJsApiParam);
                return View();
            }
        }

    }
}
