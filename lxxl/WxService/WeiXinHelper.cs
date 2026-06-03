using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using System.Web;
using System.Net;
using System.IO;
using lxxl.Service;

namespace lxxl.WxService
{

    public class WeiXinHelper
    {
        public static string access_Token;
        public static DateTime issueDateTime;
        //refresh token if the token is about to expire in 5 seconds
        public static int EXPIRED_SECONDS = 7000;
        static string domain = Config.domain;

        //
        public static string jsapi_ticket { get; set; }
        public static DateTime getTicketTime { get; set; }//最后一次获取jsapi_ticket时间
        public static string GetTicket()
        {
            if (string.IsNullOrEmpty(jsapi_ticket) || getTicketTime.AddSeconds(EXPIRED_SECONDS) < DateTime.Now)
            {
                string requesturl = string.Format("https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token={0}&type=jsapi", GetAccessToken());
                WebRequest request = WebRequest.Create(new Uri(requesturl));
                WebResponse response = request.GetResponse();
                Stream stream = response.GetResponseStream();
                StreamReader sr = new StreamReader(stream);
                JObject jo = JObject.Parse(sr.ReadToEnd());
                sr.Close();
                stream.Close();
                string ticket = jo["ticket"].ToString();
                jsapi_ticket = ticket;
                getTicketTime = DateTime.Now;
            }
            Log.Info("jsapi_ticket", jsapi_ticket);
            return jsapi_ticket;
        }
        //

        public static string GetAccessToken()
        {
            WebHelper webHelper = new WebHelper();

            if (access_Token == null || string.IsNullOrEmpty(access_Token) || issueDateTime.AddSeconds(EXPIRED_SECONDS) < DateTime.Now)
            {
                string getAccessToken = webHelper.Request_WebRequest("https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=" + WeiXinUtil.AppId + "&secret=" + WeiXinUtil.AppSecret, 0, null);

                JObject jo = JObject.Parse(getAccessToken);
                string accessToken = jo["access_token"].ToString();
                SetAccessToken(accessToken);
            }
            Log.Info("access_Token", access_Token);
            return access_Token;
        }

        public static void SetAccessToken(string token)
        {
            access_Token = token;
            issueDateTime = DateTime.Now;
        }


        #region 发送模版消息 新预约订单通知
        /// <summary>
        /// 发送模版消息，新预约订单通知
        /// </summary>
        /// <param name="openId">关注微信号《FromUserName》</param>
        /// <returns></returns>
        public static string SendMsg1(string openId = "", string first = "", string keyword1 = "", string keyword2 = "", string remark = "", string urlP = "")
        {
            string accessToken = GetAccessToken();
            string url = string.Format("https://api.weixin.qq.com/cgi-bin/message/template/send?access_token={0}", accessToken);
            string strPostData = "{ \"touser\":\"" + openId + "\",\"template_id\":\"6Mv2R_HLSodXypCKxe5iCoLEqJ_cwf7PQUvbcl99EQ0\",\"url\":\"" + domain + urlP + "\", \"data\":{\"first\":{\"value\":\"" + first + "\",\"color\":\"#173177\"},\"keyword1\":{\"value\":\"" + keyword1 + "\",\"color\":\"#173177\"},\"keyword2\":{\"value\":\"" + keyword2 + "\",\"color\":\"#173177\"},\"remark\":{\"value\":\"" + remark + "\",\"color\":\"#173177\"}}}";
            string strJson = Post.HttpPostData(url, strPostData);

            return "";
        }
        #endregion

        #region 发送模版消息 预约确认通知
        /// <summary>
        /// 发送模版消息，预约确认通知
        /// </summary>
        /// <param name="openId">关注微信号《FromUserName》</param>
        /// <returns></returns>
        public static string SendMsg2(string openId = "", string first = "", string keyword1 = "", string keyword2 = "", string remark = "", string urlP = "")
        {
            string accessToken = GetAccessToken();
            string url = string.Format("https://api.weixin.qq.com/cgi-bin/message/template/send?access_token={0}", accessToken);
            string strPostData = "{ \"touser\":\"" + openId + "\",\"template_id\":\"u6MJvFQJrcZE9_P2KzCiV3dLN8PcTokzcn6QqbEvpOs\",\"url\":\"" + domain + urlP + "\", \"data\":{\"first\":{\"value\":\"" + first + "\",\"color\":\"#173177\"},\"keyword1\":{\"value\":\"" + keyword1 + "\",\"color\":\"#173177\"},\"keyword2\":{\"value\":\"" + keyword2 + "\",\"color\":\"#173177\"},\"remark\":{\"value\":\"" + remark + "\",\"color\":\"#173177\"}}}";
            string strJson = Post.HttpPostData(url, strPostData);

            return "";
        }
        #endregion

        #region 客服接口 - 发消息
        /// <summary>
        /// 客服接口 - 发消息
        /// </summary>
        /// <param name="openId">关注微信号《FromUserName》</param>
        /// <returns></returns>
        public static string SendCustomMsg1(string openId = "", string keyword1 = "欢迎访问")
        {
            string accessToken = GetAccessToken();
            string url = string.Format("https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token={0}", accessToken);
            string strPostData = "{ \"touser\":\"" + openId + "\",\"msgtype\":\"text\", \"text\":{\"content\":\""+keyword1+"\"}}";
            string strJson = Post.HttpPostData(url, strPostData);

            return "";
        }

        /// <summary>
        /// 客服接口 - 发消息
        /// </summary>
        /// <param name="openId">关注微信号《FromUserName》</param>
        /// <returns></returns>
        public static string SendCustomMsg2(string openId = "", string urlOpen = "/we/Index", string title = "预约信息通知", string description = "您有一条预约订单，请查阅！", string picurl = "/Content/images/jxl-erweima.jpg")
        {
            string accessToken = GetAccessToken();
            string url = string.Format("https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token={0}", accessToken);
            string strPostData = "{ \"touser\":\"" + openId + "\",\"msgtype\":\"news\",\"news\":{\"articles\":[{\"title\":\"" + title + "\",\"description\":\"" + description + "\",\"url\":\"" + domain + urlOpen + "\",\"picurl\":\"" + domain + picurl + "\"}}}";
            string strJson = Post.HttpPostData(url, strPostData);

            return "";
        }
        #endregion
    }
}